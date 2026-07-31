/**
 * popup/Popup.tsx
 * ───────────────
 * Exactly five UI elements (per spec):
 *   1. Monitoring Status indicator (ON / PAUSED)
 *   2. Pause / Resume button
 *   3. Today's events count
 *   4. Last sync time
 *   5. Settings shortcut → options page
 */

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { useAgentStore } from './useAgentStore';
import './popup.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return 'Unknown';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

function Popup() {
  const { monitoringStatus, todayEventsCount, lastSyncTimestamp, purgedEventsCount, load, toggle, subscribeToStorage } =
    useAgentStore();

  // Load initial values from storage on mount
  useEffect(() => {
    void load();
  }, [load]);

  // Subscribe to live storage changes; clean up on unmount
  useEffect(() => {
    const unsubscribe = subscribeToStorage();
    return unsubscribe;
  }, [subscribeToStorage]);

  const isActive = monitoringStatus === 'active';

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className="w-72 bg-gray-950 text-white font-sans select-none">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-800 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
        <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">
          Visual AI Agent
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">

        {/* 1 + 2: Status + Pause/Resume */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Monitoring</p>
            <p className={`text-sm font-semibold mt-0.5 ${isActive ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isActive ? 'Active' : 'Paused'}
            </p>
          </div>
          <button
            onClick={() => void toggle()}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              isActive
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
            }`}
          >
            {isActive ? 'Pause' : 'Resume'}
          </button>
        </div>

        <div className="h-px bg-gray-800" />

        {/* 3: Today's events count */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Events Today</p>
          <p className="text-sm font-semibold text-white tabular-nums">
            {todayEventsCount.toLocaleString()}
          </p>
        </div>

        {/* 4: Last sync time */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Last Sync</p>
          <p className="text-xs font-mono text-gray-300">{formatSyncTime(lastSyncTimestamp)}</p>
        </div>

        {/* Excluded activity blocked (only shown when > 0) */}
        {purgedEventsCount > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide">🛡️ Blocked</p>
            <p className="text-xs font-semibold text-emerald-400 tabular-nums">
              {purgedEventsCount.toLocaleString()} excluded
            </p>
          </div>
        )}

        <div className="h-px bg-gray-800" />

        {/* 5: Settings shortcut */}
        <button
          onClick={openOptions}
          className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-white transition-colors cursor-pointer py-0.5"
        >
          <span>Settings & Exclude List</span>
          <span className="text-gray-600">→</span>
        </button>

      </div>
    </div>
  );
}

// ─── Mount ────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
