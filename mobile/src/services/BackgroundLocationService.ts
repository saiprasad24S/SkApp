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
const DISCLOSURE_KEY = '@skapp_location_disclosure_v2';

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
    // A previously registered task must not keep collecting after a disclosure
    // version change or if the user has not acknowledged the current disclosure.
    if (!(await hasAcknowledgedDisclosure())) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
      await AsyncStorage.multiRemove([BG_SESSION_KEY, BG_EMPLOYEE_KEY, BG_TRACKING_KEY]);
      console.warn('[BgLocation] Task stopped because disclosure is not acknowledged');
      return;
    }

    // Read session context (a task without valid session metadata must not record).
    // Read session context from AsyncStorage (fallback safely if not set)
    let [sessionIdStr, employeeId] = await Promise.all([
      AsyncStorage.getItem(BG_SESSION_KEY),
      AsyncStorage.getItem(BG_EMPLOYEE_KEY),
    ]);

    const parsedSessionId = sessionIdStr ? parseInt(sessionIdStr, 10) : 1;
    const sessionId = isNaN(parsedSessionId) ? 1 : parsedSessionId;
    const safeEmployeeId = employeeId || 'EMPLOYEE';

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
        employeeId: safeEmployeeId,
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
    // Enforce disclosure and OS permission checks centrally so callers cannot bypass them.
    if (!(await hasAcknowledgedDisclosure())) {
      return { success: false, error: 'Location disclosure must be acknowledged before tracking.' };
    }
    const permissions = await getPermissionStatus();
    if (!permissions.foreground || !permissions.background) {
      if (await isTrackingActive()) await stopBackgroundTracking();
      return { success: false, error: 'Foreground and background location permissions are required.' };
    }

    console.log(`[BgLocation] Starting tracking for session=${sessionId}, employee=${employeeId}`);

    // Store session context only after all disclosure and permission checks pass.
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
      timeInterval: 45000, // 45 seconds
      distanceInterval: 30, // 30 meters
      deferredUpdatesInterval: 45000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Skandan Duty Active',
        notificationBody: 'Your location is being tracked during your duty session.',
        notificationColor: '#6B2FA0',
        killServiceOnDestroy: false,
      },
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

    if (isRunning) {
      const disclosureOk = await hasAcknowledgedDisclosure();
      const permissions = await getPermissionStatus();
      if (!disclosureOk || !permissions.foreground || !permissions.background) {
        console.warn('[BgLocation] Stopping task because disclosure or location permission is missing');
        await stopBackgroundTracking();
        return;
      }
    }

    if (backendSessionActive && !isRunning) {
      // Never restart background collection until the current disclosure is acknowledged
      // and Android has granted both foreground and background location access.
      if (!(await hasAcknowledgedDisclosure())) {
        console.warn('[BgLocation] Disclosure not acknowledged; tracking remains stopped');
        return;
      }
      const permissions = await getPermissionStatus();
      if (!permissions.foreground || !permissions.background) {
        console.warn('[BgLocation] Required location permissions missing; tracking remains stopped');
        return;
      }
      const storedSession = await AsyncStorage.getItem(BG_SESSION_KEY);
      const effSessionId = sessionId || (storedSession ? parseInt(storedSession, 10) : 1) || 1;
      const storedEmp = await AsyncStorage.getItem(BG_EMPLOYEE_KEY);
      const effEmpId = employeeId || storedEmp || 'EMPLOYEE';

      const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
      if (fgStatus === 'granted') {
        console.log(`[BgLocation] Restarting tracking after app restart for session=${effSessionId}`);
        await startBackgroundTracking(effSessionId, effEmpId);
      } else {
        console.warn('[BgLocation] Location permission not granted, cannot restart tracking');
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
  // This guard is intentionally here as well as in the UI: no caller may show
  // an Android location permission prompt before the prominent disclosure.
  if (!(await hasAcknowledgedDisclosure())) {
    return { foreground: false, background: false };
  }

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
