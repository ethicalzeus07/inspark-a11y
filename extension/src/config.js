// config.js - Configuration for the extension

// Environment settings
const ENV = {
  development: {
    microserviceUrl: 'http://localhost:8000/api',
    debug: true
  },
  production: {
    microserviceUrl: 'https://inspark-a11y-assistant-api.example.com/api',
    debug: false
  }
};

// Current environment
const CURRENT_ENV = 'development';

// Export configuration
export const config = {
  ...ENV[CURRENT_ENV],
  version: '1.0.0',
  appName: 'Inspark Accessibility & UI/UX Testing Assistant',
  storageKeys: {
    settings: 'inspark_a11y_settings',
    lastScanResults: 'inspark_a11y_lastScanResults',
    sessionHistory: 'inspark_a11y_sessionHistory'
  },
  defaultSettings: {
    highlightIssues: true,
    autoScanOnLoad: false,
    aiSuggestions: true,
    includePdfAiSuggestions: true // New setting for PDF reports
  },
  // API endpoints
  endpoints: {
    suggest: 'suggest',
    aiSuggest: 'ai_suggest', 
    analyze: 'analyze',
    health: 'health',
    generateReport: 'generate_report' // New PDF endpoint
  }
};

// Helper to get microservice endpoint
export function getApiEndpoint(path) {
  const endpoint = config.endpoints[path] || path;
  return `${config.microserviceUrl}/${endpoint}`;
}

// Helper to log messages in debug mode
export function debugLog(...args) {
  if (config.debug) {
    console.log('[Inspark A11y]', ...args);
  }
}