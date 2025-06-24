// content.js - Simplified version for testing

console.log('🚀 Content script starting...');

// ────────── Global State ──────────
let highlightedElement = null;

// ────────── Message Handler ──────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Content script received:', request.action);
  
  switch (request.action) {
    case 'ping':
      console.log('🏓 Ping received, responding with pong');
      sendResponse({ pong: true, ready: !!window.axe });
      return false; // Synchronous response
      
    case 'startScan':
      console.log('🔍 Starting single scan...');
      handleStartScan(sendResponse);
      return true; // Asynchronous response
      
    case 'startBatchScan':
      console.log('📚 Batch scan requested, falling back to single scan...');
      handleStartScan(sendResponse);
      return true; // Asynchronous response
      
    case 'highlightElement':
      highlightElement(request.selector);
      sendResponse({ success: true });
      return false;
      
    case 'removeHighlight':
      removeHighlight();
      sendResponse({ success: true });
      return false;
      
    default:
      console.log('❓ Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

// ────────── Scan Implementation ──────────
async function handleStartScan(sendResponse) {
  try {
    console.log('🔍 Starting accessibility scan...');
    
    // Update progress
    updateProgress(10);
    
    // Check if axe is available
    if (!window.axe) {
      throw new Error('Axe library not available');
    }
    
    updateProgress(30);
    
    console.log('🔍 Running axe scan...');
    
    // Run axe scan
    window.axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      resultTypes: ['violations'],
      elementRef: true
    }, (err, results) => {
      if (err) {
        console.error('❌ Axe scan error:', err);
        chrome.runtime.sendMessage({
          action: 'scanError',
          error: 'Accessibility scan failed: ' + err.message
        });
        sendResponse({ success: false, error: err.message });
        return;
      }
      
      updateProgress(80);
      
      console.log('✅ Axe scan complete:', results);
      
      // Process results
      const issues = [];
      if (results.violations) {
        results.violations.forEach(violation => {
          violation.nodes.forEach(node => {
            const issue = {
              id: `${violation.id}-${node.target.join('-')}-${Date.now()}`,
              title: violation.help,
              description: violation.description,
              severity: mapSeverity(violation.impact),
              category: 'a11y',
              type: violation.id,
              wcagLevel: extractWcagLevel(violation.tags),
              element: node.html,
              selector: node.target.join(', '),
              wcagReference: violation.helpUrl,
              location: getSimpleLocation(node)
            };
            issues.push(issue);
          });
        });
      }
      
      updateProgress(100);
      
      console.log(`✅ Scan complete: ${issues.length} issues found`);
      
      // Send results
      chrome.runtime.sendMessage({
        action: 'scanComplete',
        results: issues
      });
      
      sendResponse({ success: true, issues: issues.length });
    });
    
  } catch (error) {
    console.error('❌ Scan error:', error);
    chrome.runtime.sendMessage({
      action: 'scanError',
      error: error.message
    });
    sendResponse({ success: false, error: error.message });
  }
}

// ────────── Helper Functions ──────────
function updateProgress(percent) {
  try {
    chrome.runtime.sendMessage({
      action: 'scanProgress',
      progress: percent
    });
  } catch (error) {
    console.error('Error updating progress:', error);
  }
}

function mapSeverity(impact) {
  const mapping = {
    'critical': 'critical',
    'serious': 'serious',
    'moderate': 'moderate',
    'minor': 'minor'
  };
  return mapping[impact] || 'moderate';
}

function extractWcagLevel(tags) {
  if (tags.includes('wcag22aa')) return 'WCAG 2.2 AA';
  if (tags.includes('wcag21aa')) return 'WCAG 2.1 AA';
  if (tags.includes('wcag2aa')) return 'WCAG 2.0 AA';
  if (tags.includes('wcag2a')) return 'WCAG 2.0 A';
  return 'WCAG';
}

function getSimpleLocation(node) {
  try {
    const element = node.element;
    if (!element) return 'Unknown location';
    
    // Find nearest heading or landmark
    const heading = element.closest('section, article')?.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      return `Near heading: "${heading.textContent.trim().slice(0, 30)}"`;
    }
    
    // Find landmark
    const landmark = element.closest('header, nav, main, aside, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"]');
    if (landmark) {
      const role = landmark.getAttribute('role') || landmark.tagName.toLowerCase();
      return `In ${role} section`;
    }
    
    // Default
    return 'On the page';
  } catch (error) {
    return 'On the page';
  }
}

function highlightElement(selector) {
  removeHighlight();
  
  try {
    const element = document.querySelector(selector);
    if (element) {
      highlightedElement = element;
      element.style.outline = '3px solid #10b981';
      element.style.outlineOffset = '2px';
      element.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (error) {
    console.error('Error highlighting element:', error);
  }
}

function removeHighlight() {
  try {
    if (highlightedElement) {
      highlightedElement.style.outline = '';
      highlightedElement.style.outlineOffset = '';
      highlightedElement.style.backgroundColor = '';
      highlightedElement = null;
    }
  } catch (error) {
    console.error('Error removing highlight:', error);
  }
}

console.log('✅ Content script loaded and ready');