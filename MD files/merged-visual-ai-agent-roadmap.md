# Visual AI Browser Agent — MVP Implementation Plan

A Chrome extension that captures your browsing activity, classifies screenshots with a vision LLM, and stores structured activity history. This plan is deliberately scoped to a **lean, bug-free, highly accurate MVP** — capture browser activity → process it with AI → store it. Anything that adds complexity without serving that core goal is explicitly out of scope.

> **Scope assumption:** this is a **self-monitoring personal agent** — the installer monitors their *own* browser. Monitoring other people would require revisiting the consent/legal notes in Phase 1 and Phase 6.

---

## Guiding Principle: Correctness First

The single goal of this MVP is **"it works perfectly and the AI is accurate."** Every decision below favors reliability and accuracy over features. If a component doesn't make the core loop (capture → AI → store) more correct, it's cut.

---

## Final Tech Stack

| Layer | Technology | Why this choice |
|---|---|---|
| Extension | Manifest V3 + TypeScript + React + Vite (`@crxjs/vite-plugin`) | Modern, MV3-aware bundling; React for popup/options. **Stick with this — it is perfectly fine for this project; no need to switch to WXT.** |
| Extension UI state | Zustand | Lightweight, no boilerplate |
| Styling | Tailwind CSS | Fast, consistent UI |
| Backend | **FastAPI (Python 3.11+)** | Least boilerplate, native async, pairs cleanly with vision SDKs |
| Async processing | FastAPI async + a lightweight worker (Redis + RQ) | Decouples slow vision calls from ingestion, without the weight of Kafka |
| Vision AI | **Gemini 2.5 Flash Vision** | Cheapest high-quality option — directly controls per-screenshot cost. **Rough estimate: ~$0.00015/image at normal resolution → ~$0.54/hr at 1 screenshot/sec, but with perceptual-hash dedup eliminating ~70–90% of duplicate frames (reading, not acting), real cost drops to roughly $0.05–$0.15/hr of active browsing.** Budget ceiling should be set in Phase 1.3. |
| Database | **MongoDB** | Document model fits activity events cleanly; AI tags/summary stored inline as arrays — no relational join tables needed for the MVP |
| Image storage | Local disk; **metadata + reference only in MongoDB** | Privacy-first, simplest possible for MVP |
| Deployment | Docker (built only at deploy time) → self-host | Local dev stays fast; containerize once stable |

**Deliberately not used:** Kafka, Spring Boot, PostgreSQL/pgvector, and an embedding pipeline. They are over-engineered for ~1 event/sec personal scale and don't serve the core capture→AI→store loop.

---

## Explicitly Out of Scope (do NOT build for the MVP)

These are fine engineering practices but add complexity without advancing a correct, accurate MVP. They are intentionally excluded:

- Semantic / vector search (pgvector, embeddings, natural-language query)
- Retrieval API and analytics dashboard / timeline UI
- Server-Sent Events / live activity stream
- Audit logging, API-key rotation, encryption at rest
- Data export/delete system, automatic retention/cleanup jobs
- Dead-letter queue (simple bounded retry is enough)
- Advanced backpressure / rate limiting
- Redis *classification result* cache (perceptual-hash dedup stays; caching can wait until API cost is a real problem)
- OCR-based PII redaction (an exclude-list for sensitive sites gives most of the benefit)
- Separate `sessions` and `tags` collections/tables (store tags inline as an array)
- Full observability / monitoring stack (application logs are enough)
- GitHub Actions CI/CD, Docker during initial development

If any of these become genuinely necessary later, they can be added — but not at the cost of shipping a working, accurate MVP first.

---

## Roadmap Overview (8 Phases)

| Phase | Focus |
|---|---|
| 1 | Project Setup — spec, contracts, environment |
| 2 | Chrome Extension — capture layer |
| 3 | Backend API — ingestion + async pipeline |
| 4 | AI Vision Pipeline — classification + dedup |
| 5 | Data Storage — MongoDB |
| 6 | Basic Security & Privacy |
| 7 | Testing — correctness & accuracy focus |
| 8 | Deployment |

---

## Phase 1 — Project Setup

Lock the scope and the extension↔backend contract before writing feature code. Everything downstream depends on the event shape.

