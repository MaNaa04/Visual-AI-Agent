/**
 * lib/storage.ts
 * ──────────────
 * The ONLY module that touches chrome.storage.local.
 * Every other module (background, popup, content) must go through these functions.
 *
 * Design rule: never read-then-conditionally-write without holding the value.
 * Every write reads fresh state first to avoid stale-closure bugs under service
 * worker wake/sleep cycles.
 */

import type { AgentEvent, MonitoringStatus } from './types';
import { STORAGE_KEYS, LIMITS } from './constants';

// ─── Client identity ──────────────────────────────────────────────────────────

/** Generates (on first call) and persists the extension client UUID. */
export async function getClientId(): Promise<string> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CLIENT_ID);
  if (result[STORAGE_KEYS.CLIENT_ID]) return result[STORAGE_KEYS.CLIENT_ID] as string;

  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [STORAGE_KEYS.CLIENT_ID]: id });
  return id;
}

// ─── Monitoring status ────────────────────────────────────────────────────────

export async function getMonitoringStatus(): Promise<MonitoringStatus> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.MONITORING_STATUS);
  return (result[STORAGE_KEYS.MONITORING_STATUS] as MonitoringStatus) ?? 'active';
}

export async function setMonitoringStatus(status: MonitoringStatus): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.MONITORING_STATUS]: status });
}

// ─── Event buffer ─────────────────────────────────────────────────────────────

export async function getBuffer(): Promise<AgentEvent[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PENDING_EVENTS);
  return (result[STORAGE_KEYS.PENDING_EVENTS] as AgentEvent[]) ?? [];
}

/**
 * Append one event to the local buffer.
 * Includes an overflow guard: if the backend has been unreachable for a very long
 * time the buffer won't grow forever — oldest events are trimmed beyond the ceiling.
 */
export async function appendEvent(event: AgentEvent): Promise<void> {
  const current = await getBuffer();

  if (current.length >= LIMITS.BUFFER_OVERFLOW_TRIM_AT) {
    // Trim oldest — keep the most recent BUFFER_OVERFLOW_KEEP events.
    const droppedCount = current.length - LIMITS.BUFFER_OVERFLOW_KEEP;
    current.splice(0, droppedCount);
    
    // Update drop tracking
    const storageKeys = [STORAGE_KEYS.DROPPED_EVENTS_COUNT, STORAGE_KEYS.FIRST_DROP_TIMESTAMP];
    const dropData = await chrome.storage.local.get(storageKeys);
    
    const prevCount = (dropData[STORAGE_KEYS.DROPPED_EVENTS_COUNT] as number) || 0;
    const newCount = prevCount + droppedCount;
    
    const updates: Record<string, any> = {
      [STORAGE_KEYS.DROPPED_EVENTS_COUNT]: newCount
    };
    
    if (!dropData[STORAGE_KEYS.FIRST_DROP_TIMESTAMP]) {
      updates[STORAGE_KEYS.FIRST_DROP_TIMESTAMP] = new Date().toISOString();
    }
    
    await chrome.storage.local.set(updates);
    console.warn(`[VAA] Buffer overflow: dropped ${droppedCount} oldest event(s). Total dropped since backend unreachable: ${newCount}`);
  }

  current.push(event);
  await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_EVENTS]: current });
  await _incrementTodayCount();
}

/**
 * Remove specific events from the buffer after a successful flush.
 * NEVER called before we receive a 2xx from the backend — that's the core
 * "zero event loss" guarantee. Filtering by eventId prevents race conditions
 * where new events arrive while the POST request is in flight.
 */
export async function removeFlushedEvents(flushedIds: string[]): Promise<void> {
  const current = await getBuffer();
  const idSet = new Set(flushedIds);
  const remaining = current.filter(evt => !idSet.has(evt.eventId));
  await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_EVENTS]: remaining });
}

// ─── Backoff & Retry State ────────────────────────────────────────────────────

export async function getConsecutiveFailures(): Promise<number> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CONSECUTIVE_FAILURES);
  return (result[STORAGE_KEYS.CONSECUTIVE_FAILURES] as number) ?? 0;
}

export async function setConsecutiveFailures(count: number): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CONSECUTIVE_FAILURES]: count });
}

export async function resetDropTracking(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.DROPPED_EVENTS_COUNT,
    STORAGE_KEYS.FIRST_DROP_TIMESTAMP
  ]);
}

// ─── Exclude list ─────────────────────────────────────────────────────────────

export async function getExcludeList(): Promise<string[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.EXCLUDE_LIST);
  return (result[STORAGE_KEYS.EXCLUDE_LIST] as string[]) ?? [];
}

export async function setExcludeList(list: string[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.EXCLUDE_LIST]: list });
}

// ─── Screenshot rate-limiting ─────────────────────────────────────────────────

export async function getLastCaptureTimestamps(): Promise<Record<number, number>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_CAPTURE_TIMESTAMPS);
  return (result[STORAGE_KEYS.LAST_CAPTURE_TIMESTAMPS] as Record<number, number>) ?? {};
}

export async function setLastCaptureTimestamp(tabId: number, ts: number): Promise<void> {
  const timestamps = await getLastCaptureTimestamps();
  timestamps[tabId] = ts;
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_CAPTURE_TIMESTAMPS]: timestamps });
}

// ─── Activity tracking (for sustained-activity screenshot trigger) ────────────

export async function getLastActivityTimestamps(): Promise<Record<number, number>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_ACTIVITY_TIMESTAMPS);
  return (result[STORAGE_KEYS.LAST_ACTIVITY_TIMESTAMPS] as Record<number, number>) ?? {};
}

export async function setLastActivityTimestamp(tabId: number, ts: number): Promise<void> {
  const timestamps = await getLastActivityTimestamps();
  timestamps[tabId] = ts;
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_ACTIVITY_TIMESTAMPS]: timestamps });
}

// ─── Sync metadata ────────────────────────────────────────────────────────────

export async function getLastSyncTimestamp(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_SYNC_TIMESTAMP);
  return (result[STORAGE_KEYS.LAST_SYNC_TIMESTAMP] as string) ?? null;
}

export async function setLastSyncTimestamp(ts: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_SYNC_TIMESTAMP]: ts });
}

// ─── Daily event counter ──────────────────────────────────────────────────────

async function _incrementTodayCount(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.TODAY_EVENTS_COUNT,
    STORAGE_KEYS.TODAY_DATE,
  ]);
  const storedDate = result[STORAGE_KEYS.TODAY_DATE] as string | undefined;
  const prevCount = (result[STORAGE_KEYS.TODAY_EVENTS_COUNT] as number) ?? 0;
  const newCount = storedDate === today ? prevCount + 1 : 1; // Reset if new day
  await chrome.storage.local.set({
    [STORAGE_KEYS.TODAY_EVENTS_COUNT]: newCount,
    [STORAGE_KEYS.TODAY_DATE]: today,
  });
}

export async function getTodayCount(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.TODAY_EVENTS_COUNT,
    STORAGE_KEYS.TODAY_DATE,
  ]);
  if ((result[STORAGE_KEYS.TODAY_DATE] as string) !== today) return 0;
  return (result[STORAGE_KEYS.TODAY_EVENTS_COUNT] as number) ?? 0;
}
