# Visual AI Agent

A privacy-focused Chrome extension that monitors your browsing activity, captures screenshots at key moments, and uses AI vision models to classify what you're doing — all while keeping your data local until you choose to sync.

## Overview

Visual AI Agent runs in the background as a Manifest V3 Chrome extension. It captures behavioral events (navigation, clicks, scroll depth, idle periods) and screenshots triggered by tab switches, domain changes, and sustained activity. Screenshots are sent to a local FastAPI backend where Google Gemini (or Groq) vision models classify the content into app name, activity summary, tags, and confidence scores.

All event buffering and state management happens in the extension's `chrome.storage.local` — nothing leaves your browser until the periodic flush to your self-hosted backend.

## Key Features

| Feature | Description |
|---------|-------------|
| **Behavioral Event Capture** | Navigation, clicks, scroll depth, idle detection |
| **Smart Screenshots** | Captured on tab switch, domain change, sustained activity (rate-limited) |
| **AI Vision Classification** | Gemini 1.5 Flash / Groq Llama-3.2-90B-Vision for screenshot analysis |
| **Perceptual Deduplication** | pHash-based dedup prevents re-classifying visually identical screens |
| **Exclude List** | User-defined domain blocklist — events & screenshots never captured |
| **Privacy-First** | No cloud dependencies; backend runs locally or on your infrastructure |
| **MV3 Service Worker** | Event-driven, survives worker eviction via `chrome.alarms` |
| **React Popup/Options** | Minimal UI: status, pause/resume, today's count, last sync, settings link |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Content Script│  │ Background SW │  │   Popup / Options    │   │
│  │ (DOM signals) │──▶│ (orchestrator)│──▶│    (React + TS)      │   │
│  └──────────────┘  └──────┬────────┘  └──────────────────────┘   │
│                           │                                      │
│                    chrome.storage.local                          │
│                           │                                      │
│                    Periodic flush (alarm)                        │
└───────────────────────────┼──────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ /events/batch │  │/screenshots/ │  │   Vision Pipeline    │   │
│  │  (ingest)     │  │  /upload     │  │  (Gemini/Groq + pHash)│   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                           │                                      │
│                    MongoDB (events) + Redis (dedup cache)       │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js** 18+ (for extension build)
- **Python** 3.11+ (for backend)
- **MongoDB** 6+ (local or remote)
- **Redis** 7+ (local or remote)
- **Google AI API Key** (for Gemini) or **Groq API Key**

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, Redis URL, and API keys
```

Required `.env` variables:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=visual_ai_agent
REDIS_URL=redis://localhost:6379/0
GEMINI_API_KEY=your_gemini_key_here
# Or for Groq:
GROQ_API_KEY=your_groq_key_here
VISION_PROVIDER=gemini  # or "groq"
```

Start the backend:

```bash
# Development
uvicorn app.main:app --reload --port 8000

# Production (with Docker)
docker-compose up -d
```

### 2. Extension Setup

```bash
cd extension

# Install dependencies
npm install

# Development build (watches for changes)
npm run dev

# Production build
npm run build
```

Load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `extension/dist`

### 3. Verify Installation

- Click the extension icon → popup shows "Monitoring: Active"
- Visit any site → events appear in popup's "Events Today" counter
- Check backend health: `curl http://localhost:8000/health`

## Configuration

### Extension Constants (`extension/src/lib/constants.ts`)

| Constant | Default | Description |
|----------|---------|-------------|
| `FLUSH_INTERVAL_MINUTES` | 1 | How often to batch-flush events to backend |
| `MIN_SCREENSHOT_INTERVAL_MS` | 30,000 | Minimum time between screenshots per tab |
| `MAX_SCREENSHOT_BYTES` | 500 KB | Max upload size; auto-compresses if exceeded |
| `MAX_BATCH_SIZE` | 50 | Max events per flush request |
| `BUFFER_OVERFLOW_TRIM_AT` | 500 | Auto-trim buffer if it exceeds this |
| `SUSTAINED_ACTIVITY_INTERVAL_MINUTES` | 5 | Alarm interval for sustained-activity check |
| `SUSTAINED_ACTIVITY_MIN_MS` | 2 min | Min active time before sustained screenshot |

### Backend Configuration (`backend/app/config.py`)