- [ ] **1.1 One-sentence value prop.** e.g. *"Automatically log and describe what I do in my browser."*
- [ ] **1.2 Success metrics** (these define "accurate as hell"):
  - 95%+ of events carry correct domain/URL/title.
  - Vision classification matches manual spot-check **85%+** on a 30–50 sample set.
  - Ingestion handles 1 event/sec sustained with **zero event loss**.
- [ ] **1.3 Constraints** — LLM budget ceiling ($/month), local storage ceiling, timeline.
- [ ] **1.4 Consent/privacy note** — default exclusions (banking, password managers, payment/OTP, health). Keep it short; a `PRIVACY.md` is enough.
- [ ] **1.5 Event schema** — two document shapes; freeze both now:

  **Behavioral Event** (`nav`, `click`, `scroll`, `idle`) — no AI fields:
  ```json
  {
    "eventId": "uuid",
    "timestamp": "ISO8601",
    "tabId": 0,
    "url": "string",
    "domain": "string",
    "title": "string",
    "eventType": "nav | click | scroll | idle",
    "meta": { "clickTarget": "...", "scrollPct": 0, "idleSeconds": 0 }
  }
  ```

  **Screenshot Event** — includes AI result fields after processing:
  ```json
  {
    "eventId": "uuid",
    "timestamp": "ISO8601",
    "tabId": 0,
    "url": "string",
    "domain": "string",
    "title": "string",
    "eventType": "screenshot",
    "screenshotRef": "string",
    "ai": { "app": "", "activitySummary": "", "tags": [], "confidence": 0.0 },
    "status": "classified | pending | failed_classification"
  }
  ```
  Do **not** force an `ai` field onto behavioral events — keep the two shapes clean.

- [ ] **1.6 API contract** — two endpoints; document both:
  - `POST /api/events/batch` — batched behavioral events array + `X-Client-ID` header.
  - `POST /api/screenshots/upload` — `multipart/form-data` with the compressed image; returns `{ "screenshotRef": "<path>" }`. The extension stores this ref and sends it with the screenshot event.
- [ ] **1.7 Repo structure** — monorepo with `/extension` and `/backend`. Pick once, don't revisit.
- [ ] **1.8 Backend init** — FastAPI + Uvicorn, Pydantic v2 (validation), `motor`/`pymongo` (MongoDB), `redis` + `rq` (worker), `google-generativeai` (Gemini).
- [ ] **1.9 Extension tooling** — TypeScript + Vite + `@crxjs/vite-plugin`, React, Tailwind, Zustand, ESLint + Prettier.
- [ ] **1.10 Local infra** — run MongoDB + Redis locally (native install or a single `docker-compose` for just those two services). No app containers yet.

**Deliverables:** `PROJECT_SPEC.md`, `PRIVACY.md`, `event-schema.json`, `api-contract.md`; both sides build clean on a fresh clone.

---

## Phase 2 — Chrome Extension: Capture Layer

Build this **before** the AI — it's the cheapest, highest-accuracy part, and correct event capture is the foundation of accuracy.

- [ ] **2.1 `manifest.json`** — MV3; permissions: `tabs`, `activeTab`, `scripting`, `storage`, `idle`, `webNavigation`; `host_permissions: ["<all_urls>"]`.
- [ ] **2.2 Background service worker** — **MV3 workers get evicted when idle; never hold state in memory.** Use `chrome.storage.local` as the source of truth. Getting this right is the #1 source of "lost events" bugs.
- [ ] **2.3 Content script** — DOM signals: clicks, debounced scroll, input focus. Inject on `document_idle`.
- [ ] **2.4 Tab/navigation listeners** — `chrome.tabs.onActivated`, `chrome.tabs.onUpdated`, `chrome.webNavigation.onCommitted`.
- [ ] **2.5 Idle detection** — `chrome.idle.onStateChanged`, ~60s threshold.
- [ ] **2.6 Screenshot trigger** — `chrome.tabs.captureVisibleTab`, fired only on tab switch, new domain, or sustained activity after N seconds. Rate-cap well under Chrome's ~2/sec/tab limit. **Scope decision: this MVP captures only the currently active/visible tab. Background tabs are out of scope.** If background capture is needed later, revisit with the Offscreen Document API — do not attempt it now.
- [ ] **2.7 Image compression + upload flow** — resize/compress the screenshot in the extension (target: ≤200 KB JPEG). Upload via `POST /api/screenshots/upload` (`multipart/form-data`) immediately after capture; backend saves to `data/screenshots/` and returns `{ "screenshotRef": "<path>" }`. Store the ref, then include it in the screenshot event batch. This decouples binary upload from event batching.
- [ ] **2.8 Local buffering + batch flush** — accumulate behavioral events in `chrome.storage.local`, flush every 10–15s or on idle. Batched POSTs keep the backend simple. Screenshot events are flushed after the upload ref is received.
- [ ] **2.9 Popup UI** — React popup showing exactly: **Monitoring Status (ON/OFF indicator)**, **Pause/Resume button**, **Today's Events Count**, **Last Sync Time**, **Settings shortcut** (opens options page). Keep it to these five elements — no activity feed in the popup for MVP.
- [ ] **2.10 Exclude-list enforcement** — checked *before* any capture fires. Ship sensible defaults (banking, password managers, payment/OTP).
- [ ] **2.11 Pause/resume** — stored locally, respected by every capture path.

