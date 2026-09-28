import { authedFetch } from './api';
import { EmployeeProfile } from '../types/employee';

export interface LoginResponse {
  role: 'ADMIN' | 'EMPLOYEE';
  employee?: EmployeeProfile;
  session_is_active?: boolean;
  requires_face_registration?: boolean;
  active_session?: boolean;
  session_summary?: {
    active_session?: boolean;
    [key: string]: unknown;
  };
}

export async function loginToBackend(token: string): Promise<LoginResponse> {
  const response = await authedFetch('/api/auth/login', token, {
    method: 'POST',
    timeoutMs: 15000,
  });
  return response.json();
}

export async function fetchCurrentProfile(token: string): Promise<LoginResponse> {
  try {
    return await loginToBackend(token);
  } catch (err: any) {
    // If /api/auth/login threw because of serverless or route difference, try /api/employees/current/me/
    try {
      const resp = await authedFetch('/api/employees/current/me/', token, { timeoutMs: 10000 });
      const empData = await resp.json();
      return {
        role: 'EMPLOYEE',
        employee: empData,
        active_session: false,
        session_summary: { active_session: false },
      };
    } catch {
      throw err;
    }
  }
}

export async function logoutFromBackend(token: string): Promise<void> {
  try {
    await authedFetch('/api/auth/logout', token, {
      method: 'POST',
      timeoutMs: 8000,
    });
  } catch (err) {
    console.warn('[Auth] Backend logout non-fatal:', err);
  }
}
