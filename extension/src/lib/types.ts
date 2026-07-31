// ─── Event primitives ──────────────────────────────────────────────────────────

export type MonitoringStatus = 'active' | 'paused';
export type EventStatus = 'pending' | 'classified' | 'failed_classification';

interface EventBase {
  eventId: string;   // UUID v4 — generated at event creation time
  timestamp: string; // ISO 8601 UTC
  tabId: number;
  url: string;
  domain: string;    // eTLD+1 (e.g. "github.com")
  title: string;     // document.title
}

export interface BehavioralEventMeta {
  clickTarget?: string;  // CSS selector/tag of clicked element
  scrollPct?: number;    // 0–100 scroll depth
  idleSeconds?: number;  // seconds idle before event fired
  prevUrl?: string;      // previous URL (nav events)
}

export interface BehavioralEvent extends EventBase {
  eventType: 'nav' | 'click' | 'scroll' | 'idle';
  meta?: BehavioralEventMeta;
}

export interface AIResult {
  app: string;
  activitySummary: string;
  tags: string[];
  confidence: number; // 0.0–1.0
}

export interface ScreenshotEvent extends EventBase {
  eventType: 'screenshot';
  screenshotRef: string; // relative path returned by backend upload endpoint
  status: EventStatus;
  ai?: AIResult;
}

export type AgentEvent = BehavioralEvent | ScreenshotEvent;

// ─── Chrome storage schema ─────────────────────────────────────────────────────
// All runtime state lives here — never in memory (MV3 worker eviction).

export interface StorageSchema {
  pendingEvents: AgentEvent[];
  clientId: string;
  monitoringStatus: MonitoringStatus;
  lastSyncTimestamp: string | null;
  excludeList: string[];             // user-added custom domains
  todayEventsCount: number;
  todayDate: string;                 // YYYY-MM-DD to detect day boundary
  lastCaptureTimestamps: Record<number, number>; // tabId → epoch ms
  lastActivityTimestamps: Record<number, number>; // tabId → epoch ms (for sustained-activity trigger)
}

// ─── Content script → background message protocol ─────────────────────────────

export type ContentMessage =
  | { type: 'CLICK';  tabId: number; url: string; title: string; clickTarget: string }
  | { type: 'SCROLL'; tabId: number; url: string; title: string; scrollPct: number }
  | { type: 'FOCUS';  tabId: number; url: string; title: string };
