/**
 * background/index.ts — MV3 Service Worker
 * ─────────────────────────────────────────
 * CRITICAL RULE: this worker is evicted by Chrome whenever it idles.
 * - Never hold state in module-level variables that you expect to survive.
 * - chrome.storage.local is the only source of truth.
 * - chrome.alarms (not setInterval) drives periodic work — alarms survive eviction.
 *
 * Listener registration at module top level is fine — Chrome re-registers them
 * each time the worker wakes.
 */

import {
  getClientId,
  getMonitoringStatus,
  appendEvent,
  removeFlushedEvents,
  getBuffer,
  getExcludeList,
  getLastCaptureTimestamps,
  setLastCaptureTimestamp,
  getLastActivityTimestamps,
  setLastActivityTimestamp,
  setLastSyncTimestamp,
  getConsecutiveFailures,
  setConsecutiveFailures,
  resetDropTracking,
} from '../lib/storage';
import { isExcluded } from '../lib/excludeList';
import {
  buildNavEvent,
  buildClickEvent,
  buildScrollEvent,
  buildIdleEvent,
  buildScreenshotEvent,
} from '../lib/eventBuilders';
import { uploadScreenshot, postEventBatch } from '../lib/api';
import { ALARMS, TIMING, LIMITS } from '../lib/constants';
import type { ContentMessage, AgentEvent } from '../lib/types';

// ─── Lifecycle ────────────────────────────────────────────────────────────────

let isFlushing = false;

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[VAA] Extension installed/updated — bootstrapping.');
  await getClientId(); // Generates UUID on first install, no-op after
  await ensureAlarm();
  console.log('[VAA] Bootstrap complete.');
});

chrome.runtime.onStartup.addListener(async () => {
  // Worker woke due to browser start. Re-register alarms (they persist across
  // browser restarts but good to ensure).
  console.log('[VAA] Browser started — ensuring alarms are registered.');
  await ensureAlarm();
});

async function ensureAlarm(): Promise<void> {
  const flushAlarm = await chrome.alarms.get(ALARMS.BATCH_FLUSH);
  if (!flushAlarm) {
    chrome.alarms.create(ALARMS.BATCH_FLUSH, {
      periodInMinutes: TIMING.FLUSH_INTERVAL_MINUTES,
    });
  }
  
  const activityAlarm = await chrome.alarms.get(ALARMS.SUSTAINED_ACTIVITY);
  if (!activityAlarm) {
    chrome.alarms.create(ALARMS.SUSTAINED_ACTIVITY, {
      periodInMinutes: TIMING.SUSTAINED_ACTIVITY_INTERVAL_MINUTES,
    });
  }
}

// ─── Alarm handler ────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARMS.BATCH_FLUSH) {
    await flushBuffer();
  } else if (alarm.name === ALARMS.SUSTAINED_ACTIVITY) {
    await checkSustainedActivity();
  }
});

// ─── Tab / navigation listeners ───────────────────────────────────────────────

/** Fired when the user switches to a different tab. */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !tab.title) return;
    if (await shouldSkip(tab.url)) return;

    // Record activity
    await setLastActivityTimestamp(tabId, Date.now());

    // Tab switch always triggers a screenshot (subject to rate cap)
    await maybeCapture(tabId, tab.url, tab.title, 'tab-switch');
  } catch (err) {
    console.warn('[VAA] onActivated error:', err);
  }
});

/** Track previous URL per tab for accurate nav events. */
const prevUrlMap: Record<number, string> = {};

/** Fired when a tab's URL or title changes. */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only act when the tab has fully loaded a new URL
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || !tab.title) return;
  if (await shouldSkip(tab.url)) return;

  await setLastActivityTimestamp(tabId, Date.now());
});

/** Fired on real navigations (including SPA pushState via filter). */
chrome.webNavigation.onCommitted.addListener(async ({ tabId, url, transitionType }) => {
  // Ignore subframe navigations, prerender, etc.
  if (!url || url === 'about:blank') return;
  if (await shouldSkip(url)) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    const title = tab.title ?? '';
    const prevUrl = prevUrlMap[tabId];
    prevUrlMap[tabId] = url;

    await appendEvent(buildNavEvent({ tabId, url, title, prevUrl }));
    await setLastActivityTimestamp(tabId, Date.now());

    // Domain change on same tab → screenshot trigger
    const prevDomain = prevUrl ? new URL(prevUrl).hostname : '';
    const newDomain  = new URL(url).hostname;
    if (prevDomain !== newDomain) {
      await maybeCapture(tabId, url, title, 'domain-change');
    }
  } catch (err) {
    console.warn('[VAA] onCommitted error:', err);
  }
});

// ─── Idle detection ───────────────────────────────────────────────────────────

