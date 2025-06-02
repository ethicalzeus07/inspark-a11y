# Inspark AI-Powered Accessibility & UI/UX Testing Assistant

![Inspark Logo](https://user-images.githubusercontent.com/your-placeholder/logo.png)

> "Scan course content. Spot accessibility issues. Get AI-powered fixes."

This project is a Chrome extension and AI backend that helps testers identify and fix accessibility + UI/UX problems across Inspark online courses. Built with FastAPI, axe-core, and DeepSeek AI.

---

## 📁 Project Structure

```bash
inspark-a11y-assistant/
├── extension/             # Browser extension
│   ├── axe.min.js         # Accessibility engine (axe-core)
│   ├── popup.html         # Tailwind-based popup UI
│   └── src/
│       ├── api.js         # API bridge
│       ├── background.js  # Service worker
│       ├── config.js      # Environment + defaults
│       ├── content.js     # Axe scan + UI/UX metrics
│       └── popup.js       # UI logic
│
└── microservice/          # AI Suggestion backend
    ├── app/
    │   ├── main.py        # FastAPI app (AI + rules)
    │   └── core/suggestions.json  # Predefined fallback text
    ├── requirements.txt
    └── docker-compose.yml
```

---

## ✨ Features

* One-click WCAG 2.2 A/AA scan (via axe-core)
* Detects real UI/UX issues:

  * Touch targets < 44x44px
  * Body text < 16px
  * Viewport overflow
  * CLS, LCP, INP (via web-vitals)
* AI-powered suggestions via OpenRouter / DeepSeek (Mistral 7B)
* Supports **multiple API keys** (auto fallback)
* Popup UI: filter, preview, export, and highlight
* Offline HTML report export

---

## 🚀 Quick Start

### 🔌 Install the Extension

1. Visit `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select `extension/`
4. The extension icon will appear

### 🧠 Start the AI Microservice

```bash
cd microservice/
python -m venv venv
source venv/bin/activate     # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Create a `.env` file with your API key(s):

```env
OPENROUTER_API_KEY=key1,key2,key3
```

---

## 🧪 How It Works

![Scan Demo](https://user-images.githubusercontent.com/your-placeholder/scan-demo.gif)

1. Visit any course page
2. Click the **Inspark A11y** icon
3. Click **Scan** → gets a11y + UI/UX results
4. Hover = highlight element
5. Click = see full details + AI fix
6. Export = save full HTML report

---

## 🧰 Tech Stack

| Layer          | Stack Used                        |
| -------------- | --------------------------------- |
| Extension      | JS, Tailwind, Chrome APIs         |
| A11y Engine    | `axe-core`                        |
| UX Metrics     | `web-vitals` (CLS, INP, LCP)      |
| AI Suggestions | FastAPI + OpenRouter (Mistral 7B) |

---

## 🔐 Security

* PII redaction placeholder (`detect_and_redact_pii()`)
* No raw HTML or DOM leaks to external APIs
* API key rotation prevents burnouts

---

## 🛠 Next Improvements

* [ ] PDF export with branding
* [ ] Smart screenshots (DOM highlight)
* [ ] Local AI fallback (e.g., Mistral via Ollama)
* [ ] Global scan aggregation dashboard

---

## 📄 License

This project is proprietary and confidential to **Inspark Online Courses**. Do not distribute.

---

## 📸 Screenshots

<table>
<tr>
<td><img src="https://user-images.githubusercontent.com/your-placeholder/summary.png" width="280"/></td>
<td><img src="https://user-images.githubusercontent.com/your-placeholder/issue-detail.png" width="280"/></td>
<td><img src="https://user-images.githubusercontent.com/your-placeholder/report-export.png" width="280"/></td>
</tr>
<tr>
<td align="center">Scan Summary</td>
<td align="center">AI Suggestion Modal</td>
<td align="center">HTML Report</td>
</tr>
</table>

---

> Built with ❤️ by Inspark's Support & Engineering Teams