**Definition of done:** load unpacked, browse 30 min, every tab switch/click/screenshot trigger appears in local storage with the correct shape — zero backend involved. Close and reopen Chrome mid-session and confirm no buffered events are lost.

---

## Phase 3 — Backend API: Ingestion Pipeline

- [ ] **3.1 `POST /api/events/batch`** — accepts the batched array, validates every event against the schema (Pydantic). Reject malformed batches loudly, never silently.
- [ ] **3.2 Auth + client identity** — on first install, the extension generates a UUID (`crypto.randomUUID()`), stores it in `chrome.storage.local`, and sends it as the `X-Client-ID` header on every request. No provisioning flow or backend key-issuance needed for MVP. Backend validates header presence; unknown IDs are logged, not rejected (personal tool).
- [ ] **3.3 Screenshot upload endpoint** — `POST /api/screenshots/upload` accepts `multipart/form-data`, saves the image to `data/screenshots/<date>/<uuid>.jpg`, returns `{ "screenshotRef": "<relative-path>" }`. Directory is created if missing.
- [ ] **3.4 Enqueue work** — behavioral events (`nav`, `click`, `scroll`, `idle`) → persist directly to MongoDB; `screenshot` events → **use FastAPI `BackgroundTasks`** for async vision processing. This avoids running a Redis + RQ worker process for MVP. If throughput later demands it, swap to Redis + RQ without touching the rest of the stack.
- [ ] **3.5 Worker consumer** — `BackgroundTasks` function runs the Phase 4 pipeline and writes AI results back to the event document.
- [ ] **3.6 Bounded retry** — a failed vision job retries a fixed number of times (e.g., 3), then the event is stored with `status: "failed_classification"` so it's visible, never lost. (No full DLQ needed — just don't drop data.)

**Deliverable:** events flow end-to-end into MongoDB/queue; nothing lost under a 100+ event burst.

---

## Phase 4 — AI Vision Pipeline

The one place where "fast," "cheap," and "accurate" trade off — this phase is where accuracy is won or lost.

- [ ] **4.1 Vision client** — async Gemini 2.5 Flash Vision client.
- [ ] **4.2 Prompt design** — force structured JSON output and validate it:
  ```json
  { "app": "", "activitySummary": "", "tags": [], "confidence": 0.0 }
  ```
  Reject/repair malformed model output; store `confidence` so low-confidence results are flagged, not trusted blindly.
- [ ] **4.3 Screenshot dedup via perceptual hashing** *before* the LLM call — near-identical consecutive frames (reading, not acting) must not each cost an API call. **This is the single biggest lever on cost and speed.**
- [ ] **4.4 Retry mechanism** — on LLM failure, retry with backoff (bounded, per 3.5); on final failure, store `status: "failed_classification"`.
- [ ] **4.5 Accuracy loop** — log the model's raw response alongside the parsed result during development so misclassifications are diagnosable.

**Deliverable:** a screenshot event in → structured activity JSON in the DB, with dedup measurably cutting API calls (log before/after counts).

**Accuracy check:** manually spot-check 30–50 classifications against the Phase 1.2 target (85%+). Tune the prompt until you hit it — this is the core "accurate as hell" gate.

---

## Phase 5 — Data Storage: MongoDB