chrome.idle.setDetectionInterval(TIMING.IDLE_DETECTION_SECONDS);

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle' || state === 'locked') {
    // Get the current active tab to attach the idle event to
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url && tab.title && !(await shouldSkip(tab.url))) {
      await appendEvent(buildIdleEvent({
        tabId: tab.id,
        url: tab.url,
        title: tab.title,
        idleSeconds: TIMING.IDLE_DETECTION_SECONDS,
      }));
    }
    // Flush immediately on idle — user won't notice the network call
    await flushBuffer();
  }
});

// ─── Content script message handler ──────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: ContentMessage, sender, sendResponse) => {
    // Handle message asynchronously but return true to keep the channel open
    handleContentMessage(message, sender).catch(console.error);
    sendResponse({ ok: true }); // Fire-and-forget acknowledgement
    return false; // We've called sendResponse synchronously
  }
);

async function handleContentMessage(
  msg: ContentMessage,
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  if (await shouldSkip(msg.url)) return;

  // Content scripts can't know their own tab id, so they send -1. The real tab
  // id is only available here, on the receiving end, via the message sender.
  const tabId = sender.tab?.id ?? msg.tabId;

  switch (msg.type) {
    case 'CLICK':
      await appendEvent(buildClickEvent({
        tabId,
        url:         msg.url,
        title:       msg.title,
        clickTarget: msg.clickTarget,
      }));
      await setLastActivityTimestamp(tabId, Date.now());
      break;

    case 'SCROLL':
      await appendEvent(buildScrollEvent({
        tabId,
        url:       msg.url,
        title:     msg.title,
        scrollPct: msg.scrollPct,
      }));
      await setLastActivityTimestamp(tabId, Date.now());
      break;

    case 'FOCUS':
      // Focus events update activity timestamp but don't produce a stored event
      await setLastActivityTimestamp(tabId, Date.now());
      break;
  }
}

// ─── Screenshot capture (2.6 + 2.7) ──────────────────────────────────────────

/**
 * Attempt a screenshot capture for the given tab.
 * Guard conditions (rate limit, exclude list, monitoring pause) are checked first.
 * trigger is a human-readable label for log messages.
 */
async function maybeCapture(
  tabId: number,
  url: string,
  title: string,
  trigger: string,
): Promise<void> {
  // Rate cap: don't capture if we took a screenshot from this tab too recently
  const timestamps = await getLastCaptureTimestamps();
  const lastCapture = timestamps[tabId] ?? 0;
  if (Date.now() - lastCapture < TIMING.MIN_SCREENSHOT_INTERVAL_MS) {
    return; // Too soon — skip silently
  }

  try {
    // Get the active window to call captureVisibleTab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || activeTab.id !== tabId) return; // Tab is not currently visible

    // MVP scope: captures only the ACTIVE/VISIBLE tab via captureVisibleTab.
    // Background tab capture would require the Offscreen Document API — future work.
    const dataUrl: string = await chrome.tabs.captureVisibleTab({
      format: 'jpeg',
      quality: LIMITS.JPEG_QUALITY_NORMAL,
    });

    const blob = await compressIfNeeded(dataUrl, tabId);
    if (!blob) {
      console.warn(`[VAA] Screenshot compression failed for tab ${tabId}`);
      return;
    }

    console.log(`[VAA] Screenshot captured (${trigger}) for tab ${tabId} — uploading...`);
    await setLastCaptureTimestamp(tabId, Date.now());

    // Upload FIRST, then build and buffer the event with the returned ref
    const tempEventId = crypto.randomUUID();
    const screenshotRef = await uploadScreenshot(blob, tempEventId);

    if (!screenshotRef) {
      console.warn('[VAA] Screenshot upload failed — event not buffered.');
      return;
    }

    await appendEvent(buildScreenshotEvent({ tabId, url, title, screenshotRef }));
    console.log(`[VAA] Screenshot event buffered — ref: ${screenshotRef}`);
  } catch (err) {
    console.error('[VAA] maybeCapture error:', err);
  }
}

/**
 * Convert a data URL to a JPEG Blob, reducing quality if it exceeds MAX_SCREENSHOT_BYTES.
 * Uses OffscreenCanvas for resizing when needed (available in MV3 service workers).
 */
async function compressIfNeeded(dataUrl: string, _tabId: number): Promise<Blob | null> {
  try {
    // First pass: fetch directly from data URL (Vite build strips fetch, so use Response)
    const res = await fetch(dataUrl);
    let blob = await res.blob();

    if (blob.size <= LIMITS.MAX_SCREENSHOT_BYTES) return blob;

    // Second pass: lower quality
    const imageBitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;

    ctx.drawImage(imageBitmap, 0, 0);
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: LIMITS.JPEG_QUALITY_LOW / 100 });

    if (blob.size <= LIMITS.MAX_SCREENSHOT_BYTES) return blob;

    // Third pass: half resolution
    const scale = 0.6;
    const smallCanvas = new OffscreenCanvas(
      Math.round(imageBitmap.width * scale),
      Math.round(imageBitmap.height * scale),
    );
    const smallCtx = smallCanvas.getContext('2d');
    if (!smallCtx) return blob;
    smallCtx.drawImage(imageBitmap, 0, 0, smallCanvas.width, smallCanvas.height);
    blob = await smallCanvas.convertToBlob({ type: 'image/jpeg', quality: LIMITS.JPEG_QUALITY_LOW / 100 });

    return blob;
  } catch (err) {
    console.error('[VAA] compressIfNeeded error:', err);
    return null;
  }
}

