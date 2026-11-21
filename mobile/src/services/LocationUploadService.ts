/**
 * LocationUploadService.ts
 * 
 * Uploads queued location records to the backend.
 * Uses mutex to prevent concurrent uploads, exponential backoff on failure.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getQueuedLocations,
  removeFromQueue,
  updateQueueStatus,
  markAsUploaded,
  QueuedLocation,
} from './LocationQueueService';
import { API_BASE_URL } from '../lib/api';

const MAX_RETRY_DELAY_MS = 30000;
const MAX_FAIL_COUNT = 10; // After this many fails, mark as permanent_fail
let isUploading = false;

/** Get the auth token from AsyncStorage (shared with Clerk/background) */
async function getStoredToken(): Promise<string | null> {
  try {
    // Clerk stores its session token in SecureStore with this key pattern
    // We'll use a dedicated key that the foreground app writes for us
    const token = await AsyncStorage.getItem('@skapp_bg_auth_token');
    return token;
  } catch {
    return null;
  }
}

/** Store auth token for background task access */
export async function storeTokenForBackground(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem('@skapp_bg_auth_token', token);
  } catch (err) {
    console.warn('[LocationUpload] Failed to store bg token:', err);
  }
}

/** Clear stored background token */
export async function clearBackgroundToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem('@skapp_bg_auth_token');
  } catch {}
}

/** Calculate backoff delay with jitter */
function getBackoffDelay(failCount: number): number {
  const baseDelay = Math.min(1000 * Math.pow(2, failCount), MAX_RETRY_DELAY_MS);
  const jitter = Math.random() * baseDelay * 0.3;
  return baseDelay + jitter;
}

/** Upload a single location to the backend */
async function uploadSingle(
  location: QueuedLocation,
  token: string
): Promise<'success' | 'permanent_fail' | 'retry'> {
  try {
    const url = `${API_BASE_URL}/api/location/update`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        battery_percentage: location.batteryLevel != null
          ? Math.round(location.batteryLevel * 100)
          : null,
        is_mock: location.isMock,
      }),
    });

    if (response.status === 201 || response.status === 200) {
      return 'success';
    }

    // 400-level errors (except 401/403) are permanent — bad data
    if (response.status >= 400 && response.status < 500) {
      if (response.status === 401 || response.status === 403) {
        // Auth issue — retry later when token refreshes
        console.warn('[LocationUpload] Auth error, will retry later');
        return 'retry';
      }
      console.warn(`[LocationUpload] Permanent fail (${response.status}) for event ${location.eventId}`);
      return 'permanent_fail';
    }

    // 5xx — server error, retry
    return 'retry';
  } catch (err: any) {
    // Network error — retry later
    console.warn('[LocationUpload] Network error:', err?.message);
    return 'retry';
  }
}

/**
 * Process the upload queue.
 * Called from both foreground and background contexts.
 * Token can be passed directly (foreground) or read from storage (background).
 */
export async function uploadQueuedLocations(
  tokenOverride?: string
): Promise<{ uploaded: number; failed: number; remaining: number }> {
  if (isUploading) {
    return { uploaded: 0, failed: 0, remaining: -1 };
  }

  isUploading = true;
  let uploaded = 0;
  let failed = 0;

  try {
    const token = tokenOverride || (await getStoredToken());
    if (!token) {
      console.warn('[LocationUpload] No auth token available, skipping upload');
      const queue = await getQueuedLocations();
      return { uploaded: 0, failed: 0, remaining: queue.length };
    }

    const queue = await getQueuedLocations();
    const pending = queue.filter(
      (q) =>
        q.uploadStatus === 'pending' ||
        (q.uploadStatus === 'failed' && q.failCount < MAX_FAIL_COUNT)
    );

    if (pending.length === 0) {
      return { uploaded: 0, failed: 0, remaining: 0 };
    }

    // Sort oldest first
    pending.sort((a, b) => a.deviceTimestamp - b.deviceTimestamp);

    // Process in batches of up to 20
    const batch = pending.slice(0, 20);
    const successIds: string[] = [];
    const permanentFailIds: string[] = [];
    const retryIds: string[] = [];

    for (const loc of batch) {
      const result = await uploadSingle(loc, token);

      if (result === 'success') {
        successIds.push(loc.eventId);
        uploaded++;
      } else if (result === 'permanent_fail') {
        permanentFailIds.push(loc.eventId);
        failed++;
      } else {
        retryIds.push(loc.eventId);
        // If we get a network error, stop trying the rest of the batch
        if (retryIds.length >= 3) break;
      }
    }

    // Update queue state
    if (successIds.length > 0) {
      await removeFromQueue(successIds);
      await markAsUploaded(successIds);
    }
    if (permanentFailIds.length > 0) {
      await updateQueueStatus(permanentFailIds, 'permanent_fail');
    }
    if (retryIds.length > 0) {
      await updateQueueStatus(retryIds, 'failed', true);
    }

    const remaining = (await getQueuedLocations()).filter(
      (q) => q.uploadStatus === 'pending' || q.uploadStatus === 'failed'
    ).length;

    return { uploaded, failed, remaining };
  } finally {
    isUploading = false;
  }
}
