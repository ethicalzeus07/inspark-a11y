# Inspark AI-Powered Accessibility & UI/UX Testing Assistant

This project implements a browser extension and AI microservice for automated discovery of accessibility issues and UI/UX anomalies in Inspark Online Courses.

## Project Structure

```
inspark-a11y-assistant/
├── extension/             # Browser extension (Chrome/Edge/Firefox)
│   ├── assets/            # Icons and images
│   ├── public/            # Public static files
│   ├── src/               # Source code
│   │   ├── api.js         # API service for microservice communication
│   │   ├── background.js  # Extension background script
│   │   ├── config.js      # Configuration settings
│   │   ├── content.js     # Content script for page analysis
│   │   └── popup.js       # Popup UI script
│   ├── manifest.json      # Extension manifest
│   └── popup.html         # Extension popup UI
│
└── microservice/          # AI suggestion microservice
    ├── app/               # FastAPI application
    │   ├── core/          # Core functionality
    │   │   └── suggestions.json  # Predefined suggestions
    │   ├── models/        # Data models
    │   ├── routers/       # API routes
    │   ├── utils/         # Utility functions
    │   └── main.py        # Main application entry point
    ├── docs/              # Documentation
    └── tests/             # Test suite
```

## Features

- One-click accessibility and UI/UX scanning
- WCAG 2.2 AA compliance checking
- AI-powered suggestions for fixing issues
- Inline highlighting of problematic elements
- Exportable HTML/PDF reports
- Session history for offline review

## Getting Started

### Extension Setup

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension` directory
4. The extension icon should appear in your toolbar

### Microservice Setup

1. Navigate to the `microservice` directory
2. Create a virtual environment: `python -m venv venv`
3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Start the server: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

## Usage

1. Navigate to an Inspark course page
2. Click the extension icon in the toolbar
3. Click "Scan Page" to analyze the current page
4. Review issues in the popup panel
5. Hover over issues to highlight them on the page
6. Click an issue to see details and AI recommendations
7. Click "Export" to generate a shareable report

## Development

### Extension Development

- The extension uses vanilla JavaScript with Tailwind CSS
- Background script handles API communication and report generation
- Content script performs accessibility scanning with axe-core
- Popup script manages the user interface

### Microservice Development

- Built with FastAPI for high-performance API endpoints
- Supports AI-powered suggestion generation
- Includes caching to minimize redundant API calls
- Designed for containerization with Docker

## License

This project is proprietary and confidential to Inspark Online Courses.

## Next Steps

1. Complete Docker configuration for microservice
2. Add PII protection features
3. Implement automated testing
4. Deploy to production environment
