import React, { useEffect, useState } from 'react';
import { 
  getMonitoringStatus, 
  setMonitoringStatus,
  getBuffer,
  getTodayCount,
} from '../lib/storage';
import { STORAGE_KEYS } from '../lib/constants';

export default function StatusPanel() {
  const [status, setStatus] = useState<'active' | 'paused'>('active');
  const [bufferSize, setBufferSize] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [drops, setDrops] = useState(0);
  const [dropTime, setDropTime] = useState<string | null>(null);
  const [purged, setPurged] = useState(0);
  const [purgeTime, setPurgeTime] = useState<string | null>(null);
  
  useEffect(() => {
    // Initial load
    const loadState = async () => {
      setStatus(await getMonitoringStatus());
      setBufferSize((await getBuffer()).length);
      setTodayCount(await getTodayCount());
      
      const storage = await chrome.storage.local.get([
        STORAGE_KEYS.DROPPED_EVENTS_COUNT,
        STORAGE_KEYS.FIRST_DROP_TIMESTAMP,
        STORAGE_KEYS.PURGED_EVENTS_COUNT,
        STORAGE_KEYS.LAST_PURGE_TIMESTAMP,
      ]);
      setDrops((storage[STORAGE_KEYS.DROPPED_EVENTS_COUNT] as number) || 0);
      setDropTime((storage[STORAGE_KEYS.FIRST_DROP_TIMESTAMP] as string) || null);
      setPurged((storage[STORAGE_KEYS.PURGED_EVENTS_COUNT] as number) || 0);
      setPurgeTime((storage[STORAGE_KEYS.LAST_PURGE_TIMESTAMP] as string) || null);
    };
    
    loadState();
    
    // Listen for storage changes to update live
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[STORAGE_KEYS.MONITORING_STATUS]) {
        setStatus(changes[STORAGE_KEYS.MONITORING_STATUS].newValue as 'active' | 'paused');
      }
      if (changes[STORAGE_KEYS.PENDING_EVENTS]) {
        setBufferSize((changes[STORAGE_KEYS.PENDING_EVENTS].newValue as any[] | undefined)?.length || 0);
      }
      if (changes[STORAGE_KEYS.TODAY_EVENTS_COUNT]) {
        setTodayCount((changes[STORAGE_KEYS.TODAY_EVENTS_COUNT].newValue as number) || 0);
      }
      if (changes[STORAGE_KEYS.DROPPED_EVENTS_COUNT]) {
        setDrops((changes[STORAGE_KEYS.DROPPED_EVENTS_COUNT].newValue as number) || 0);
      }
      if (changes[STORAGE_KEYS.FIRST_DROP_TIMESTAMP] !== undefined) {
        setDropTime((changes[STORAGE_KEYS.FIRST_DROP_TIMESTAMP].newValue as string) || null);
      }
      if (changes[STORAGE_KEYS.PURGED_EVENTS_COUNT]) {
        setPurged((changes[STORAGE_KEYS.PURGED_EVENTS_COUNT].newValue as number) || 0);
      }
      if (changes[STORAGE_KEYS.LAST_PURGE_TIMESTAMP] !== undefined) {
        setPurgeTime((changes[STORAGE_KEYS.LAST_PURGE_TIMESTAMP].newValue as string) || null);
      }
    };
    
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  const togglePause = async () => {
    const newStatus = status === 'active' ? 'paused' : 'active';
    await setMonitoringStatus(newStatus);
    setStatus(newStatus);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md border border-gray-200">
        <div>
          <h2 className="font-semibold text-lg">Monitoring Status</h2>
          <p className="text-sm text-gray-500">
            {status === 'active' 
              ? 'Agent is actively observing your browser.' 
              : 'Agent is paused. No events or screenshots are being captured.'}
          </p>
        </div>
        <button 
          onClick={togglePause}
          className={`px-4 py-2 rounded-md text-white font-medium shadow-sm transition-colors ${
            status === 'active' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {status === 'active' ? 'Pause Capture' : 'Resume Capture'}
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Today's Events</h3>
          <p className="text-3xl font-bold mt-2">{todayCount}</p>
        </div>
        <div className="p-4 border rounded-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Pending Buffer</h3>
          <p className="text-3xl font-bold mt-2">{bufferSize}</p>
          <p className="text-xs text-gray-400 mt-1">Waiting to sync to backend</p>
        </div>
      </div>
      
      {purged > 0 && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md">
          <h3 className="font-semibold text-emerald-700 flex items-center gap-2">
            🛡️ Excluded Activity Blocked
          </h3>
          <p className="text-emerald-700 mt-1 text-sm">
            <strong>{purged}</strong> buffered event(s) were purged before syncing because they
            matched your exclusion list (default or custom). This data never left your browser.
          </p>
          {purgeTime && (
            <p className="text-emerald-600 text-xs mt-2">
              Last purge: {new Date(purgeTime).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {drops > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="font-semibold text-red-700 flex items-center gap-2">
            ⚠️ Backend Unreachable (Buffer Overflow)
          </h3>
          <p className="text-red-600 mt-1 text-sm">
            The extension has dropped <strong>{drops}</strong> event(s) because the backend is offline.
          </p>
          {dropTime && (
            <p className="text-red-500 text-xs mt-2">
              Downtime started: {new Date(dropTime).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
