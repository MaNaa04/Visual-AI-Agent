# Visual AI Agent

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/MaNaa04/Visual-AI-Agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python Version](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![React Version](https://img.shields.io/badge/react-19.2-blue.svg)](https://reactjs.org/)

## What the project does

Visual AI Agent is a powerful Chrome extension combined with a high-performance Python FastAPI backend. It leverages the Google Gemini Vision SDK to provide browser automation, context capture, and advanced visual AI insights directly within your web browsing experience.

## Why the project is useful

- **AI-Driven Automation**: Utilize advanced AI models (Gemini/Groq) to understand and interact with web contexts.
- **Visual Intelligence**: Captures and analyzes browser screenshots and states using state-of-the-art vision models.
- **Smart Deduplication**: Employs perceptual hashing to avoid processing duplicate visual states.
- **Modern Tech Stack**: Built with a fast React/Vite frontend extension and a scalable FastAPI + MongoDB backend.
- **Asynchronous Processing**: Background task queues (Redis/RQ) ensure the browser remains responsive while heavy AI tasks run asynchronously.

## How users can get started

### Prerequisites

- Node.js (v18+)
- Python (3.9+)
- MongoDB database
- Redis instance (optional for MVP, used for background task queue)
- API Keys for Google Gemini or Groq

### 1. Backend Setup (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up your environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to include your `MONGODB_URI`, `REDIS_URI`, and your chosen `GEMINI_API_KEY` or `GROQ_API_KEY`.
5. Start the backend server:
   ```bash
   uvicorn app.main:app --reload
   ```
   *(Alternatively, you can run the backend using Docker with `docker-compose up`)*

### 2. Extension Setup (Chrome)

1. Navigate to the extension directory:
   ```bash
   cd extension
   ```
2. Install the Node dependencies:
   ```bash
   npm install
   ```
3. Build the extension for production:
   ```bash
   npm run build
   ```
   *(For development, you can use `npm run dev`)*
4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** in the top right corner.
   - Click **Load unpacked** and select the `extension/dist` directory.

### Usage Example

Once the backend is running and the extension is loaded, click the Visual AI Agent icon in your Chrome toolbar. The extension will automatically connect to your local backend and begin providing visual AI insights based on your active tab's context.

## Where users can get help

- If you encounter a bug or have a feature request, please [open an issue](../../issues) on GitHub.
- Detailed API documentation can be found at `http://localhost:8000/docs` when running the backend locally.

## Who maintains and contributes

This project is actively maintained. We welcome contributions from developers of all skill levels!

- **Maintainer**: [@MaNaa04](https://github.com/MaNaa04)
- **Contributing**: Please read our [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.
