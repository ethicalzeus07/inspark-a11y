// background.js - Enhanced with lesson scanning support

// ────────── Service Worker Lifecycle ──────────
chrome.runtime.onStartup.addListener(() => {
  console.log('🚀 Inspark A11y extension started');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('📦 Inspark A11y extension installed/updated');
});

// ────────── Global State ──────────
let lessonScanState = {
  isActive: false,
  startTime: null,
  currentScreen: 0,
  screenData: []
};

// ────────── Content Script Injection ──────────
async function ensureContentScriptInjected(tabId) {
  try {
    console.log('🔍 Checking content script for tab:', tabId);
    
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response && response.pong) {
        console.log('✅ Content script already active');
        return true;
      }
    } catch (pingError) {
      console.log('📥 Content script not found, injecting...');
    }

    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
      throw new Error('Cannot inject into browser internal pages');
    }

    console.log('📥 Injecting into URL:', tab.url);

    // Inject axe.min.js first
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['axe.min.js']
      });
      console.log('✅ Axe library injected');
    } catch (axeError) {
      console.error('❌ Failed to inject axe:', axeError);
      throw new Error('Failed to inject axe library: ' + axeError.message);
    }

    // Then inject our enhanced content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['src/content.js']
      });
      console.log('✅ Enhanced content script injected');
    } catch (contentError) {
      console.error('❌ Failed to inject content script:', contentError);
      throw new Error('Failed to inject content script: ' + contentError.message);
    }

    // Verify injection
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const verifyResponse = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (verifyResponse && verifyResponse.pong) {
        console.log('✅ Enhanced content script injection verified');
        return true;
      } else {
        throw new Error('Enhanced content script injection failed verification');
      }
    } catch (verifyError) {
      console.error('❌ Content script verification failed:', verifyError);
      throw new Error('Content script not responding after injection');
    }

  } catch (error) {
    console.error('❌ ensureContentScriptInjected failed:', error);
    return false;
  }
}

// ────────── Tab Management ──────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    try {
      setTimeout(async () => {
        await ensureContentScriptInjected(tabId);
        
        // If lesson scan is active, notify content script
        if (lessonScanState.isActive) {
          try {
            chrome.tabs.sendMessage(tabId, { 
              action: 'lessonScanContext',
              state: lessonScanState 
            });
          } catch (error) {
            console.log('Could not send lesson context to new tab:', error);
          }
        }
      }, 1000);
    } catch (error) {
      console.error('Error preparing content script on page load:', error);
    }
  }
});

// ────────── Message Handling ──────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background received message:', request.action, 'from', sender.tab?.url || 'popup');

  switch (request.action) {
    case 'ensureContentScript':
      handleEnsureContentScript(request, sender, sendResponse);
      return true;

    case 'injectAxe':
      handleInjectAxe(request, sender, sendResponse);
      return true;

    // Quick Scan
    case 'startQuickScan':
      forwardToContentScript(request, sender, sendResponse);
      return true;

    case 'quickScanComplete':
      handleQuickScanComplete(request, sender, sendResponse);
      return true;

    // Lesson Scan
    case 'startLessonScan':
      handleStartLessonScan(request, sender, sendResponse);
      return true;

    case 'stopLessonScan':
      handleStopLessonScan(request, sender, sendResponse);
      return true;

    case 'lessonScanStarted':
      handleLessonScanStarted(request, sender, sendResponse);
      return true;

    case 'lessonScanProgress':
      handleLessonScanProgress(request, sender, sendResponse);
      return true;

    case 'lessonScanComplete':
      handleLessonScanComplete(request, sender, sendResponse);
      return true;

    case 'getLessonScanState':
      sendResponse({ success: true, state: lessonScanState });
      return false;

    // AI & Export
    case 'getAiSuggestion':
      handleGetAiSuggestion(request, sender, sendResponse);
      return true;

    case 'exportReport':
      handleExportReport(request, sender, sendResponse);
      return true;

    case 'checkApiHealth':
      handleApiHealth(request, sender, sendResponse);
      return true;

    default:
      console.log('🔄 Forwarding message to content script');
      forwardToContentScript(request, sender, sendResponse);
      return true;
  }
});

