/**
 * LocationQueueService.ts
 * 
 * Durable offline location queue backed by AsyncStorage.
 * Stores location records locally until they can be uploaded to the backend.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@skapp_location_queue';
const UPLOADED_IDS_KEY = '@skapp_uploaded_event_ids';
const MAX_QUEUE_SIZE = 2000;
const MAX_UPLOADED_IDS = 5000;

export interface QueuedLocation {
  eventId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  batteryLevel: number | null;
  isMock: boolean;
  deviceTimestamp: number; // ms since epoch
  sessionId: number;
  employeeId: string;
  uploadStatus: 'pending' | 'uploading' | 'failed' | 'permanent_fail';
  failCount: number;
  createdAt: number; // ms since epoch
}

/** Generate a simple unique ID without uuid dependency */
export function generateEventId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  const rand2 = Math.random().toString(36).substring(2, 6);
  return `${ts}-${rand}-${rand2}`;
}

/** Load all queued locations from storage */
export async function getQueuedLocations(): Promise<QueuedLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedLocation[];
  } catch (err) {
    console.warn('[LocationQueue] Failed to read queue:', err);
    return [];
  }
}

/** Save the full queue to storage */
async function saveQueue(queue: QueuedLocation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('[LocationQueue] Failed to save queue:', err);
  }
}

/** Add a location to the queue. Trims oldest if over MAX_QUEUE_SIZE. */
export async function addToQueue(location: QueuedLocation): Promise<void> {
  const queue = await getQueuedLocations();

  // Check for duplicate eventId
  if (queue.some((q) => q.eventId === location.eventId)) {
    return;
  }

  queue.push(location);

  // Trim oldest entries if queue is too large
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }

  await saveQueue(queue);
}

/** Remove specific entries by eventId */
export async function removeFromQueue(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  const idSet = new Set(eventIds);
  const queue = await getQueuedLocations();
  const filtered = queue.filter((q) => !idSet.has(q.eventId));
  await saveQueue(filtered);
}

/** Mark specific entries with a new uploadStatus */
export async function updateQueueStatus(
  eventIds: string[],
  status: QueuedLocation['uploadStatus'],
  incrementFail = false
): Promise<void> {
  if (eventIds.length === 0) return;
  const idSet = new Set(eventIds);
  const queue = await getQueuedLocations();
  for (const item of queue) {
    if (idSet.has(item.eventId)) {
      item.uploadStatus = status;
      if (incrementFail) {
        item.failCount += 1;
      }
    }
  }
  await saveQueue(queue);
}

/** Get count of pending locations */
export async function getPendingCount(): Promise<number> {
  const queue = await getQueuedLocations();
  return queue.filter(
    (q) => q.uploadStatus === 'pending' || q.uploadStatus === 'failed'
  ).length;
}

/** Get total queue size */
export async function getQueueSize(): Promise<number> {
  const queue = await getQueuedLocations();
  return queue.length;
}

/** Clear all entries for a specific session */
export async function clearSessionQueue(sessionId: number): Promise<void> {
  const queue = await getQueuedLocations();
  const filtered = queue.filter((q) => q.sessionId !== sessionId);
  await saveQueue(filtered);
}

/** Clear entire queue */
export async function clearAllQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch (err) {
    console.warn('[LocationQueue] Failed to clear queue:', err);
  }
}

/** Track uploaded event IDs to prevent duplicate uploads */
export async function markAsUploaded(eventIds: string[]): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(UPLOADED_IDS_KEY);
    let ids: string[] = raw ? JSON.parse(raw) : [];
    ids.push(...eventIds);
    // Trim oldest to prevent unbounded growth
    if (ids.length > MAX_UPLOADED_IDS) {
      ids = ids.slice(ids.length - MAX_UPLOADED_IDS);
    }
    await AsyncStorage.setItem(UPLOADED_IDS_KEY, JSON.stringify(ids));
  } catch (err) {
    console.warn('[LocationQueue] Failed to mark uploaded IDs:', err);
  }
}

/** Check if an event ID was already uploaded */
export async function wasAlreadyUploaded(eventId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(UPLOADED_IDS_KEY);
    if (!raw) return false;
    const ids: string[] = JSON.parse(raw);
    return ids.includes(eventId);
  } catch {
    return false;
  }
}
