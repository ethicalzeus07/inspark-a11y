# Inspark AI-Powered Accessibility & UI/UX Testing Assistant

A Chrome (and compatible) browser extension paired with a FastAPI microservice that automates the discovery of accessibility issues and UI/UX anomalies in Inspark Online Courses, then surfaces context‑aware, AI‑powered recommendations for remediation.

---

## 🗂 Project Structure

```text
inspark-a11y-assistant/
├── extension/                     # Browser extension (Chrome/Edge/Firefox)
│   ├── assets/                    # Icons, images, and static assets
│   ├── public/                    # Public static files (manifest, CSS)
│   ├── src/                       # Extension source code
│   │   ├── api.js                 # HTTP client for AI microservice
│   │   ├── background.js          # Service worker: manages scans & messaging
│   │   ├── config.js              # Flags, endpoints, WCAG rules, templates
│   │   ├── content.js             # Injects axe-core, runs scans & highlights
│   │   ├── popup.html             # Popup UI markup (Tailwind CSS)
│   │   └── popup.js               # Controls popup interactions & display
│   ├── axe.min.js                 # Bundled axe-core v3.x for accessibility testing
│   └── manifest.json              # Chrome Manifest V3 configuration
│
└── microservice/                  # AI suggestion microservice
    ├── app/                       # FastAPI application
    │   ├── core/                  # Core logic & predefined suggestions (JSON)
    │   ├── models/                # Pydantic data models
    │   ├── routers/               # API route definitions
    │   └── main.py                # Application entrypoint
    ├── docs/                      # Architecture and API documentation
    ├── tests/                     # Pytest suite for endpoints and utilities
    └── requirements.txt           # Python dependencies
```

---

## ✨ Features

* **Quick Scan**: One‑click, instant WCAG 2.2 AA compliance checks on the current page.
* **Lesson Scan**: Multi‑screen traversal of course lessons, aggregating issues per page and tracking screen changes.
* **AI‑Powered Guidance**: Context‑aware suggestions for fixing accessibility and UI/UX issues, powered by a FastAPI microservice.
* **Inline Highlighting**: Hover and click to highlight problematic elements directly in the page.
* **Exportable Reports**: Generate shareable HTML or PDF reports for offline review or stakeholder presentation.
* **Session History**: Persist scan results locally for review across browser sessions.

---

## 🚀 Getting Started

### Prerequisites

* **Node.js & npm** (v14+)
* **Python 3.9+**
* **python-dotenv** (optional, for `.env` support when running without Docker)
* **Chrome/Edge/Firefox** with Manifest V3 support

### 1. Extension Setup

1. Clone or download this repo:

   ```bash
   git clone https://github.com/inspark/inspark-a11y-assistant.git
   cd inspark-a11y-assistant/extension
   ```
2. Install front‑end dependencies (if any):

   ```bash
   # e.g., for Tailwind or build scripts
   npm install
   npm run build
   ```
3. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/`).
4. Enable **Developer mode**, click **Load unpacked**, and select the `extension/` folder.
5. Ensure the extension icon appears in the toolbar.

### 2. Microservice Setup

1. In a new terminal, navigate to `microservice/`:

   ```bash
   cd inspark-a11y-assistant/microservice
   ```
2. Create and activate a virtual environment:

   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```
3. Install Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

---

## 🎯 Usage

1. Navigate to any Inspark course page in your browser.
2. Click the extension icon and choose **Quick Scan** or **Lesson Scan**.
3. Review detected issues in the popup panel.
4. Hover over an item to highlight its location on the page.
5. Click an issue to view detailed AI recommendations.
6. Use **Export** to download a comprehensive report as HTML or PDF.

---

## 🛠 Development

### Extension

* **Tech**: Vanilla JavaScript, Tailwind CSS, axe-core.
* **Responsibilities**:

  * `background.js`: Manages scan workflows and messaging.
  * `content.js`: Runs and collects axe-core results, screens transitions.
  * `popup.js` & `popup.html`: Renders UI, handles user interactions.
  * `config.js`: Centralizes feature flags, endpoints, and templates.

### Microservice

* **Tech**: FastAPI, Pydantic, Docker (future).
* **Responsibilities**:

  * `routers/`: Defines REST endpoints for suggestions.
  * `core/`: Houses static suggestion templates and prompt logic.
  * `models/`: Validates payloads and response schemas.
  * Caching layer to minimize redundant AI calls.

---

## 🧪 Testing

* **Extension**: Manual testing via browser devtools; unit tests for any pure JS modules.
* **Microservice**: Run `pytest` in `microservice/` directory.

```bash
cd microservice
pytest --cov=app
```

---

## ⚡ Running Without Docker

If you prefer to run the microservice locally without Docker, follow these steps using your system’s Python 3.9+ installation:

1. Open a terminal and navigate to the `microservice/` directory:

   ```bash
   cd inspark-a11y-assistant/microservice
   ```
2. Create and activate a virtual environment:

   ```bash
   python -m venv venv
   # Windows (PowerShell):
   venv/Scripts/activate
   # macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   # (Optionally) install python-dotenv for automatic loading of environment variables:
   pip install python-dotenv
   ```
4. Configure environment variables:

   * Create a `.env` file in the `microservice/` root (if you haven't already) with:

     ```ini
     MISTRAL_API_KEY=your_api_key_here
     ```
   * **Important:** Uvicorn does **not** read `.env` files by default. You have three options:

     * **Export variables in your shell** before starting the server:

       ```bash
       export MISTRAL_API_KEY=your_api_key_here
       ```
     * **Use the `--env-file` flag** with Uvicorn (requires Uvicorn ≥0.18):

       ```bash
       uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env
       ```
     * **Auto-load `.env` in code** by adding at the top of `app/main.py`:

       ```python
       from dotenv import load_dotenv
       load_dotenv()
       ```
5. Start the FastAPI server on port 8000:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

If you still see errors like `MISTRAL_API_KEY not set`, double-check that your environment variable is exported or correctly loaded via one of the methods above.

## 🚢 Docker Deployment

If you prefer to run the microservice in a Docker container, ensure your `.env` file (with `MISTRAL_API_KEY`, `OPENAI_API_KEY`, etc.) is located alongside `docker-compose.yml` at the project root (Docker Compose will automatically load it), then run:

```bash
docker-compose up --build
```

Alternatively, to build and run the container manually:

```bash
# From the project root
docker build -f Dockerfile -t inspark-a11y-microservice .
docker run --env-file .env -p 8000:8000 inspark-a11y-microservice
```

This maps port 8000 on the container to your host and loads environment variables from `.env`.

---

## 📜 License

This project is proprietary and confidential to Inspark Online Courses.

---

## 🔮 Next Steps

1. Finalize Docker and CI/CD pipelines for microservice.
2. Add automated end‑to‑end tests for extension workflows.
3. Implement PII detection and masking for scan reports.
4. Deploy backend to production environment with monitoring.
5. Integrate SSO for extension authentication.
