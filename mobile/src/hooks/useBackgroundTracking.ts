/**
 * useBackgroundTracking.ts
 * 
 * React hook exposing background tracking state to UI components.
 * Provides tracking status, pending upload count, and control functions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isTrackingActive,
  startBackgroundTracking,
  stopBackgroundTracking,
  hasAcknowledgedDisclosure,
  acknowledgeDisclosure,
  requestLocationPermissions,
  getPermissionStatus,
} from '../services/BackgroundLocationService';
import { storeTokenForBackground } from '../services/LocationUploadService';
import { getPendingCount, getQueueSize } from '../services/LocationQueueService';

export interface BackgroundTrackingState {
  /** Whether the background task is currently running */
  isTracking: boolean;
  /** Number of locations pending upload */
  pendingCount: number;
  /** Total queue size including permanent failures */
  totalQueueSize: number;
  /** Last error message if any */
  trackingError: string | null;
  /** Whether foreground location permission is granted */
  hasForegroundPermission: boolean;
  /** Whether background location permission is granted */
  hasBackgroundPermission: boolean;
  /** Whether user has seen the disclosure modal */
  disclosureAcknowledged: boolean;
  /** Start tracking for a session */
  startTracking: (sessionId: number, employeeId: string, token: string) => Promise<boolean>;
  /** Stop tracking */
  stopTracking: () => Promise<void>;
  /** Mark disclosure as acknowledged and request permissions */
  handleDisclosureAccept: () => Promise<{ foreground: boolean; background: boolean }>;
  /** Refresh the tracking state */
  refresh: () => Promise<void>;
}

export function useBackgroundTracking(): BackgroundTrackingState {
  const [isTracking, setIsTracking] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalQueueSize, setTotalQueueSize] = useState(0);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [hasForegroundPermission, setHasForegroundPermission] = useState(false);
  const [hasBackgroundPermission, setHasBackgroundPermission] = useState(false);
  const [disclosureAcknowledged, setDisclosureAcknowledged] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [tracking, pending, total, perms, disclosure] = await Promise.all([
        isTrackingActive(),
        getPendingCount(),
        getQueueSize(),
        getPermissionStatus(),
        hasAcknowledgedDisclosure(),
      ]);

      setIsTracking(tracking);
      setPendingCount(pending);
      setTotalQueueSize(total);
      setHasForegroundPermission(perms.foreground);
      setHasBackgroundPermission(perms.background);
      setDisclosureAcknowledged(disclosure);
    } catch (err) {
      console.warn('[useBackgroundTracking] Refresh error:', err);
    }
  }, []);

  // Poll tracking state every 30 seconds
  useEffect(() => {
    refresh();

    intervalRef.current = setInterval(refresh, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refresh]);

  const startTracking = useCallback(
    async (sessionId: number, employeeId: string, token: string): Promise<boolean> => {
      try {
        setTrackingError(null);

        // Store token for background access
        await storeTokenForBackground(token);

        const result = await startBackgroundTracking(sessionId, employeeId);
        if (result.success) {
          setIsTracking(true);
          return true;
        } else {
          setTrackingError(result.error || 'Failed to start tracking');
          return false;
        }
      } catch (err: any) {
        setTrackingError(err.message || 'Unexpected error starting tracking');
        return false;
      }
    },
    []
  );

  const stopTrackingFn = useCallback(async () => {
    try {
      await stopBackgroundTracking();
      setIsTracking(false);
      setTrackingError(null);
      await refresh();
    } catch (err: any) {
      console.warn('[useBackgroundTracking] Stop error:', err);
    }
  }, [refresh]);

  const handleDisclosureAccept = useCallback(async () => {
    await acknowledgeDisclosure();
    setDisclosureAcknowledged(true);

    const perms = await requestLocationPermissions();
    setHasForegroundPermission(perms.foreground);
    setHasBackgroundPermission(perms.background);
    return perms;
  }, []);

  return {
    isTracking,
    pendingCount,
    totalQueueSize,
    trackingError,
    hasForegroundPermission,
    hasBackgroundPermission,
    disclosureAcknowledged,
    startTracking,
    stopTracking: stopTrackingFn,
    handleDisclosureAccept,
    refresh,
  };
}
