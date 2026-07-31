# Visual AI Agent — Project Specification

## 1. Value Proposition

> **"Automatically log and describe what I do in my browser."**

A Chrome extension that silently monitors the user's active browsing session, captures screenshots and interaction signals, classifies them with a vision LLM (Gemini 2.5 Flash), and stores structured activity history in a local MongoDB database — giving the user a searchable, AI-annotated record of everything they did in their browser.

---

## 2. Success Metrics

These numbers define "it works perfectly and the AI is accurate." The MVP is not done until all three are met.

| Metric | Target |
|---|---|
| Metadata accuracy | **≥ 95%** of events carry a correct domain, URL, and page title |
| Vision classification accuracy | **≥ 85%** match against manual spot-check on 30–50 real screenshots |
| Ingestion throughput with zero loss | Sustains **1 event/sec** with **zero dropped events** over a 100-event burst test |

---

## 3. Constraints

| Constraint | Value |
|---|---|
| LLM budget ceiling | **$10 / month** (Gemini 2.5 Flash Vision; perceptual-hash dedup expected to cut raw call volume by 70–90%) |
| Local disk budget for screenshots | **≤ 5 GB** (compressed JPEGs at ≤200 KB each; optional 30-day TTL to auto-clean) |
| Target timeline | MVP feature-complete within the assignment deadline |
| Deployment | Self-hosted on local machine / VM; no cloud DB for MVP |
| Privacy boundary | Screenshots and events **never leave the machine** except for the Gemini API call; excluded sites never reach it |

---

## 4. Consent & Privacy Note

This is a **self-monitoring personal agent** — the person who installs the extension monitors their *own* browser. Monitoring another person's browser without their explicit, informed consent is out of scope and ethically/legally prohibited.

Default privacy behaviors:
- The full exclude-list is maintained in `PRIVACY.md`.
- Excluded sites are blocked **before** any capture fires — no screenshot, no event.
- The user can pause monitoring at any time from the popup.
- The user can add custom domains to the exclude-list from the options page.

See `PRIVACY.md` for the default site exclusion list.
