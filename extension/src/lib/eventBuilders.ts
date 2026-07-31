/**
 * lib/eventBuilders.ts
 * ─────────────────────
 * Factory functions that produce correctly-typed, schema-compliant event objects.
 * All timestamps are UTC ISO 8601. All eventIds are UUID v4.
 * Nothing here touches chrome APIs — pure data transformation, easy to unit test.
 */

import type { BehavioralEvent, ScreenshotEvent, EventStatus } from './types';
import { extractDomain } from './excludeList';

function now(): string {
  return new Date().toISOString();
}

function uuid(): string {
  return crypto.randomUUID();
}

// ─── Behavioral event builders ────────────────────────────────────────────────

export function buildNavEvent(params: {
  tabId: number;
  url: string;
  title: string;
  prevUrl?: string;
}): BehavioralEvent {
  return {
    eventId: uuid(),
    timestamp: now(),
    tabId: params.tabId,
    url: params.url,
    domain: extractDomain(params.url),
    title: params.title,
    eventType: 'nav',
    meta: params.prevUrl ? { prevUrl: params.prevUrl } : undefined,
  };
}

export function buildClickEvent(params: {
  tabId: number;
  url: string;
  title: string;
  clickTarget: string;
}): BehavioralEvent {
  return {
    eventId: uuid(),
    timestamp: now(),
    tabId: params.tabId,
    url: params.url,
    domain: extractDomain(params.url),
    title: params.title,
    eventType: 'click',
    meta: { clickTarget: params.clickTarget },
  };
}

export function buildScrollEvent(params: {
  tabId: number;
  url: string;
  title: string;
  scrollPct: number;
}): BehavioralEvent {
  return {
    eventId: uuid(),
    timestamp: now(),
    tabId: params.tabId,
    url: params.url,
    domain: extractDomain(params.url),
    title: params.title,
    eventType: 'scroll',
    meta: { scrollPct: Math.round(Math.max(0, Math.min(100, params.scrollPct))) },
  };
}

export function buildIdleEvent(params: {
  tabId: number;
  url: string;
  title: string;
  idleSeconds: number;
}): BehavioralEvent {
  return {
    eventId: uuid(),
    timestamp: now(),
    tabId: params.tabId,
    url: params.url,
    domain: extractDomain(params.url),
    title: params.title,
    eventType: 'idle',
    meta: { idleSeconds: params.idleSeconds },
  };
}

// ─── Screenshot event builder ─────────────────────────────────────────────────

export function buildScreenshotEvent(params: {
  tabId: number;
  url: string;
  title: string;
  screenshotRef: string;
  status?: EventStatus;
}): ScreenshotEvent {
  return {
    eventId: uuid(),
    timestamp: now(),
    tabId: params.tabId,
    url: params.url,
    domain: extractDomain(params.url),
    title: params.title,
    eventType: 'screenshot',
    screenshotRef: params.screenshotRef,
    status: params.status ?? 'pending',
  };
}
