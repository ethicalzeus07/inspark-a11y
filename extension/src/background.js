// background.js – Inspark A11y Assistant
// -------------------------------------------------
// 1. Imports
import { apiService } from "./api.js";
import { config, debugLog } from "./config.js";

// -------------------------------------------------
// 2. Install hook – set default storage
chrome.runtime.onInstalled.addListener(() => {
  console.log("Inspark Accessibility Assistant installed");
  chrome.storage.local.set({
    settings: config.defaultSettings,
    sessionHistory: []
  });
});

// -------------------------------------------------
// 3. Background message router
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // ------- 3-A. Fetch AI suggestion -------
  if (request.action === "getAiSuggestion") {
    fetchAiSuggestion(request.issue)
      .then(suggestion => {
        chrome.runtime.sendMessage({
          action: "aiSuggestionReady",
          issueId: request.issue.id,
          suggestion
        });
      })
      .catch(error => {
        console.error("Error fetching AI suggestion:", error);
        chrome.runtime.sendMessage({
          action: "aiSuggestionReady",
          issueId: request.issue.id,
          suggestion: "Unable to generate suggestion at this time. Please try again later."
        });
      });
    // ❌ no return true; → we do NOT keep the channel open
  }

  // ------- 3-B. Export HTML/PDF report -------
  else if (request.action === "exportReport") {
    generateReport(request.results)
      .then(reportUrl => chrome.tabs.create({ url: reportUrl }))
      .catch(error => console.error("Error generating report:", error));
    // ❌ no return true; → channel closed immediately
  }

  // ------- 3-C. Health-check ping (needs async response) -------
  else if (request.action === "checkApiHealth") {
    apiService
      .checkHealth()
      .then(isHealthy => sendResponse({ isHealthy }))
      .catch(err => sendResponse({ isHealthy: false, error: err.message }));
    return true; // ✅ keep channel open for sendResponse
  }
});

// -------------------------------------------------
// 4. Helper – talk to microservice
async function fetchAiSuggestion(issue) {
  try {
    return await apiService.getSuggestion(issue);
  } catch (err) {
    debugLog("Error in fetchAiSuggestion:", err);
    return "Could not generate a suggestion. Please check your connection to the AI service.";
  }
}

// -------------------------------------------------
// 5. Helper – generate & save HTML report
async function generateReport(results) {
  // Active tab info
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Build HTML → Blob → ObjectURL
  const html = createReportHtml(results, currentTab);
  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));

  // Save history (keep last 25)
  const timestamp = new Date().toISOString();
  const { sessionHistory = [] } = await chrome.storage.local.get("sessionHistory");
  const updated = [{ timestamp, url: currentTab.url, title: currentTab.title, issueCount: results.length, reportUrl: blobUrl }, ...sessionHistory].slice(0, 25);
  await chrome.storage.local.set({ sessionHistory: updated });

  return blobUrl;
}

// -------------------------------------------------
// 6. Helper – build HTML markup for report
function createReportHtml(results, tab) {
  const date = new Date().toLocaleString();
  const groups = {
    a11y: results.filter(r => r.category === "a11y"),
    uiux: results.filter(r => r.category === "uiux")
  };

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Accessibility Report – ${tab.title}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#333;max-width:1200px;margin:0 auto;padding:2rem}
  header{margin-bottom:2rem;padding-bottom:1rem;border-bottom:1px solid #eaeaea}
  h1{color:#2563eb;margin-bottom:.5rem}
  .meta{color:#666;font-size:.9rem}
  .summary{display:flex;gap:2rem;margin-bottom:2rem}
  .summary-box{flex:1;padding:1.5rem;border-radius:.5rem;background:#f9fafb}
  .summary-box h3{margin:0 0 .5rem;color:#1f2937}
  .issues-container h2{margin-top:2rem;padding-bottom:.5rem;border-bottom:1px solid #eaeaea;color:#1f2937}
  .issue{margin-bottom:1.5rem;padding:1rem;border-radius:.5rem;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .issue-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem}
  .issue-title{font-weight:600;color:#111827}
  .issue-severity{font-size:.8rem;padding:.25rem .75rem;border-radius:9999px}
  .critical{background:#fee2e2;color:#b91c1c}
  .serious{background:#ffedd5;color:#c2410c}
  .moderate{background:#d1fae5;color:#065f46}
  .minor{background:#f3f4f6;color:#4b5563}
  .issue-element{font-family:monospace;background:#f3f4f6;padding:.5rem;border-radius:.25rem;overflow-x:auto;font-size:.9rem}
  .issue-suggestion{margin-top:1rem;padding:1rem;background:#eff6ff;border-radius:.25rem;border-left:4px solid #3b82f6}
  .issue-suggestion h4{margin:0 0 .5rem;color:#1e40af}
  footer{margin-top:3rem;padding-top:1rem;border-top:1px solid #eaeaea;color:#6b7280;font-size:.9rem;text-align:center}
  @media print{body{padding:0}.issue{break-inside:avoid;box-shadow:none;border:1px solid #eaeaea}}
</style>
</head><body>
<header>
  <h1>Accessibility & UI/UX Report</h1>
  <div class="meta">
    <div><strong>Page:</strong> ${tab.title}</div>
    <div><strong>URL:</strong> ${tab.url}</div>
    <div><strong>Date:</strong> ${date}</div>
  </div>
</header>

<div class="summary">
  <div class="summary-box">
    <h3>Issues Summary</h3>
    <div><strong>Total:</strong> ${results.length}</div>
    <div><strong>Accessibility:</strong> ${groups.a11y.length}</div>
    <div><strong>UI/UX:</strong> ${groups.uiux.length}</div>
  </div>
  <div class="summary-box">
    <h3>Severity Breakdown</h3>
    <div><strong>Critical:</strong> ${results.filter(i=>i.severity==="critical").length}</div>
    <div><strong>Serious:</strong> ${results.filter(i=>i.severity==="serious").length}</div>
    <div><strong>Moderate:</strong> ${results.filter(i=>i.severity==="moderate").length}</div>
    <div><strong>Minor:</strong> ${results.filter(i=>i.severity==="minor").length}</div>
  </div>
</div>

<div class="issues-container">
  <h2>Accessibility Issues</h2>
  ${groups.a11y.length?groups.a11y.map(createIssueHtml).join(""):"<p>No accessibility issues found.</p>"}

  <h2>UI/UX Issues</h2>
  ${groups.uiux.length?groups.uiux.map(createIssueHtml).join(""):"<p>No UI/UX issues found.</p>"}
</div>

<footer>Generated by Inspark Accessibility &amp; UI/UX Testing Assistant</footer>
</body></html>`;
}

// helper – issue markup
function createIssueHtml(issue) {
  return `
  <div class="issue">
    <div class="issue-header">
      <div class="issue-title">${issue.title}</div>
      <div class="issue-severity ${issue.severity}">${issue.severity}</div>
    </div>
    <div class="issue-description">${issue.description}</div>
    <div class="issue-element">${issue.element}</div>
    ${
      issue.aiSuggestion
        ? `<div class="issue-suggestion"><h4>AI Recommendation</h4>${issue.aiSuggestion}</div>`
        : ""
    }
  </div>`;
}
