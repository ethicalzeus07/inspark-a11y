// background.js – Inspark A11y Assistant
// ─────────────────────────────────────────────────────────────────
// This file must be loaded with `"type": "module"` in your manifest.

import { apiService } from "./api.js";
import { config, debugLog } from "./config.js";

// 1. On install, seed storage
chrome.runtime.onInstalled.addListener(() => {
  console.log("Inspark Accessibility Assistant installed");
  chrome.storage.local.set({
    settings: config.defaultSettings,
    sessionHistory: []
  });
});

// 2. Central message router
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  switch(request.action) {

    // A. Fetch our default microservice AI suggestion
    case "getAiSuggestion":
      fetchAiSuggestion(request.issue)
        .then(text => {
          chrome.runtime.sendMessage({
            action: "aiSuggestionReady",
            issueId: request.issue.id,
            suggestion: text
          });
        })
        .catch(err => {
          console.error("Error fetching AI suggestion:", err);
          chrome.runtime.sendMessage({
            action: "aiSuggestionReady",
            issueId: request.issue.id,
            suggestion: "Unable to generate suggestion at this time."
          });
        });
      return false;

    // B. Export a static HTML report
    case "exportReport":
      generateReport(request.results)
        .then(url => chrome.tabs.create({ url }))
        .catch(err => console.error("Error generating report:", err));
      return false;

    // C. Health-check
    case "checkApiHealth":
      apiService.checkHealth()
        .then(isHealthy => sendResponse({ isHealthy }))
        .catch(err => sendResponse({ isHealthy: false, error: err.message }));
      return true;

    default:
      return false;
  }
});

// 3. Helper – call microservice
async function fetchAiSuggestion(issue) {
  try {
    return await apiService.getSuggestion(issue);
  } catch (err) {
    debugLog("Error in fetchAiSuggestion:", err);
    return "Could not generate a suggestion. Please check your AI connection.";
  }
}

// 4. Helper – build & persist HTML report
async function generateReport(results) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const html = createReportHtml(results, tab);
  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);

  // save history
  const when = new Date().toISOString();
  const { sessionHistory = [] } = await chrome.storage.local.get("sessionHistory");
  const next = [
    { timestamp: when, url: tab.url, title: tab.title, issueCount: results.length, reportUrl: url },
    ...sessionHistory
  ].slice(0, 25);
  await chrome.storage.local.set({ sessionHistory: next });

  return url;
}

// 5. Helper – render report HTML
function createReportHtml(results, tab) {
  const date = new Date().toLocaleString();
  const a11y = results.filter(r => r.category === "a11y");
  const uiux = results.filter(r => r.category === "uiux");
  const bySeverity = sev => results.filter(i => i.severity === sev).length;

  function issueHtml(i) {
    return `
      <div class="issue">
        <div class="issue-header">
          <div class="issue-title">${i.title}</div>
          <div class="issue-severity ${i.severity}">${i.severity}</div>
        </div>
        <div class="issue-description">${i.description}</div>
        <div class="issue-element">${i.element}</div>
        ${i.aiSuggestion ? `<div class="issue-suggestion"><h4>AI Recommendation</h4>${i.aiSuggestion}</div>` : ""}
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Report – ${tab.title}</title>
  <style>
    /* … your CSS from before … */
  </style>
</head>
<body>
  <header>
    <h1>Accessibility & UI/UX Report</h1>
    <div><strong>Page:</strong> ${tab.title}</div>
    <div><strong>URL:</strong> ${tab.url}</div>
    <div><strong>Date:</strong> ${date}</div>
  </header>
  <section>
    <h2>Summary</h2>
    <div><strong>Total:</strong> ${results.length}</div>
    <div><strong>Accessibility:</strong> ${a11y.length}</div>
    <div><strong>UI/UX:</strong> ${uiux.length}</div>
    <div><strong>Critical:</strong> ${bySeverity("critical")}</div>
    <div><strong>Serious:</strong> ${bySeverity("serious")}</div>
    <div><strong>Moderate:</strong> ${bySeverity("moderate")}</div>
    <div><strong>Minor:</strong> ${bySeverity("minor")}</div>
  </section>
  <section>
    <h2>Accessibility Issues</h2>
    ${a11y.length ? a11y.map(issueHtml).join("") : "<p>None</p>"}
    <h2>UI/UX Issues</h2>
    ${uiux.length ? uiux.map(issueHtml).join("") : "<p>None</p>"}
  </section>
</body>
</html>`;
}
