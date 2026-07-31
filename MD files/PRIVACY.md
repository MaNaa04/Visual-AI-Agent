# Privacy Policy — Visual AI Browser Agent

This extension is a **self-monitoring personal tool**. It captures your own browsing activity on your own machine. No data is shared with third parties except for the Gemini Vision API call used to classify screenshots (see below).

---

## What Is Captured

- **Page metadata:** URL, domain, page title, tab ID
- **Interaction signals:** tab switches, navigation events, clicks (target element), scroll percentage, idle state
- **Screenshots:** compressed JPEG of the active/visible tab only (background tabs are never captured)

## What Is NOT Captured

- Keystrokes, form field values, or passwords — ever
- Any content from excluded domains (see list below)
- Background tabs
- Anything when monitoring is paused

---

## Where Data Goes

| Data | Destination |
|---|---|
| Page metadata + interaction events | Local MongoDB (your machine only) |
| Screenshots | Local disk — `backend/data/screenshots/` (your machine only) |
| Screenshot image (for AI classification) | Sent to **Google Gemini 2.5 Flash Vision API** for analysis, then discarded by Google per their API data policy |
| AI classification result | Stored locally in MongoDB alongside the event |

No data is sent to any server other than the Gemini API. No analytics, no telemetry.

---

## Default Excluded Domains

Capture is **completely blocked** on these domains — no screenshot, no event, no metadata. Nothing fires.

### Banking & Finance
- `chase.com`, `bankofamerica.com`, `wellsfargo.com`, `citibank.com`, `capitalone.com`
- `paypal.com`, `venmo.com`, `cashapp.com`, `zelle.com`
- `schwab.com`, `fidelity.com`, `vanguard.com`, `robinhood.com`

### Password Managers
- `lastpass.com`, `1password.com`, `bitwarden.com`, `dashlane.com`, `keepass.info`
- `keychain` (local macOS, not applicable to browser but noted)

### Payment & OTP
- `stripe.com`, `square.com`, `checkout.com`
- Any page with `/otp`, `/verify`, `/mfa`, `/2fa` in the path (pattern-matched)

### Health & Medical
- `mychart.com`, `webmd.com`, `healthgrades.com`, `zocdoc.com`
- Any domain ending in `.health`, `.med`

### Authentication Pages
- Any page with `/login`, `/signin`, `/auth`, `/oauth`, `/sso` in the path (pattern-matched)

---

## User Controls

- **Pause/Resume** — toggle from the popup at any time; takes effect immediately
- **Custom exclude-list** — add any domain from the options page; stored in `chrome.storage.local`
- **Data retention** — screenshots and events remain on your machine indefinitely unless you enable the optional 30-day TTL index or manually delete `backend/data/screenshots/`

---

## Gemini API Data Usage

Screenshot images are sent to Google's Gemini API for classification. Google's standard API data policy applies. Images are **not** stored in your MongoDB — only the classification result (app name, activity summary, tags, confidence score) is stored. Excluded-site screenshots are **never** sent to the API.
