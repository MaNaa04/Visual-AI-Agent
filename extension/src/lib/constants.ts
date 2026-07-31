// ─── Backend ───────────────────────────────────────────────────────────────────
export const API_BASE_URL = 'http://localhost:8000';

// ─── Chrome storage keys ───────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  PENDING_EVENTS:          'pendingEvents',
  CLIENT_ID:               'clientId',
  MONITORING_STATUS:       'monitoringStatus',
  LAST_SYNC_TIMESTAMP:     'lastSyncTimestamp',
  EXCLUDE_LIST:            'excludeList',
  TODAY_EVENTS_COUNT:      'todayEventsCount',
  TODAY_DATE:              'todayDate',
  LAST_CAPTURE_TIMESTAMPS: 'lastCaptureTimestamps',
  LAST_ACTIVITY_TIMESTAMPS:'lastActivityTimestamps',
  CONSECUTIVE_FAILURES:    'consecutiveFailures',
  DROPPED_EVENTS_COUNT:    'droppedEventsCount',
  FIRST_DROP_TIMESTAMP:    'firstDropTimestamp',
} as const;

// ─── Alarm names ───────────────────────────────────────────────────────────────
export const ALARMS = {
  BATCH_FLUSH:        'batchFlush',
  SUSTAINED_ACTIVITY: 'sustainedActivity',
} as const;

// ─── Timing ────────────────────────────────────────────────────────────────────
export const TIMING = {
  /** Alarm period for batch flush — chrome.alarms minimum is 1 min in prod. */
  FLUSH_INTERVAL_MINUTES: 1,               // 60 seconds
  /** Minimum gap between screenshots on the same tab, regardless of trigger source. */
  MIN_SCREENSHOT_INTERVAL_MS: 5_000,       // 5 s
  /** How often to check if the user has been active long enough to trigger a "sustained" screenshot. */
  SUSTAINED_ACTIVITY_INTERVAL_MINUTES: 0.5,// 30 s
  /** Inactivity threshold for chrome.idle. */
  IDLE_DETECTION_SECONDS: 60,
  /** Debounce for scroll events in content script. */
  SCROLL_DEBOUNCE_MS: 500,
  /** Debounce for click events in content script. */
  CLICK_DEBOUNCE_MS: 200,
  /** Minimum seconds of activity before a sustained-activity screenshot is triggered. */
  SUSTAINED_ACTIVITY_MIN_MS: 25_000,       // 25 s — slightly less than the check interval
} as const;

// ─── Size / batch limits ───────────────────────────────────────────────────────
export const LIMITS = {
  /** Maximum events per API batch POST. */
  MAX_BATCH_SIZE: 100,
  /** If the buffer grows beyond this (backend unreachable for a long time), drop the oldest. */
  BUFFER_OVERFLOW_TRIM_AT: 500,
  BUFFER_OVERFLOW_KEEP:    499,
  /** Screenshot JPEG size ceiling for the upload endpoint. */
  MAX_SCREENSHOT_BYTES: 200 * 1024,        // 200 KB
  JPEG_QUALITY_NORMAL: 70,
  JPEG_QUALITY_LOW:    40,
} as const;
