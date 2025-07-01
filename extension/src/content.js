// content.js - Enhanced with lesson scanning capability

console.log('🚀 Enhanced Content script starting...');

// ────────── Global State ──────────
let highlightedElement = null;
let lessonScanActive = false;
let currentScreen = 1;
let screenData = [];
let lastUrl = window.location.href;
let lastTitle = document.title;
let screenChangeTimeout = null;

// ────────── Screen Detection ──────────
function detectScreenChange() {
  const currentUrl = window.location.href;
  const currentTitle = document.title;
  
  if (currentUrl !== lastUrl || currentTitle !== lastTitle) {
    console.log('🔄 Screen change detected:', currentScreen, '→', currentScreen + 1);
    
    if (lessonScanActive) {
      currentScreen++;
      scanCurrentScreen();
    }
    
    lastUrl = currentUrl;
    lastTitle = currentTitle;
  }
}

function getScreenInfo() {
  return {
    screenNumber: currentScreen,
    title: document.title,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    selector: 'body'
  };
}

// ────────── Message Handler ──────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Content script received:', request.action);
  
  switch (request.action) {
    case 'ping':
      console.log('🏓 Ping received, responding with pong');
      sendResponse({ pong: true, ready: !!window.axe, lessonScanActive });
      return false;
      
    case 'startQuickScan':
      console.log('⚡ Starting quick scan...');
      handleQuickScan(sendResponse);
      return true;
      
    case 'startLessonScan':
      console.log('📚 Starting lesson scan...');
      handleStartLessonScan(sendResponse);
      return true;
      
    case 'stopLessonScan':
      console.log('⏹️ Stopping lesson scan...');
      handleStopLessonScan(sendResponse);
      return true;
      
    case 'getCurrentLessonData':
      console.log('📊 Getting current lesson data...');
      sendResponse({ success: true, screenData, currentScreen, isActive: lessonScanActive });
      return false;
      
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

// ────────── Quick Scan (Original functionality) ──────────
async function handleQuickScan(sendResponse) {
  try {
    console.log('⚡ Starting quick accessibility scan...');
    
    updateProgress(10);
    
    if (!window.axe) {
      throw new Error('Axe library not available');
    }
    
    updateProgress(30);
    
    // Run axe scan - only critical issues for quick scan too
    window.axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      resultTypes: ['violations'],
      elementRef: true
    }, (err, results) => {
      if (err) {
        console.error('❌ Quick scan error:', err);
        sendResponse({ success: false, error: err.message });
        return;
      }
      
      updateProgress(80);
      
      // Process results - filter only critical issues
      const issues = processScanResults(results, getScreenInfo(), true);
      
      updateProgress(100);
      
      console.log(`✅ Quick scan complete: ${issues.length} critical issues found`);
      
      chrome.runtime.sendMessage({
        action: 'quickScanComplete',
        results: issues,
        screenInfo: getScreenInfo()
      });
      
      sendResponse({ success: true, issues: issues.length });
    });
    
  } catch (error) {
    console.error('❌ Quick scan error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ────────── Lesson Scan Implementation ──────────
async function handleStartLessonScan(sendResponse) {
  try {
    console.log('📚 Initializing lesson scan...');
    
    lessonScanActive = true;
    currentScreen = 1;
    screenData = [];
    
    // Start monitoring for screen changes
    startScreenMonitoring();
    
    // Scan the current screen
    await scanCurrentScreen();
    
    chrome.runtime.sendMessage({
      action: 'lessonScanStarted',
      message: `Lesson scan started. Screen ${currentScreen} scanned.`,
      screenData,
      currentScreen
    });
    
    sendResponse({ success: true, message: 'Lesson scan started' });
    
  } catch (error) {
    console.error('❌ Lesson scan start error:', error);
    lessonScanActive = false;
    sendResponse({ success: false, error: error.message });
  }
}

async function handleStopLessonScan(sendResponse) {
  try {
    console.log('⏹️ Stopping lesson scan...');
    
    lessonScanActive = false;
    stopScreenMonitoring();
    
    // Send final results
    chrome.runtime.sendMessage({
      action: 'lessonScanComplete',
      results: getAllLessonIssues(),
      screenData,
      totalScreens: currentScreen,
      summary: generateLessonSummary()
    });
    
    sendResponse({ success: true, message: 'Lesson scan completed' });
    
  } catch (error) {
    console.error('❌ Lesson scan stop error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function scanCurrentScreen() {
  if (!lessonScanActive || !window.axe) return;
  
  console.log(`🔍 Scanning screen ${currentScreen}...`);
  
  return new Promise((resolve) => {
    window.axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      resultTypes: ['violations'],
      elementRef: true
    }, (err, results) => {
      if (err) {
        console.error('❌ Screen scan error:', err);
        resolve();
        return;
      }
      
      const screenInfo = getScreenInfo();
      const issues = processScanResults(results, screenInfo, true); // Only critical
      
      // Store screen data
      const existingScreenIndex = screenData.findIndex(s => s.screenNumber === currentScreen);
      if (existingScreenIndex > -1) {
        screenData[existingScreenIndex] = { ...screenInfo, issues };
      } else {
        screenData.push({ ...screenInfo, issues });
      }
      
      console.log(`✅ Screen ${currentScreen} scanned: ${issues.length} critical issues`);
      
      // Update popup
      chrome.runtime.sendMessage({
        action: 'lessonScanProgress',
        screenNumber: currentScreen,
        issuesCount: issues.length,
        screenData,
        screenInfo
      });
      
      resolve();
    });
  });
}

function startScreenMonitoring() {
  console.log('👀 Starting screen monitoring...');
  
  // Monitor URL changes
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (screenChangeTimeout) clearTimeout(screenChangeTimeout);
      screenChangeTimeout = setTimeout(detectScreenChange, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
  
  // Monitor page title changes
  new MutationObserver(() => {
    if (document.title !== lastTitle) {
      if (screenChangeTimeout) clearTimeout(screenChangeTimeout);
      screenChangeTimeout = setTimeout(detectScreenChange, 1000);
    }
  }).observe(document.querySelector('title') || document.head, { 
    childList: true, 
    subtree: true 
  });
  
  // Monitor significant DOM changes (new content loads)
  new MutationObserver((mutations) => {
    const significantChange = mutations.some(mutation => 
      mutation.addedNodes.length > 0 && 
      Array.from(mutation.addedNodes).some(node => 
        node.nodeType === 1 && node.tagName && 
        ['SECTION', 'ARTICLE', 'DIV'].includes(node.tagName) &&
        node.children.length > 0
      )
    );
    
    if (significantChange) {
      if (screenChangeTimeout) clearTimeout(screenChangeTimeout);
      screenChangeTimeout = setTimeout(detectScreenChange, 2000);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

function stopScreenMonitoring() {
  console.log('🛑 Stopping screen monitoring...');
  if (screenChangeTimeout) {
    clearTimeout(screenChangeTimeout);
    screenChangeTimeout = null;
  }
}

// ────────── Results Processing ──────────
function processScanResults(results, screenInfo, criticalOnly = false) {
  const issues = [];
  
  if (results.violations) {
    results.violations.forEach(violation => {
      // Filter only critical and serious issues if criticalOnly is true
      if (criticalOnly && !['critical', 'serious'].includes(violation.impact)) {
        return;
      }
      
      violation.nodes.forEach(node => {
        const issue = {
          id: `${violation.id}-${node.target.join('-')}-${screenInfo.screenNumber}-${Date.now()}`,
          title: violation.help,
          description: violation.description,
          severity: mapSeverity(violation.impact),
          category: 'a11y',
          type: violation.id,
          wcagLevel: extractWcagLevel(violation.tags),
          element: node.html,
          selector: node.target.join(', '),
          wcagReference: violation.helpUrl,
          location: getDetailedLocation(node),
          screenInfo: {
            screenNumber: screenInfo.screenNumber,
            title: screenInfo.title,
            url: screenInfo.url,
            timestamp: screenInfo.timestamp
          },
          isLessonResult: lessonScanActive
        };
        issues.push(issue);
      });
    });
  }
  
  return issues;
}

function getAllLessonIssues() {
  const allIssues = [];
  screenData.forEach(screen => {
    if (screen.issues) {
      allIssues.push(...screen.issues);
    }
  });
  return allIssues;
}

function generateLessonSummary() {
  const allIssues = getAllLessonIssues();
  const severityCounts = {
    critical: allIssues.filter(i => i.severity === 'critical').length,
    serious: allIssues.filter(i => i.severity === 'serious').length,
    moderate: allIssues.filter(i => i.severity === 'moderate').length,
    minor: allIssues.filter(i => i.severity === 'minor').length
  };
  
  return {
    totalScreens: currentScreen,
    totalIssues: allIssues.length,
    severityCounts,
    averageIssuesPerScreen: Math.round(allIssues.length / currentScreen * 10) / 10,
    screenData: screenData.map(screen => ({
      screenNumber: screen.screenNumber,
      title: screen.title,
      issuesCount: screen.issues.length
    }))
  };
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

function getDetailedLocation(node) {
  try {
    const element = node.element;
    if (!element) return 'Unknown location';
    
    // Find nearest heading
    const heading = element.closest('section, article')?.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      return `Near heading: "${heading.textContent.trim().slice(0, 40)}"`;
    }
    
    // Find landmark
    const landmark = element.closest('header, nav, main, aside, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"]');
    if (landmark) {
      const role = landmark.getAttribute('role') || landmark.tagName.toLowerCase();
      return `In ${role} section`;
    }
    
    // Find parent with class or ID
    const parentWithId = element.closest('[id], [class]');
    if (parentWithId) {
      const identifier = parentWithId.id || parentWithId.className.split(' ')[0];
      return `In element: ${identifier}`;
    }
    
    return `Screen ${currentScreen}`;
  } catch (error) {
    return `Screen ${currentScreen}`;
  }
}

function highlightElement(selector) {
  removeHighlight();
  
  try {
    const element = document.querySelector(selector);
    if (element) {
      highlightedElement = element;
      element.style.outline = '3px solid #ef4444';
      element.style.outlineOffset = '2px';
      element.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
      element.style.boxShadow = '0 0 0 6px rgba(239, 68, 68, 0.2)';
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add a temporary indicator
      const indicator = document.createElement('div');
      indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      indicator.textContent = `🎯 Issue highlighted on screen ${currentScreen}`;
      document.body.appendChild(indicator);
      
      setTimeout(() => indicator.remove(), 3000);
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
      highlightedElement.style.boxShadow = '';
      highlightedElement = null;
    }
  } catch (error) {
    console.error('Error removing highlight:', error);
  }
}

console.log('✅ Enhanced content script loaded and ready for lesson scanning');