export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || '';
export const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_BASE_URL || '';

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
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(init?.headers);

  headers.set('Authorization', `Bearer ${token}`);

  if (init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const timeoutMs = init?.timeoutMs ?? 12000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      signal: init?.signal || controller.signal,
    });
  } catch (error: any) {
    clearTimeout(timer);
    const isTimeout = error?.name === 'AbortError' || error?.message?.includes('aborted');
    const msg = isTimeout
      ? `Server request timed out after ${Math.round(timeoutMs / 1000)}s. Please check server connectivity.`
      : `Network request failed. Unable to connect to server at ${API_BASE_URL || 'configured API URL'}.`;
    
    console.warn(`[API Network Error] ${init?.method || 'GET'} ${path}: ${msg}`);
    const apiError: ApiError = {
      status: 0,
      message: msg,
      detail: error?.message,
      isNetworkError: true,
    };
    throw apiError;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    await handleApiError(response);
  }

  return response;
}
