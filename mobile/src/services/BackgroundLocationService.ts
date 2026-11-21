/**
 * BackgroundLocationService.ts
 * 
 * Core background location tracking service using expo-task-manager.
 * 
 * IMPORTANT: This file MUST be imported at module scope (top of _layout.tsx)
 * so that TaskManager.defineTask() runs before any task is triggered.
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addToQueue,
  generateEventId,
  QueuedLocation,
} from './LocationQueueService';
import { uploadQueuedLocations } from './LocationUploadService';

// ─── Constants ────────────────────────────────────────────────────────
export const BACKGROUND_LOCATION_TASK = 'SKAPP_BACKGROUND_LOCATION_TASK';
const BG_SESSION_KEY = '@skapp_bg_session_id';
const BG_EMPLOYEE_KEY = '@skapp_bg_employee_id';
const BG_TRACKING_KEY = '@skapp_bg_tracking_active';
const DISCLOSURE_KEY = '@skapp_location_disclosure_v1';

// ─── Task Definition (Module Scope!) ──────────────────────────────────
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('[BgLocation] Task error:', error.message);
    return;
  }

  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  try {
    // Read session context from AsyncStorage
    const [sessionIdStr, employeeId] = await Promise.all([
      AsyncStorage.getItem(BG_SESSION_KEY),
      AsyncStorage.getItem(BG_EMPLOYEE_KEY),
    ]);

    if (!sessionIdStr || !employeeId) {
      console.warn('[BgLocation] No session context, skipping location batch');
      return;
    }

    const sessionId = parseInt(sessionIdStr, 10);
    if (isNaN(sessionId)) {
      console.warn('[BgLocation] Invalid session ID:', sessionIdStr);
      return;
    }

    // Queue each location
    for (const loc of locations) {
      const queuedLoc: QueuedLocation = {
        eventId: generateEventId(),
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        heading: loc.coords.heading,
        batteryLevel: null, // Battery API not available in background task
        isMock: (loc as any).mocked ?? false,
        deviceTimestamp: loc.timestamp,
        sessionId,
        employeeId,
        uploadStatus: 'pending',
        failCount: 0,
        createdAt: Date.now(),
      };

      await addToQueue(queuedLoc);
    }

    // Attempt upload
    try {
      await uploadQueuedLocations();
    } catch (uploadErr) {
      // Upload failures are non-fatal; queued for later
      console.warn('[BgLocation] Upload attempt failed, locations are queued');
    }
  } catch (err) {
    console.error('[BgLocation] Error processing locations:', err);
  }
});

// ─── Service Functions ────────────────────────────────────────────────

/** Check if the background location task is currently running */
export async function isTrackingActive(): Promise<boolean> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    return isRegistered;
  } catch {
    return false;
  }
}

/** Start background location tracking for a given session */
export async function startBackgroundTracking(
  sessionId: number,
  employeeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[BgLocation] Starting tracking for session=${sessionId}, employee=${employeeId}`);

    // Store session context for the background task
    await AsyncStorage.setItem(BG_SESSION_KEY, String(sessionId));
    await AsyncStorage.setItem(BG_EMPLOYEE_KEY, employeeId);
    await AsyncStorage.setItem(BG_TRACKING_KEY, 'true');

    // Check if already running
    const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      console.log('[BgLocation] Task already running, updating session context');
      return { success: true };
    }

    // Start background location updates
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60000, // 60 seconds
      distanceInterval: 50, // 50 meters
      deferredUpdatesInterval: 60000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Skandan Duty Active',
        notificationBody: 'Your location is being tracked during your duty session.',
        notificationColor: '#6B2FA0',
        killServiceOnDestroy: false,
      },
      // Android: continue even after app is killed
      pausesUpdatesAutomatically: false,
    });

    console.log('[BgLocation] Background location tracking started successfully');
    return { success: true };
  } catch (err: any) {
    console.error('[BgLocation] Failed to start tracking:', err);
    return { success: false, error: err.message || 'Failed to start tracking' };
  }
}

/** Stop background location tracking */
export async function stopBackgroundTracking(): Promise<void> {
  try {
    console.log('[BgLocation] Stopping background tracking');

    const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('[BgLocation] Background location task stopped');
    }

    // Clear session context
    await AsyncStorage.multiRemove([BG_SESSION_KEY, BG_EMPLOYEE_KEY, BG_TRACKING_KEY]);

    // Final upload attempt
    try {
      await uploadQueuedLocations();
    } catch {
      console.warn('[BgLocation] Final upload attempt failed, remaining in queue');
    }
  } catch (err) {
    console.error('[BgLocation] Error stopping tracking:', err);
  }
}

/**
 * Reconcile tracking state with backend on app restart.
 * If backend says session is active but tracking is not running, restart it.
 * If backend says no active session but tracking is running, stop it.
 */
export async function reconcileTrackingState(
  backendSessionActive: boolean,
  sessionId?: number,
  employeeId?: string
): Promise<void> {
  try {
    const isRunning = await isTrackingActive();
    const storedTrackingFlag = await AsyncStorage.getItem(BG_TRACKING_KEY);
    const wasTracking = storedTrackingFlag === 'true';

    console.log(
      `[BgLocation] Reconcile: backendActive=${backendSessionActive}, ` +
      `taskRunning=${isRunning}, wasTracking=${wasTracking}`
    );

    if (backendSessionActive && !isRunning && sessionId && employeeId) {
      // Session is active but tracking stopped (e.g., after app restart)
      console.log('[BgLocation] Restarting tracking after app restart');

      // Check if we have background permission
      const { status } = await Location.getBackgroundPermissionsAsync();
      if (status === 'granted') {
        await startBackgroundTracking(sessionId, employeeId);
      } else {
        console.warn('[BgLocation] No background permission, cannot restart tracking');
        // Store the tracking flag so we can restart when permission is granted
        await AsyncStorage.setItem(BG_TRACKING_KEY, 'true');
        await AsyncStorage.setItem(BG_SESSION_KEY, String(sessionId));
        await AsyncStorage.setItem(BG_EMPLOYEE_KEY, employeeId);
      }
    } else if (!backendSessionActive && isRunning) {
      // Session ended (maybe from another device) but tracking is still running
      console.log('[BgLocation] Stopping orphaned tracking');
      await stopBackgroundTracking();
    }
  } catch (err) {
    console.error('[BgLocation] Reconcile error:', err);
  }
}

/** Check if user has acknowledged the location disclosure */
export async function hasAcknowledgedDisclosure(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(DISCLOSURE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

/** Mark the location disclosure as acknowledged */
export async function acknowledgeDisclosure(): Promise<void> {
  await AsyncStorage.setItem(DISCLOSURE_KEY, 'true');
}

/** Request both foreground and background location permissions */
export async function requestLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  // Request foreground first (required before background on Android)
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') {
    return { foreground: false, background: false };
  }

  // Then request background
  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  return {
    foreground: true,
    background: bgStatus === 'granted',
  };
}

/** Get current permission status without requesting */
export async function getPermissionStatus(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    return {
      foreground: fg.status === 'granted',
      background: bg.status === 'granted',
    };
  } catch {
    return { foreground: false, background: false };
  }
}