// ────────── Message Handlers ──────────
async function handleEnsureContentScript(request, sender, sendResponse) {
  try {
    console.log('🔧 handleEnsureContentScript called');
    
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      console.error('❌ No active tab found');
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }

    const tabId = tabs[0].id;
    console.log('🎯 Target tab ID:', tabId, 'URL:', tabs[0].url);

    const injected = await ensureContentScriptInjected(tabId);
    console.log('📋 Injection result:', injected);
    
    sendResponse({ success: injected });
  } catch (error) {
    console.error('❌ Error in handleEnsureContentScript:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleInjectAxe(request, sender, sendResponse) {
  try {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID' });
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['axe.min.js']
    });

    console.log('✅ Axe injected successfully');
    sendResponse({ success: true });
  } catch (error) {
    console.error('❌ Failed to inject axe:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ────────── Quick Scan Handlers ──────────
async function handleQuickScanComplete(request, sender, sendResponse) {
  console.log('⚡ Quick scan completed:', request.results?.length, 'issues');
  
  // Store quick scan results
  try {
    await chrome.storage.local.set({
      lastQuickScanResults: request.results,
      lastQuickScanInfo: request.screenInfo,
      lastQuickScanTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error storing quick scan results:', error);
  }
  
  sendResponse({ success: true });
}

// ────────── Lesson Scan Handlers ──────────
async function handleStartLessonScan(request, sender, sendResponse) {
  try {
    console.log('📚 Starting lesson scan...');
    
    // Reset lesson scan state
    lessonScanState = {
      isActive: true,
      startTime: new Date().toISOString(),
      currentScreen: 0,
      screenData: []
    };
    
    // Forward to content script
    forwardToContentScript({ action: 'startLessonScan' }, sender, (response) => {
      if (response && response.success) {
        console.log('✅ Lesson scan started successfully');
        sendResponse({ success: true, message: 'Lesson scan started' });
      } else {
        console.error('❌ Failed to start lesson scan:', response?.error);
        lessonScanState.isActive = false;
        sendResponse({ success: false, error: response?.error || 'Failed to start lesson scan' });
      }
    });
    
  } catch (error) {
    console.error('❌ Error starting lesson scan:', error);
    lessonScanState.isActive = false;
    sendResponse({ success: false, error: error.message });
  }
}

async function handleStopLessonScan(request, sender, sendResponse) {
  try {
    console.log('⏹️ Stopping lesson scan...');
    
    // Forward to content script
    forwardToContentScript({ action: 'stopLessonScan' }, sender, async (response) => {
      if (response && response.success) {
        console.log('✅ Lesson scan stopped successfully');
        
        // Store final lesson scan results
        try {
          await chrome.storage.local.set({
            lastLessonScanResults: lessonScanState.screenData,
            lastLessonScanInfo: {
              startTime: lessonScanState.startTime,
              endTime: new Date().toISOString(),
              totalScreens: lessonScanState.currentScreen,
              totalIssues: lessonScanState.screenData.reduce((sum, screen) => sum + (screen.issues?.length || 0), 0)
            }
          });
        } catch (error) {
          console.error('Error storing lesson scan results:', error);
        }
        
        // Reset state
        lessonScanState.isActive = false;
        
        sendResponse({ success: true, message: 'Lesson scan completed' });
      } else {
        console.error('❌ Failed to stop lesson scan:', response?.error);
        sendResponse({ success: false, error: response?.error || 'Failed to stop lesson scan' });
      }
    });
    
  } catch (error) {
    console.error('❌ Error stopping lesson scan:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleLessonScanStarted(request, sender, sendResponse) {
  console.log('📚 Lesson scan started notification received');
  
  lessonScanState.currentScreen = request.currentScreen || 1;
  lessonScanState.screenData = request.screenData || [];
  
  sendResponse({ success: true });
}

async function handleLessonScanProgress(request, sender, sendResponse) {
  console.log('📊 Lesson scan progress:', request.screenNumber, 'issues:', request.issuesCount);
  
  lessonScanState.currentScreen = request.screenNumber;
  lessonScanState.screenData = request.screenData || [];
  
  sendResponse({ success: true });
}

async function handleLessonScanComplete(request, sender, sendResponse) {
  console.log('✅ Lesson scan complete:', request.results?.length, 'total issues');
  
  // Update final state
  lessonScanState.screenData = request.screenData || [];
  lessonScanState.currentScreen = request.totalScreens || lessonScanState.currentScreen;
  
  // Store complete lesson scan results
  try {
    await chrome.storage.local.set({
      lastLessonScanResults: request.results,
      lastLessonScanScreenData: request.screenData,
      lastLessonScanSummary: request.summary,
      lastLessonScanTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error storing lesson scan results:', error);
  }
  
  sendResponse({ success: true });
}

// ────────── Forward to Content Script ──────────
async function forwardToContentScript(request, sender, sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      console.error('❌ No active tab for forwarding');
      sendResponse({ success: false, error: 'No active tab' });
      return;
    }

    const tabId = tabs[0].id;
    console.log('🔄 Forwarding to tab:', tabId, 'Action:', request.action);

    const injected = await ensureContentScriptInjected(tabId);
    if (!injected) {
      console.error('❌ Could not inject content script for forwarding');
      sendResponse({ success: false, error: 'Could not inject content script' });
      return;
    }

    chrome.tabs.sendMessage(tabId, request, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error forwarding message:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('✅ Message forwarded successfully, response:', response);
        sendResponse(response);
      }
    });

  } catch (error) {
    console.error('❌ Error in forwardToContentScript:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ────────── AI Suggestion Handler ──────────
async function handleGetAiSuggestion(request, sender, sendResponse) {
  try {
    console.log('🤖 Getting AI suggestion for issue:', request.issue?.id);
    
    // Call the microservice API for AI suggestion
    const microserviceUrl = 'http://localhost:8000/api/ai_suggest';
    
    const requestBody = {
      issueType: request.issue?.type || 'unknown',
      issueDescription: request.issue?.description || '',
      element: request.issue?.element || '',
      severity: request.issue?.severity || 'moderate',
      category: request.issue?.category || 'a11y',
      context: {
        contentType: "educational",
        platform: "inspark",
        pageType: request.issue?.screenInfo ? "lesson" : "content",
        isLessonScanning: !!request.issue?.screenInfo,
        screenInfo: request.issue?.screenInfo,
        specialInstructions: `This is educational content for university students at Inspark.education. 
        Prioritize solutions that work with screen readers and assistive technology. 
        Consider diverse learning needs and disabilities. 
        Focus on WCAG 2.1 AA compliance for educational institutions.`
      },
      screenInfo: request.issue?.screenInfo ? {
        screenNumber: request.issue.screenInfo.screenNumber,
        title: request.issue.screenInfo.title,
        url: request.issue.screenInfo.url,
        timestamp: request.issue.screenInfo.timestamp
      } : null
    };

    console.log('🔗 Calling microservice:', microserviceUrl);
    console.log('📤 Request payload:', requestBody);

    const response = await fetch(microserviceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Microservice API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📥 AI suggestion received:', data.suggestion);
    
    sendResponse({ success: true, suggestion: data.suggestion });
    
  } catch (error) {
    console.error('❌ Error getting AI suggestion:', error);
    
    // Fallback to enhanced heuristic suggestion
    const fallbackSuggestion = generateEnhancedFallback(request.issue);
    console.log('🔄 Using fallback suggestion due to error:', error.message);
    
    sendResponse({ 
      success: true, 
      suggestion: fallbackSuggestion + " (Note: AI service unavailable, using enhanced heuristic suggestion)"
    });
  }
}

function generateEnhancedFallback(issue) {
  const issueType = issue?.type || 'unknown';
  const severity = issue?.severity || 'moderate';
  const screenContext = issue?.screenInfo ? ` on screen ${issue.screenInfo.screenNumber}` : '';
  
  const fallbacks = {
    'color-contrast': `Increase color contrast to meet WCAG 2.1 AA standards (4.5:1 for normal text, 3:1 for large text)${screenContext}. Use tools like WebAIM's contrast checker to verify compliance. This is critical for students with visual impairments.`,
    
    'image-alt': `Add descriptive alt text that conveys the meaning and context of this image${screenContext}. For decorative images, use alt="". For complex images like charts, provide detailed descriptions. Essential for students using screen readers.`,
    
    'heading-structure': `Fix heading hierarchy${screenContext} by using proper h1→h2→h3 structure without skipping levels. This helps students using screen readers navigate lesson content efficiently.`,
    
    'form-label': `Associate this form control with a descriptive label using for/id attributes or aria-labelledby${screenContext}. Critical for accessibility in assessments and assignments.`,
    
    'keyboard-navigation': `Ensure this element is keyboard accessible${screenContext}. Add tabindex if needed, provide visible focus indicators, and test with Tab/Shift+Tab navigation. Essential for students who cannot use a mouse.`,
    
    'aria-labels': `Add appropriate ARIA labels or roles${screenContext} to provide context for screen readers. Use aria-label, aria-labelledby, or aria-describedby as appropriate for this educational interface.`,
    
    'link-purpose': `Make this link text more descriptive and meaningful out of context${screenContext}. Avoid "click here" or "read more" - instead describe the destination or action clearly.`,
    
    'default': `Review WCAG 2.1 AA guidelines for this ${severity} accessibility issue${screenContext}. Ensure this element works with assistive technology and consider the diverse learning needs of students with disabilities.`
  };
  
  return fallbacks[issueType] || fallbacks['default'];
}

// ────────── Export Handler ──────────
async function handleExportReport(request, sender, sendResponse) {
  try {
    console.log('📄 Exporting report:', request.format);
    
    const { results, format } = request;
    
    if (!results || results.length === 0) {
      sendResponse({ success: false, error: 'No results to export' });
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `inspark-accessibility-report-${timestamp}.${format}`;
    
    sendResponse({ success: true, filename });
    
  } catch (error) {
    console.error('Error exporting report:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ────────── Health Check ──────────
async function handleApiHealth(request, sender, sendResponse) {
  try {
    sendResponse({ 
      success: true, 
      healthy: true,
      lessonScanActive: lessonScanState.isActive,
      currentScreen: lessonScanState.currentScreen
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

console.log('🔧 Enhanced background script loaded and ready for lesson scanning');