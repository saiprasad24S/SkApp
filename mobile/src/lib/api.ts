import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@skandan_api_base_url';

export const CANDIDATE_HOSTS = [
  'http://192.168.1.13:8000',
  'http://192.168.29.150:8000',
  'http://10.0.2.2:8000',
  'http://localhost:8000',
];

const INITIAL_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.13:8000';

export let API_BASE_URL = INITIAL_BASE;
export let WS_BASE_URL = INITIAL_BASE.replace(/^http/, 'ws');

// Initialize from AsyncStorage if available
AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (saved && saved.startsWith('http')) {
      API_BASE_URL = saved;
      WS_BASE_URL = saved.replace(/^http/, 'ws');
      console.log('[API] Restored saved server URL:', API_BASE_URL);
    }
  })
  .catch(() => {});

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function getWsBaseUrl(): string {
  return WS_BASE_URL;
}

export async function setApiBaseUrl(newUrl: string): Promise<void> {
  const cleanUrl = newUrl.trim().replace(/\/+$/, '');
  API_BASE_URL = cleanUrl;
  WS_BASE_URL = cleanUrl.replace(/^http/, 'ws');
  await AsyncStorage.setItem(STORAGE_KEY, cleanUrl).catch(() => {});
  console.log('[API] Server URL switched to:', cleanUrl);
}

let isProbing = false;

export async function autoDetectServer(): Promise<string | null> {
  if (isProbing) return API_BASE_URL;
  isProbing = true;

  try {
    // Check candidates in parallel with short timeout
    const probe = async (host: string): Promise<string | null> => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`${host}/api/communication/overview/`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        // Any HTTP response (even 401/403) confirms the backend server is reachable!
        if (res.status > 0) {
          return host;
        }
      } catch {
        // unreachable
      }
      return null;
    };

    const results = await Promise.all(CANDIDATE_HOSTS.map((h) => probe(h)));
    const responsiveHost = results.find((r) => r !== null);
    if (responsiveHost) {
      console.log('[API] Auto-detected active server:', responsiveHost);
      await setApiBaseUrl(responsiveHost);
      return responsiveHost;
    }
  } finally {
    isProbing = false;
  }
  return null;
}

export interface ApiError {
  status: number;
  message: string;
  detail?: string;
  isNetworkError?: boolean;
}

export async function handleApiError(response: Response): Promise<never> {
  let message = 'An unexpected error occurred';
  let detail: string | undefined;

  try {
    const data = await response.json();
    if (data.message) {
      message = data.message;
    } else if (data.detail) {
      message = data.detail;
    }
    if (data.detail && data.message) {
      detail = data.detail;
    }
  } catch (e) {
    message = response.statusText || message;
  }

  const error: ApiError = {
    status: response.status,
    message,
    detail,
    isNetworkError: false,
  };
  throw error;
}

export async function authedFetch(
  path: string,
  token: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const makeRequest = async (baseUrl: string) => {
    const url = `${baseUrl}${path}`;
    const headers = new Headers(init?.headers);

    headers.set('Authorization', `Bearer ${token}`);

    if (init?.body && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const timeoutMs = init?.timeoutMs ?? 12000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal: init?.signal || controller.signal,
      });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  try {
    const response = await makeRequest(API_BASE_URL);
    if (!response.ok) {
      await handleApiError(response);
    }
    return response;
  } catch (error: any) {
    console.warn(`[API Network Error] ${init?.method || 'GET'} ${path}: ${error?.message}`);

    // If request failed, attempt auto-detect fallback once
    const discovered = await autoDetectServer();
    if (discovered && discovered !== API_BASE_URL) {
      try {
        console.log(`[API] Retrying on discovered server ${discovered}${path}...`);
        const retryResp = await makeRequest(discovered);
        if (!retryResp.ok) {
          await handleApiError(retryResp);
        }
        return retryResp;
      } catch (retryErr: any) {
        // Fall through to throw standard error
      }
    }

    const isTimeout = error?.name === 'AbortError' || error?.message?.includes('aborted');
    const msg = isTimeout
      ? `Server request timed out after 12s. Please check server connectivity.`
      : `Network request failed. Unable to connect to server at ${API_BASE_URL}.`;

    const apiError: ApiError = {
      status: 0,
      message: msg,
      detail: error?.message,
      isNetworkError: true,
    };
    throw apiError;
  }
}
