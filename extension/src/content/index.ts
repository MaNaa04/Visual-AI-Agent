/**
 * content/index.ts — Content Script
 * ──────────────────────────────────
 * Injected at document_idle on all URLs.
 * Captures DOM signals (click, scroll, input focus) and forwards them to the
 * background service worker via chrome.runtime.sendMessage.
 *
 * RULES:
 * - Never write to chrome.storage directly — background owns state.
 * - Debounce high-frequency events before sending.
 * - Keep this file small; no business logic lives here.
 */

import { TIMING } from '../lib/constants';
import type { ContentMessage } from '../lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function send(msg: ContentMessage): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    // Background worker may be sleeping — this is expected; MV3 will wake it.
  });
}

/** Simple debounce — returns a function that delays execution until after `ms` of silence. */
function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Get a concise CSS-selector-like descriptor of a DOM element. */
function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id  = el.id ? `#${el.id}` : '';
  const cls = el.classList.length > 0
    ? '.' + Array.from(el.classList).slice(0, 2).join('.')
    : '';
  const text = el.textContent?.trim().slice(0, 40) ?? '';
  return `${tag}${id}${cls}${text ? `[${text}]` : ''}`.slice(0, 80);
}

/** Current tab metadata — fetched lazily once per content script lifecycle. */
function meta() {
  return {
    tabId: -1, // Content scripts don't know their own tab ID; background infers it from sender
    url:   window.location.href,
    title: document.title,
  };
}

// ─── Click listener ───────────────────────────────────────────────────────────

const onClickDebounced = debounce((e: MouseEvent) => {
  const target = e.target as Element | null;
  if (!target) return;
  send({
    type:        'CLICK',
    clickTarget: describeElement(target),
    ...meta(),
  });
}, TIMING.CLICK_DEBOUNCE_MS);

document.addEventListener('click', onClickDebounced, { capture: true, passive: true });

// ─── Scroll listener ──────────────────────────────────────────────────────────

const onScrollDebounced = debounce(() => {
  const scrollTop    = window.scrollY;
  const docHeight    = document.documentElement.scrollHeight - window.innerHeight;
  const scrollPct    = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
  send({ type: 'SCROLL', scrollPct, ...meta() });
}, TIMING.SCROLL_DEBOUNCE_MS);

document.addEventListener('scroll', onScrollDebounced, { passive: true });

// ─── Input focus listener ─────────────────────────────────────────────────────
// Used only to update the activity timestamp in the background — no text is captured.

document.addEventListener('focusin', () => {
  const active = document.activeElement;
  const isInput = active instanceof HTMLInputElement ||
                  active instanceof HTMLTextAreaElement ||
                  (active instanceof HTMLElement && active.isContentEditable);
  if (isInput) {
    send({ type: 'FOCUS', ...meta() });
  }
}, { passive: true });

console.log('[VAA] Content script active on:', window.location.hostname);
