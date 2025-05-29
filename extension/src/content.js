// content.js – Inspark A11y Assistant
// Runs inside every page the tester opens.

// ===== 1. State =====
let highlightedElements = [];
let observer = null;
// Only run in the top window, not in child iframes
function isTopFrame() {
  return window.self === window.top;
}


// ===== 2. Listen for messages from popup =====
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "startScan" && !isTopFrame()) {
    sendResponse({ status: "ignored frame" });
    return;  // don’t kick off the scan here
  }
  switch (request.action) {

    // ----- Per-page scan -----
    case "startScan":
      console.log("💬 content.js → received startScan");
      performAccessibilityScan()
        .then(results => {
          chrome.runtime.sendMessage({ action: "scanComplete", results });
        })
        .catch(err => {
          chrome.runtime.sendMessage({ action: "scanError", error: err.message });
        });
      sendResponse({ status: "scan started" });
      return true;   // don’t keep channel open

    // ----- Global scan (accumulates by URL) -----
    case "startGlobalScan":
      performAccessibilityScan()
        .then(async results => {
          const url = window.location.href;
          // Fetch existing globalResults
          const { globalResults = {} } = await chrome.storage.local.get("globalResults");
          // Store this page’s results
          globalResults[url] = results;
          await chrome.storage.local.set({ globalResults });
          // Send back the entire collection
          chrome.runtime.sendMessage({ action: "globalScanComplete", globalResults });
        })
        .catch(err => {
          chrome.runtime.sendMessage({ action: "scanError", error: err.message });
        });
      sendResponse({ status: "global scan started" });
      return true;   // don’t keep channel open

    // ----- Highlight / remove highlight helpers -----
    case "highlightElement":
      highlightElement(request.selector);
      sendResponse({ status: "highlighting" });
      break;

    case "removeHighlight":
      removeHighlights();
      sendResponse({ status: "highlights removed" });
      break;
  }
});

// ===== 3. Main scan routine =====
async function performAccessibilityScan() {
  // 10% → we’ve started
  chrome.runtime.sendMessage({ action: "scanProgress", progress: 10 });
  console.log("📊 content.js → sent scanProgress 10");

  // Run axe
  const axeResults = await runAxeAnalysis();

  // 50% → axe finished
  chrome.runtime.sendMessage({ action: "scanProgress", progress: 50 });
  console.log("📊 content.js → sent scanProgress 50");

  // Run UI/UX mocks
  const uiuxResults = await runUiUxChecks();

  // 90% → custom checks done
  chrome.runtime.sendMessage({ action: "scanProgress", progress: 90 });
  console.log("📊 content.js → sent scanProgress 90");

  // Combine & finish
  const combined = formatResults(axeResults, uiuxResults);

  // 100% → all done
  chrome.runtime.sendMessage({ action: "scanProgress", progress: 100 });
  console.log("📊 content.js → sent scanProgress 100");

  return combined;
}


// ===== 4. Run axe-core analysis =====
function runAxeAnalysis() {
  return new Promise((resolve, reject) => {
    axe.run(
      document,
      {
        iframes: false,
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] }
      },
      (err, results) => err ? reject(err) : resolve(results)
    );
  });
}

// ===== 5. Mock UI/UX checks =====
function runUiUxChecks() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        {
          id: "touch-target-size",
          impact: "moderate",
          nodes: [{
            html: '<a href="#" class="small-link">Small link</a>',
            target: ["a.small-link"],
            failureSummary: "Touch target size is too small (24×20px); should be ≥44×44px"
          }]
        },
        {
          id: "content-overflow",
          impact: "minor",
          nodes: [{
            html: '<div class="content-box" style="width:320px;overflow:hidden;">Overflow</div>',
            target: ["div.content-box"],
            failureSummary: "Content may overflow on small screens (320 px)"
          }]
        }
      ]);
    }, 500);
  });
}

// ===== 6. Format combined results =====
function formatResults(axeResults, uiuxResults) {
  const issues = [];
  let counter = 1;

  axeResults.violations.forEach(v =>
    v.nodes.forEach(n => issues.push({
      id:          `issue-${counter++}`,
      title:       getViolationTitle(v.id),
      description: n.failureSummary,
      element:     n.html,
      selector:    n.target[0],
      severity:    mapImpactToSeverity(v.impact),
      category:    "a11y",
      type:        v.id,
      screenshot:  null,
      aiSuggestion:null
    }))
  );

  uiuxResults.forEach(u =>
    u.nodes.forEach(n => issues.push({
      id:          `issue-${counter++}`,
      title:       getUiUxIssueTitle(u.id),
      description: n.failureSummary,
      element:     n.html,
      selector:    n.target[0],
      severity:    mapImpactToSeverity(u.impact),
      category:    "uiux",
      type:        u.id,
      screenshot:  null,
      aiSuggestion:null
    }))
  );

  return issues;
}

// ===== 7. Helpers =====
function mapImpactToSeverity(impact) {
  const map = { critical: "critical", serious: "serious", moderate: "moderate", minor: "minor" };
  return map[impact] || "moderate";
}

function getViolationTitle(id) {
  const titles = {
    "color-contrast":       "Insufficient Color Contrast",
    "image-alt":            "Missing Image Alt Text",
    "aria-required-attr":   "Missing Required ARIA Attributes",
    "aria-roles":           "Invalid ARIA Role",
    "button-name":          "Button Has No Discernible Text",
    "document-title":       "Document Must Have Title",
    "duplicate-id":         "Duplicate ID Attribute",
    "frame-title":          "Frame Missing Title",
    "html-has-lang":        "HTML Element Missing Lang Attribute",
    "label":                "Form Element Has No Label",
    "link-name":            "Link Has No Discernible Text"
  };
  return titles[id] || `Accessibility Issue: ${id}`;
}

function getUiUxIssueTitle(id) {
  const titles = {
    "touch-target-size":     "Touch Target Too Small",
    "content-overflow":      "Content Overflow on Small Screens",
    "font-size-too-small":   "Font Size Too Small",
    "element-overlap":       "Overlapping Elements",
    "fixed-header-obscuring":"Fixed Header Obscures Content",
    "viewport-width":        "Content Wider Than Viewport"
  };
  return titles[id] || `UI/UX Issue: ${id}`;
}

// ===== 8. Highlight helpers =====
function highlightElement(selector) {
  removeHighlights();
  document.querySelectorAll(selector).forEach(el => {
    const r = el.getBoundingClientRect();
    const hl = document.createElement("div");
    hl.className = "inspark-a11y-highlight";
    hl.style.cssText = `
      position: absolute;
      left: ${window.scrollX + r.left}px;
      top:  ${window.scrollY + r.top}px;
      width: ${r.width}px;
      height:${r.height}px;
      border:2px solid #3B82F6;
      background:rgba(59,130,246,0.1);
      z-index:9999;
      pointer-events:none;
    `;
    document.body.appendChild(hl);
    highlightedElements.push(hl);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function removeHighlights() {
  highlightedElements.forEach(h => h.remove());
  highlightedElements = [];
}

// ===== 9. Init =====
(function init() {
  console.log("Inspark Accessibility Assistant content script loaded");
  const s = document.createElement("style");
  s.textContent = `
    .inspark-a11y-highlight {
      transition: all .2s ease-in-out;
      pointer-events: none;
    }
  `;
  document.head.appendChild(s);

  observer = new MutationObserver(m => console.log("DOM changes:", m.length));
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
})();