- [ ] **5.1 Collections** — a single `events` collection is enough. Each document is one activity event; AI **tags and summary are stored inline as fields/arrays** (no separate tags/sessions collections).
- [ ] **5.2 Document shapes** — two clean shapes in the `events` collection; do not force `ai`/`screenshotRef` onto behavioral events:

  **Behavioral event document:**
  ```json
  {
    "eventId": "uuid",
    "timestamp": "ISO8601",
    "domain": "string",
    "url": "string",
    "title": "string",
    "eventType": "nav | click | scroll | idle",
    "meta": { "clickTarget": "...", "scrollPct": 0, "idleSeconds": 0 }
  }
  ```

  **Screenshot event document:**
  ```json
  {
    "eventId": "uuid",
    "timestamp": "ISO8601",
    "domain": "string",
    "url": "string",
    "title": "string",
    "eventType": "screenshot",
    "screenshotRef": "data/screenshots/<date>/<uuid>.jpg",
    "ai": { "app": "", "activitySummary": "", "tags": [], "confidence": 0.0 },
    "status": "classified | pending | failed_classification"
  }
  ```
- [ ] **5.3 Screenshot storage** — local disk; store only the file path/reference in the document.
- [ ] **5.4 Indexes** — on `timestamp`, `domain`, and `ai.tags` (multikey) for fast lookups.
- [ ] **5.5 TTL index (optional)** — if automatic cleanup is desired, add a 30-day TTL index on `timestamp` (`db.events.createIndex({ timestamp: 1 }, { expireAfterSeconds: 2592000 })`). Skip if you prefer to manage retention manually; it can always be added later.

**Deliverable:** classified events persist correctly and are queryable by day, domain, and tag directly in MongoDB.

---

## Phase 6 — Basic Security & Privacy

Just enough to be responsible — nothing enterprise-grade.

- [ ] **6.1 Auth** — API key required on every endpoint; HTTPS in any hosted setup; secrets in env vars only (never committed).
- [ ] **6.2 Exclude-list** — verified to be enforced in the extension *before* capture (from 2.10). This is the primary privacy control.
- [ ] **6.3 Local-only by default** — screenshots stay on disk; nothing leaves the machine beyond the Gemini API call for classification, and excluded sites never reach it.

---

## Phase 7 — Testing (Correctness & Accuracy Focus)

This phase is where "no bugs" is proven.

- [ ] **7.1 Unit tests** — **Backend:** `pytest` + `pytest-asyncio`; mock Gemini API responses with `unittest.mock` (never hit the real API in tests). **Extension:** `Vitest` + `@testing-library/react`. Cover: event validation, perceptual-hash dedup logic, AI-response parsing/repair, UUID generation, exclude-list matching.
- [ ] **7.2 Integration test** — full loop: extension batch → ingestion → queue → worker → MongoDB.
- [ ] **7.3 Extension test matrix** — 10+ real sites; **explicitly test MV3 service-worker eviction** (close/reopen Chrome mid-session, confirm zero event loss); verify exclude-list and pause/resume actually block capture.
- [ ] **7.4 Failure cases** — internet disconnected (events buffer and flush later), AI unavailable (retry then `failed_classification`), DB unavailable.
- [ ] **7.5 Accuracy verification** — re-run the 30–50 sample spot-check; confirm 85%+ against the Phase 1.2 target before calling it done.
- [ ] **7.6 Burst test** — fire 100+ events quickly; confirm no loss and acceptable latency.

**Definition of done:** every test above passes, and the accuracy target is met on real browsing.

---

## Phase 8 — Deployment

- [ ] **8.1 Dockerize** — now (not before) containerize the backend API + worker.
- [ ] **8.2 Deploy** — self-host first (your machine/VM) given the privacy angle; MongoDB + Redis alongside it. Move to a managed host only if needed.
- [ ] **8.3 Repository cleanup** — clean folder structure, remove debug logs and unused files, and a `README` covering: overview, setup, env vars, architecture diagram, screenshots, optional demo GIF.

---

## Final Deliverables

- Working Chrome Extension (capture + consent UI + exclude-list + pause/resume)
- FastAPI backend with async Gemini vision pipeline and dedup-driven cost control
- MongoDB storage with AI tags/summary stored inline
- Passing test suite proving zero event loss and 85%+ classification accuracy
- Deployed backend (self-hosted)
- Clean GitHub repository + README + privacy policy