| Setting | Env Var | Description |
|---------|---------|-------------|
| `MONGODB_URI` | `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | `MONGODB_DB` | Database name |
| `REDIS_URL` | `REDIS_URL` | Redis connection URL |
| `VISION_PROVIDER` | `VISION_PROVIDER` | `gemini` or `groq` |
| `GEMINI_API_KEY` | `GEMINI_API_KEY` | Google AI Studio key |
| `GROQ_API_KEY` | `GROQ_API_KEY` | Groq Cloud key |

## Usage

### Popup (Extension Icon Click)

- **Monitoring Status** — Green pulse = Active, Amber = Paused
- **Pause/Resume** — Toggles all event capture
- **Events Today** — Count of buffered events since midnight
- **Last Sync** — Timestamp of last successful backend flush
- **Blocked** — Shows count of events purged by exclude list (if > 0)
- **Settings** — Opens full options page

### Options Page (Right-click extension → Options)

Three tabs:

1. **Status** — Backend connection, buffer size, daily stats
2. **Exclude List** — Add/remove domains (e.g., `github.com`, `bank.example.com`)
3. **Privacy** — Data retention, export, and deletion controls

### Exclude List Behavior

- Matches exact domain or subdomain (e.g., `github.com` blocks `github.com` and `gist.github.com`)
- Changes take effect immediately — buffered events for newly-excluded domains are purged automatically
- Excluded domains never trigger screenshots or behavioral events

## API Reference

### Backend Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/events/batch` | Ingest batch of events (validates individually) |
| `POST` | `/api/screenshots/upload` | Upload screenshot JPEG (multipart/form-data) |
| `GET` | `/api/events` | Fetch recent events for debugging |
| `GET` | `/health` | Health check |

### Event Schema

```typescript
// Behavioral events
{ "eventType": "nav" | "click" | "scroll" | "idle", ... }

// Screenshot event
{ 
  "eventType": "screenshot",
  "screenshotRef": "data/screenshots/2026-08-01/uuid.jpg",
  "status": "pending" | "classified" | "failed_classification",
  "ai": { "app": "VS Code", "activitySummary": "Writing TypeScript", "tags": ["coding", "typescript"], "confidence": 0.92 }
}
```

## Development

### Project Structure

```
AI Chrome Extension/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routes
│   │   ├── models/        # Pydantic models
│   │   ├── services/      # Vision pipeline, dedup, retry
│   │   ├── main.py        # App entry point
│   │   ├── db.py          # MongoDB + Redis connections
│   │   └── config.py      # Settings via pydantic-settings
│   ├── tests/             # Pytest suite
│   ├── requirements.txt
│   └── docker-compose.yml
├── extension/
│   ├── src/
│   │   ├── background/    # MV3 service worker
│   │   ├── content/       # Content script (DOM signals)
│   │   ├── popup/         # React popup (5 UI elements)
│   │   ├── options/       # React options page (3 tabs)
│   │   └── lib/           # Shared types, storage, API, constants
│   ├── package.json
│   ├── vite.config.ts
│   └── manifest.json
└── README2.md
```

### Running Tests

**Backend:**

```bash
cd backend
pytest -v
```

**Extension:**

```bash
cd extension
npm run build  # TypeScript compile check
```

### Linting & Formatting

```bash
# Extension
cd extension
npx eslint src --ext ts,tsx
npx prettier --check src

# Backend
cd backend
ruff check .
black --check .
```

## Deployment

### Backend (Docker)

```bash
cd backend
docker-compose up -d --build
```

### Extension (Chrome Web Store)

```bash
cd extension
npm run build
# Upload extension/dist as ZIP to Chrome Web Store Developer Dashboard
```

For enterprise distribution, use [Chrome Enterprise policies](https://chromeenterprise.google/policies/) to force-install via `ExtensionInstallForcelist`.

## Privacy & Security

- **No telemetry** — zero analytics, no crash reporting
- **Local-first** — all buffering in `chrome.storage.local` (encrypted at rest by Chrome)
- **User-controlled sync** — only flushes to your backend when you run it
- **Exclude list** — sensitive domains (banking, health, etc.) never captured
- **No content scripts on excluded domains** — content script still loads but immediately returns if URL matches exclude list
- **Screenshot compression** — automatic quality/resolution reduction to stay under 500 KB

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make changes with tests
4. Run linting and tests locally
5. Submit a PR with a clear description

See `CONTRIBUTING.md` for detailed guidelines (code style, commit messages, PR process).

## License

MIT License — see `LICENSE` file for details.

## Support

- **Issues**: GitHub Issues for bugs and feature requests
- **Discussions**: GitHub Discussions for questions and ideas
- **Docs**: See `docs/` folder for detailed architecture and API docs

---

**Visual AI Agent** — Understand your digital behavior, privately.