/**
 * lib/api.ts
 * ──────────
 * HTTP client for the backend. Two operations only for Phase 2/3:
 *   1. uploadScreenshot  — POST /api/screenshots/upload (multipart)
 *   2. postEventBatch    — POST /api/events/batch (JSON array)
 *
 * Design rule: never clear the local buffer until we receive 2xx.
 * Callers own the retry decision; this module only returns success/failure.
 */

import { API_BASE_URL, LIMITS } from './constants';
import type { AgentEvent } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getClientId(): Promise<string> {
  // Avoid circular import with storage.ts by reading directly here.
  const result = await chrome.storage.local.get('clientId');
  return (result['clientId'] as string) ?? 'unknown';
}

function authHeaders(clientId: string): Record<string, string> {
  return { 'X-Client-ID': clientId };
}

// ─── Screenshot upload ────────────────────────────────────────────────────────

/**
 * Upload a compressed JPEG blob to the backend.
 * Returns the screenshotRef path on success, null on failure.
 */
export async function uploadScreenshot(
  blob: Blob,
  eventId: string,
): Promise<string | null> {
  try {
    const clientId = await getClientId();
    const form = new FormData();
    form.append('file', blob, `${eventId}.jpg`);
    form.append('eventId', eventId);

    const res = await fetch(`${API_BASE_URL}/api/screenshots/upload`, {
      method: 'POST',
      headers: authHeaders(clientId),
      body: form,
    });

    if (!res.ok) {
      console.error(`[VAA] Screenshot upload failed: ${res.status}`, await res.text());
      return null;
    }

    const json = (await res.json()) as { screenshotRef: string };
    return json.screenshotRef;
  } catch (err) {
    console.error('[VAA] Screenshot upload error:', err);
    return null;
  }
}

// ─── Event batch POST ─────────────────────────────────────────────────────────

export interface BatchResult {
  success: boolean;
  sentCount: number;
}

/**
 * POST a batch of events to the backend.
 * Sends at most MAX_BATCH_SIZE events per call.
 * Returns { success: true, sentCount: N } on 2xx, { success: false, sentCount: 0 } otherwise.
 */
export async function postEventBatch(events: AgentEvent[]): Promise<BatchResult> {
  if (events.length === 0) return { success: true, sentCount: 0 };

  const batch = events.slice(0, LIMITS.MAX_BATCH_SIZE);

  try {
    const clientId = await getClientId();
    const res = await fetch(`${API_BASE_URL}/api/events/batch`, {
      method: 'POST',
      headers: { ...authHeaders(clientId), 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      console.error(`[VAA] Batch POST failed: ${res.status}`, await res.text());
      return { success: false, sentCount: 0 };
    }

    return { success: true, sentCount: batch.length };
  } catch (err) {
    console.error('[VAA] Batch POST error (backend unreachable?):', err);
    return { success: false, sentCount: 0 };
  }
}
