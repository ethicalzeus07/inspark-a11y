// content.js – Inspark A11y Assistant
// Runs inside every page the tester opens.

/* ------------------------------------------------------------------ *
   1.  STATE
/* ------------------------------------------------------------------ */
let highlightedElements = [];
let observer            = null;

// Will collect live UI/UX issues if web-vitals loads successfully
let liveUiIssues = [];

/* ------------------------------------------------------------------ *
   2.  (OPTIONAL) LOAD web-vitals WITH DYNAMIC import()
       – keeps classic content-script compatible
/* ------------------------------------------------------------------ */
(async () => {
  try {
    const { onCLS, onLCP, onINP } =
      await import('https://unpkg.com/web-vitals?module');

    // CLS – Cumulative Layout Shift
    onCLS(metric => {
      if (metric.value > 0.1) {
        liveUiIssues.push({
          id: 'layout-shift',
          impact: 'moderate',
          nodes: [{
            html: `<span>CLS: ${metric.value.toFixed(3)}</span>`,
            target: [],
            failureSummary:
              `Cumulative Layout Shift is ${metric.value.toFixed(3)}, which exceeds 0.1.`
          }]
        });
      }
    });

    // LCP – Largest Contentful Paint
    onLCP(metric => {
      if (metric.value > 2500) {
        liveUiIssues.push({
          id: 'lcp',
          impact: 'serious',
          nodes: [{
            html: `<span>LCP: ${Math.round(metric.value)}ms</span>`,
            target: [],
            failureSummary:
              `Largest Contentful Paint took ${Math.round(metric.value)} ms (above 2500 ms).`
          }]
        });
      }
    });

    // INP – Interaction to Next Paint
    onINP(metric => {
      if (metric.value > 200) {
        liveUiIssues.push({
          id: 'inp',
          impact: 'serious',
          nodes: [{
            html: `<span>INP: ${Math.round(metric.value)}ms</span>`,
            target: [],
            failureSummary:
              `Interaction to Next Paint is ${Math.round(metric.value)} ms (above 200 ms).`
          }]
        });
      }
    });

    console.log('[Inspark] web-vitals loaded');
  } catch (e) {
    // Could be blocked by CSP or network—fail gracefully
    console.warn('[Inspark] web-vitals unavailable, skipping live UX metrics', e);
  }
})();

/* ------------------------------------------------------------------ *
   3.  MESSAGE ROUTER  (popup → content)
/* ------------------------------------------------------------------ */
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // Ignore scans inside iframes
  if (!isTopFrame() && request.action === 'startScan') {
    sendResponse({ status: 'ignored frame' });
    return;
  }

  switch (request.action) {
    case 'startScan':
      performAccessibilityScan()
        .then(results =>
          chrome.runtime.sendMessage({ action: 'scanComplete', results }))
        .catch(err =>
          chrome.runtime.sendMessage({ action: 'scanError', error: err.message }));
      sendResponse({ status: 'scan started' });
      return true; // async

    case 'startGlobalScan':
      performAccessibilityScan()
        .then(async results => {
          const url = location.href;
          const { globalResults = {} } = await chrome.storage.local.get('globalResults');
          globalResults[url] = results;
          await chrome.storage.local.set({ globalResults });
          chrome.runtime.sendMessage({ action: 'globalScanComplete', globalResults });
        })
        .catch(err =>
          chrome.runtime.sendMessage({ action: 'scanError', error: err.message }));
      sendResponse({ status: 'global scan started' });
      return true;

    case 'highlightElement':
      highlightElement(request.selector);
      sendResponse({ status: 'highlighting' });
      break;

    case 'removeHighlight':
      removeHighlights();
      sendResponse({ status: 'highlights removed' });
      break;
  }
});

/* ------------------------------------------------------------------ *
   4.  MAIN SCAN ROUTINE
/* ------------------------------------------------------------------ */
async function performAccessibilityScan() {
  chrome.runtime.sendMessage({ action: 'scanProgress', progress: 10 });

  const axeResults = await runAxeAnalysis();
  chrome.runtime.sendMessage({ action: 'scanProgress', progress: 50 });

  const uiuxResults = await runUiUxChecks();
  chrome.runtime.sendMessage({ action: 'scanProgress', progress: 90 });

  const combined = formatResults(axeResults, uiuxResults);
  chrome.runtime.sendMessage({ action: 'scanProgress', progress: 100 });

  return combined;
}

/* ------------------------------------------------------------------ *
   5.  AXE ANALYSIS  (WCAG A/AA)
/* ------------------------------------------------------------------ */
function runAxeAnalysis() {
  return new Promise((resolve, reject) => {
    axe.run(
      document,
      {
        iframes: false,
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
      },
      (err, results) => (err ? reject(err) : resolve(results))
    );
  });
}

