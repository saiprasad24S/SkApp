import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@skandan_api_base_url';

export const CANDIDATE_HOSTS = [
  'http://192.168.1.13:8000',
  'http://192.168.29.150:8000',
  'http://10.0.2.2:8000',
  'http://localhost:8000',
];

const rawApiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
const INITIAL_BASE =
  rawApiBase && !rawApiBase.includes('skandanhomecarre.com')
    ? rawApiBase
    : 'http://192.168.1.13:8000';

export let API_BASE_URL = INITIAL_BASE;
export let WS_BASE_URL = INITIAL_BASE.replace(/^http/, 'ws');

export type TokenProvider = (skipCache?: boolean) => Promise<string | null>;
let activeTokenProvider: TokenProvider | null = null;

export function registerTokenProvider(provider: TokenProvider | null) {
  activeTokenProvider = provider;
}

// Fast probe function to check if a backend server responds
export async function probeHost(host: string, timeoutMs = 2500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${host}/api/communication/overview/`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    // Any HTTP response code (even 401/403) confirms the backend server is reachable!
    return res.status > 0;
  } catch {
    return false;
  }
}

// Initialize from AsyncStorage safely: only switch if reachable or matches INITIAL_BASE
AsyncStorage.getItem(STORAGE_KEY)
  .then(async (saved) => {
    if (saved && saved.startsWith('http')) {
      if (saved === INITIAL_BASE) {
        API_BASE_URL = saved;
        WS_BASE_URL = saved.replace(/^http/, 'ws');
      } else {
        // If saved differs from compiled default, probe it before adopting
        const isSavedReachable = await probeHost(saved, 1500);
        if (isSavedReachable) {
          API_BASE_URL = saved;
          WS_BASE_URL = saved.replace(/^http/, 'ws');
          console.log('[API] Restored reachable saved server URL:', API_BASE_URL);
        } else {
          console.log('[API] Saved URL unreachable, sticking to build default:', INITIAL_BASE);
          await AsyncStorage.setItem(STORAGE_KEY, INITIAL_BASE).catch(() => {});
        }
      }
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
    // First, check current API_BASE_URL and INITIAL_BASE
    const hostsToCheck = Array.from(new Set([API_BASE_URL, INITIAL_BASE, ...CANDIDATE_HOSTS]));
    const results = await Promise.all(
      hostsToCheck.map(async (h) => {
        const ok = await probeHost(h, 2500);
        return ok ? h : null;
      })
    );

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
  let currentToken = token;

  const makeRequest = async (baseUrl: string, authHeaderVal: string) => {
    const url = `${baseUrl}${path}`;
    const headers = new Headers(init?.headers);

    headers.set('Authorization', `Bearer ${authHeaderVal}`);

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
    let response = await makeRequest(API_BASE_URL, currentToken);

    // If session returned 401 or 403, attempt a single transparent token refresh
    if ((response.status === 401 || response.status === 403) && activeTokenProvider) {
      console.log(`[API] Auth returned ${response.status}, requesting fresh token...`);
      try {
        const freshToken = await activeTokenProvider(true);
        if (freshToken && freshToken !== currentToken) {
          console.log('[API] Fresh token obtained, retrying request...');
          currentToken = freshToken;
          response = await makeRequest(API_BASE_URL, currentToken);
        }
      } catch (refreshErr) {
        console.warn('[API] Token refresh retry failed:', refreshErr);
      }
    }

    if (!response.ok) {
      await handleApiError(response);
    }
    return response;
  } catch (error: any) {
    console.warn(`[API Network Error] ${init?.method || 'GET'} ${path}: ${error?.message}`);

    // If request failed due to network unreachable, attempt auto-detect fallback once
    const isNetworkError = !error?.status && (error?.name === 'TypeError' || error?.message?.includes('Network') || error?.message?.includes('Failed to fetch'));
    if (isNetworkError) {
      const discovered = await autoDetectServer();
      if (discovered && discovered !== API_BASE_URL) {
        try {
          console.log(`[API] Retrying on discovered server ${discovered}${path}...`);
          let retryResp = await makeRequest(discovered, currentToken);
          if ((retryResp.status === 401 || retryResp.status === 403) && activeTokenProvider) {
            const freshToken = await activeTokenProvider(true);
            if (freshToken) {
              retryResp = await makeRequest(discovered, freshToken);
            }
          }
          if (!retryResp.ok) {
            await handleApiError(retryResp);
          }
          return retryResp;
        } catch (retryErr: any) {
          // Fall through to throw standard error
        }
      }
    }

    const isTimeout = error?.name === 'AbortError' || error?.message?.includes('aborted');
    const msg = isTimeout
      ? `Server request timed out after 12s. Please check server connectivity.`
      : `Network request failed. Unable to connect to server at ${API_BASE_URL}.`;

    const apiError: ApiError = {
      status: error?.status || 0,
      message: error?.message || msg,
      detail: error?.detail || error?.message,
      isNetworkError: !error?.status,
    };
    throw apiError;
  }
}
