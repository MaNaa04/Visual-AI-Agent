/**
 * popup/useAgentStore.ts
 * ──────────────────────
 * Zustand store that mirrors chrome.storage.local state into React.
 * - On mount: loadFromStorage() reads initial values.
 * - storage.onChanged listener keeps the store live without polling.
 */

import { create } from 'zustand';
import { STORAGE_KEYS } from '../lib/constants';

interface AgentState {
  monitoringStatus: 'active' | 'paused';
  todayEventsCount: number;
  lastSyncTimestamp: string | null;
  purgedEventsCount: number;
  // Actions
  load: () => Promise<void>;
  toggle: () => Promise<void>;
  subscribeToStorage: () => () => void; // returns unsubscribe fn
}

export const useAgentStore = create<AgentState>((set, get) => ({
  monitoringStatus:  'active',
  todayEventsCount:  0,
  lastSyncTimestamp: null,
  purgedEventsCount: 0,

  /** Read all relevant keys from chrome.storage.local on first render. */
  load: async () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.MONITORING_STATUS,
      STORAGE_KEYS.TODAY_EVENTS_COUNT,
      STORAGE_KEYS.TODAY_DATE,
      STORAGE_KEYS.LAST_SYNC_TIMESTAMP,
      STORAGE_KEYS.PURGED_EVENTS_COUNT,
    ]);

    set({
      monitoringStatus:  (result[STORAGE_KEYS.MONITORING_STATUS] ?? 'active') as 'active' | 'paused',
      todayEventsCount:  result[STORAGE_KEYS.TODAY_DATE] === today
                           ? (result[STORAGE_KEYS.TODAY_EVENTS_COUNT] ?? 0) as number
                           : 0,
      lastSyncTimestamp: (result[STORAGE_KEYS.LAST_SYNC_TIMESTAMP] ?? null) as string | null,
      purgedEventsCount: (result[STORAGE_KEYS.PURGED_EVENTS_COUNT] ?? 0) as number,
    });
  },

  /** Toggle monitoring on ↔ off and persist to storage. */
  toggle: async () => {
    const current = get().monitoringStatus;
    const next: 'active' | 'paused' = current === 'active' ? 'paused' : 'active';
    await chrome.storage.local.set({ [STORAGE_KEYS.MONITORING_STATUS]: next });
    set({ monitoringStatus: next });
  },

  /**
   * Subscribe to chrome.storage.onChanged so the popup stays in sync
   * even when the background worker writes new values.
   * Returns a cleanup function to remove the listener on unmount.
   */
  subscribeToStorage: () => {
    const today = new Date().toISOString().slice(0, 10);

    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      const patch: Partial<Pick<AgentState, 'monitoringStatus' | 'todayEventsCount' | 'lastSyncTimestamp' | 'purgedEventsCount'>> = {};

      if (STORAGE_KEYS.MONITORING_STATUS in changes) {
        patch.monitoringStatus = changes[STORAGE_KEYS.MONITORING_STATUS].newValue as 'active' | 'paused';
      }
      if (STORAGE_KEYS.TODAY_EVENTS_COUNT in changes) {
        const dateResult = changes[STORAGE_KEYS.TODAY_DATE];
        const date = dateResult?.newValue ?? today;
        patch.todayEventsCount = date === today
          ? (changes[STORAGE_KEYS.TODAY_EVENTS_COUNT].newValue as number ?? 0)
          : 0;
      }
      if (STORAGE_KEYS.LAST_SYNC_TIMESTAMP in changes) {
        patch.lastSyncTimestamp = changes[STORAGE_KEYS.LAST_SYNC_TIMESTAMP].newValue as string ?? null;
      }
      if (STORAGE_KEYS.PURGED_EVENTS_COUNT in changes) {
        patch.purgedEventsCount = changes[STORAGE_KEYS.PURGED_EVENTS_COUNT].newValue as number ?? 0;
      }

      if (Object.keys(patch).length > 0) set(patch);
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },
}));
