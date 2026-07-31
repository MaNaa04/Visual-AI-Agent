/**
 * lib/excludeList.ts
 * ──────────────────
 * Checked as the FIRST line of every capture path.
 * If isExcluded() returns true, no event is created, no screenshot is taken,
 * and no data leaves the browser for that URL.
 */

// ─── Default exclusion list (from PRIVACY.md) ─────────────────────────────────

const DEFAULT_EXCLUDED_DOMAINS: readonly string[] = [
  // Banking & Finance
  'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'citibank.com', 'capitalone.com',
  'usbank.com', 'ally.com', 'discover.com',
  'paypal.com', 'venmo.com', 'cashapp.com', 'zelle.com',
  'schwab.com', 'fidelity.com', 'vanguard.com', 'robinhood.com', 'etrade.com',
  // Password managers
  'lastpass.com', '1password.com', 'bitwarden.com', 'dashlane.com', 'keepass.info',
  'nordpass.com', 'keeper.io',
  // Payment
  'stripe.com', 'square.com', 'checkout.com', 'braintree.com', 'adyen.com',
  // Health & medical
  'mychart.com', 'webmd.com', 'healthgrades.com', 'zocdoc.com',
  'medlineplus.gov', 'mayoclinic.org',
];

/** Path segments that indicate an auth/OTP page — excluded regardless of domain. */
const EXCLUDED_PATH_PATTERNS: readonly string[] = [
  '/login', '/signin', '/sign-in', '/log-in',
  '/auth', '/oauth', '/sso',
  '/otp', '/verify', '/mfa', '/2fa', '/totp',
  '/password', '/reset-password', '/forgot-password',
];

/** TLD suffixes that indicate health domains. */
const EXCLUDED_TLDS: readonly string[] = ['.health', '.med', '.pharmacy'];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if the URL should be excluded from ALL capture (events + screenshots).
 * @param url        - Full URL of the tab.
 * @param customList - User-added domains from chrome.storage.local.
 */
export function isExcluded(url: string, customList: string[]): boolean {
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return true;
  if (url.startsWith('about:') || url.startsWith('edge://') || url.startsWith('brave://')) return true;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true; // Unparseable URL — exclude by default
  }

  const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const path     = parsed.pathname.toLowerCase();

  // 1. Domain match — exact or subdomain of excluded list
  const allDomains = [...DEFAULT_EXCLUDED_DOMAINS, ...customList];
  if (allDomains.some(d => hostname === d || hostname.endsWith('.' + d))) return true;

  // 2. TLD match (e.g. anything.health)
  if (EXCLUDED_TLDS.some(tld => hostname.endsWith(tld))) return true;

  // 3. Sensitive path segments
  if (EXCLUDED_PATH_PATTERNS.some(pattern => path.includes(pattern))) return true;

  return false;
}

/**
 * Extract eTLD+1 from a URL for the `domain` field on events.
 * Uses a simple last-two-parts heuristic — good enough for MVP.
 */
export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
  } catch {
    return '';
  }
}