// ─── Sustained activity check (alarm-driven) ──────────────────────────────────

/** Called every SUSTAINED_ACTIVITY_INTERVAL_MINUTES by the alarm. */
async function checkSustainedActivity(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !tab.title) return;
    if (await shouldSkip(tab.url)) return;

    const activityTs = await getLastActivityTimestamps();
    const lastActivity = activityTs[tab.id] ?? 0;
    const elapsed = Date.now() - lastActivity;

    // Only trigger if user has been active on this page for the min sustained window
    if (elapsed <= TIMING.SUSTAINED_ACTIVITY_MIN_MS) {
      await maybeCapture(tab.id, tab.url, tab.title, 'sustained-activity');
    }
  } catch (err) {
    console.warn('[VAA] sustainedActivity check error:', err);
  }
}

// ─── Batch flush (2.8) ────────────────────────────────────────────────────────

/**
 * Flush the pending event buffer to the backend.
 * Only trims the buffer AFTER a confirmed 2xx response.
 * If the backend is unreachable, the buffer is left intact for the next flush.
 */
async function flushBuffer(): Promise<void> {
  if (isFlushing) {
    console.log('[VAA] Flush already in progress — skipping.');
    return;
  }
  
  const buffer = await getBuffer();
  if (buffer.length === 0) return;

  isFlushing = true;
  try {
    console.log(`[VAA] Flushing ${buffer.length} events...`);
    const { success, accepted, rejected } = await postEventBatch(buffer);
    
    // We only tried to send up to MAX_BATCH_SIZE (handled inside postEventBatch)
    // Extract the event IDs of the exact batch that was just attempted
    const batchAttempted = buffer.slice(0, LIMITS.MAX_BATCH_SIZE);
    const sentEventIds = batchAttempted.map(e => e.eventId);

    let consecutiveFailures = await getConsecutiveFailures();

    if (success && (accepted > 0 || rejected > 0)) {
      // Remove exactly the events we attempted to send, completely avoiding the race condition
      // where new events were appended to the buffer while this fetch was hanging.
      await removeFlushedEvents(sentEventIds);
      
      const totalSent = accepted + rejected;
      await setLastSyncTimestamp(new Date().toISOString());
      console.log(`[VAA] Flushed ${totalSent} events (Accepted: ${accepted}, Rejected: ${rejected}).`);
      
      if (rejected > 0) {
        console.warn(`[VAA] ${rejected} events were rejected by the backend — check payload shape.`);
      }

      // Reset backoff & conditionally wipe drop tracking
      if (consecutiveFailures > 0) {
        await setConsecutiveFailures(0);
        
        // Only wipe the First Drop record if the buffer has truly recovered (is under the overflow cap)
        const remainingBuffer = await getBuffer();
        if (remainingBuffer.length < LIMITS.BUFFER_OVERFLOW_TRIM_AT) {
          await resetDropTracking();
        }
        
        // Restore default alarm interval (1 minute prod limit)
        chrome.alarms.create(ALARMS.BATCH_FLUSH, {
          periodInMinutes: TIMING.FLUSH_INTERVAL_MINUTES,
        });
      }
    } else {
      // Backend unreachable / failed
      consecutiveFailures = Math.min(consecutiveFailures + 1, 6); // cap at 6 (max backoff)
      await setConsecutiveFailures(consecutiveFailures);
      
      // Dynamic exponential backoff calculation (1m * 2^failures, max 15m)
      const backoffMinutes = Math.min(
        (TIMING.FLUSH_INTERVAL_MINUTES * Math.pow(2, consecutiveFailures)),
        15
      );
      
      chrome.alarms.create(ALARMS.BATCH_FLUSH, {
        periodInMinutes: backoffMinutes,
      });
      
      console.warn(`[VAA] Flush failed — backing off to ${backoffMinutes}m. Buffer retained.`);
    }
  } finally {
    isFlushing = false;
  }
}

// ─── Guard helper ─────────────────────────────────────────────────────────────

/**
 * Returns true if ANY of: monitoring is paused, URL is excluded, or URL is invalid.
 * Call this at the top of every event-producing code path.
 */
async function shouldSkip(url: string): Promise<boolean> {
  const status = await getMonitoringStatus();
  if (status !== 'active') return true;

  const customList = await getExcludeList();
  return isExcluded(url, customList);
}