/* ------------------------------------------------------------------ *
   6.  UI/UX CHECKS  (touch-target, font-size, overflow) + live metrics
/* ------------------------------------------------------------------ */
async function runUiUxChecks() {
  const issues = [];

  /* 6-a Touch target */
  const clickables =
    ['a', 'button', 'input[type="button"]', 'input[type="submit"]'];
  document.querySelectorAll(clickables.join(',')).forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) {
      issues.push({
        id: 'touch-target-size',
        impact: 'moderate',
        nodes: [{
          html: el.outerHTML,
          target: [simpleSelector(el)],
          failureSummary:
            `Touch target ${Math.round(r.width)}×${Math.round(r.height)} px; needs ≥44×44 px.`
        }]
      });
    }
  });

  /* 6-b Font size */
  const bodyFont = parseFloat(getComputedStyle(document.body).fontSize);
  if (bodyFont < 16) {
    issues.push({
      id: 'font-size-too-small',
      impact: 'minor',
      nodes: [{
        html: 'body',
        target: ['body'],
        failureSummary: `Body font-size ${bodyFont}px; recommended ≥16 px.`
      }]
    });
  }

  /* 6-c Horizontal overflow */
  if (document.documentElement.scrollWidth > innerWidth) {
    issues.push({
      id: 'viewport-width',
      impact: 'minor',
      nodes: [{
        html: '',
        target: [],
        failureSummary:
          `Content width ${document.documentElement.scrollWidth}px exceeds viewport ${innerWidth}px.`
      }]
    });
  }

  /* 6-d merge live web-vitals issues (if any) */
  issues.push(...liveUiIssues);
  liveUiIssues = [];

  return issues;
}

/* ------------------------------------------------------------------ *
   7.  UTILS & FORMATTERS
/* ------------------------------------------------------------------ */
function simpleSelector(el) {
  let sel = el.tagName.toLowerCase();
  if (el.className) {
    const c = el.className.trim().split(/\s+/).join('.');
    if (c) sel += `.${c}`;
  }
  return sel;
}

function mapImpact(impact) {
  return { critical: 'critical', serious: 'serious',
           moderate: 'moderate', minor: 'minor' }[impact] || 'moderate';
}

function axeTitle(id) {
  const t = {
    'color-contrast': 'Insufficient Color Contrast',
    'image-alt':      'Missing Image Alt Text',
    'aria-required-attr': 'Missing Required ARIA Attributes',
    'aria-roles':     'Invalid ARIA Role',
    'button-name':    'Button Has No Discernible Text',
    'document-title': 'Document Must Have Title',
    'duplicate-id':   'Duplicate ID Attribute',
    'frame-title':    'Frame Missing Title',
    'html-has-lang':  'HTML Element Missing Lang Attribute',
    'label':          'Form Element Has No Label',
    'link-name':      'Link Has No Discernible Text'
  };
  return t[id] || `Accessibility Issue: ${id}`;
}

function uxTitle(id) {
  const t = {
    'touch-target-size':  'Touch Target Too Small',
    'content-overflow':   'Content Overflow on Small Screens',
    'font-size-too-small':'Font Size Too Small',
    'element-overlap':    'Overlapping Elements',
    'fixed-header-obscuring':'Fixed Header Obscures Content',
    'viewport-width':     'Content Wider Than Viewport',
    'layout-shift':       'Layout Instability (CLS)',
    'lcp':                'Largest Contentful Paint Too Slow',
    'inp':                'Slow Interaction (INP)'
  };
  return t[id] || `UI/UX Issue: ${id}`;
}

/* ------------------------------------------------------------------ *
   8.  COMBINE RESULTS
/* ------------------------------------------------------------------ */
function formatResults(axeRes, uxRes) {
  const issues = [];
  let id = 1;

  axeRes.violations.forEach(v =>
    v.nodes.forEach(n => issues.push({
      id:          `issue-${id++}`,
      title:       axeTitle(v.id),
      description: n.failureSummary,
      element:     truncate(n.html, 80),
      selector:    n.target[0],
      severity:    mapImpact(v.impact),
      category:    'a11y',
      type:        v.id,
      screenshot:  null,
      aiSuggestion:null
    })));

  uxRes.forEach(u =>
    u.nodes.forEach(n => issues.push({
      id:          `issue-${id++}`,
      title:       uxTitle(u.id),
      description: n.failureSummary,
      element:     truncate(n.html, 80),
      selector:    n.target[0] || '',
      severity:    mapImpact(u.impact),
      category:    'uiux',
      type:        u.id,
      screenshot:  null,
      aiSuggestion:null
    })));

  return issues;
}

const truncate = (str, max) =>
  (str && str.length > max) ? str.slice(0, max) + '…' : str;

/* ------------------------------------------------------------------ *
   9.  HIGHLIGHT HELPERS
/* ------------------------------------------------------------------ */
function highlightElement(selector) {
  removeHighlights();
  document.querySelectorAll(selector).forEach(el => {
    const r  = el.getBoundingClientRect();
    const hl = document.createElement('div');
    hl.className = 'inspark-a11y-highlight';
    hl.style.cssText = `
      position: absolute;
      left:${scrollX + r.left}px; top:${scrollY + r.top}px;
      width:${r.width}px; height:${r.height}px;
      border:2px solid #3B82F6; background:rgba(59,130,246,0.1);
      z-index:9999; pointer-events:none;`;
    document.body.appendChild(hl);
    highlightedElements.push(hl);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function removeHighlights() {
  highlightedElements.forEach(h => h.remove());
  highlightedElements = [];
}

/* ------------------------------------------------------------------ *
   10.  INIT
/* ------------------------------------------------------------------ */
(function init() {
  console.log('[Inspark] content script loaded');
  const s = document.createElement('style');
  s.textContent = `.inspark-a11y-highlight{transition:all .2s ease-in-out;pointer-events:none}`;
  document.head.appendChild(s);

  observer = new MutationObserver(m => console.log('[Inspark] DOM changes:', m.length));
  observer.observe(document.body, { childList:true, subtree:true, attributes:true });
})();

/* ------ helpers ------ */
function isTopFrame() { return window.self === window.top; }
