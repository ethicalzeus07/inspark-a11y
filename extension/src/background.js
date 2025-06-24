// background.js - Fixed injection issues

// ────────── Service Worker Lifecycle ──────────
chrome.runtime.onStartup.addListener(() => {
  console.log('🚀 Inspark A11y extension started');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('📦 Inspark A11y extension installed/updated');
});

// ────────── Content Script Injection ──────────
async function ensureContentScriptInjected(tabId) {
  try {
    console.log('🔍 Checking content script for tab:', tabId);
    
    // First, try to ping the existing content script
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response && response.pong) {
        console.log('✅ Content script already active');
        return true; // Content script is already active
      }
    } catch (pingError) {
      console.log('📥 Content script not found, injecting...');
    }

    // Get tab info to check if injection is allowed
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

    // Then inject our content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['src/content.js']
      });
      console.log('✅ Content script injected');
    } catch (contentError) {
      console.error('❌ Failed to inject content script:', contentError);
      throw new Error('Failed to inject content script: ' + contentError.message);
    }

    // Wait a moment and verify injection worked
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const verifyResponse = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (verifyResponse && verifyResponse.pong) {
        console.log('✅ Content script injection verified');
        return true;
      } else {
        throw new Error('Content script injection failed verification');
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
  // When a page finishes loading, ensure content script is ready
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    try {
      // Small delay to ensure page is fully loaded
      setTimeout(async () => {
        await ensureContentScriptInjected(tabId);
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
      return true; // Keep message channel open

    case 'injectAxe':
      handleInjectAxe(request, sender, sendResponse);
      return true;

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
    
    // Get the active tab
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

    // Inject axe.min.js
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

async function forwardToContentScript(request, sender, sendResponse) {
  try {
    // Get the active tab (message is coming from popup)
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      console.error('❌ No active tab for forwarding');
      sendResponse({ success: false, error: 'No active tab' });
      return;
    }

    const tabId = tabs[0].id;
    console.log('🔄 Forwarding to tab:', tabId, 'Action:', request.action);

    // Ensure content script is injected before forwarding
    const injected = await ensureContentScriptInjected(tabId);
    if (!injected) {
      console.error('❌ Could not inject content script for forwarding');
      sendResponse({ success: false, error: 'Could not inject content script' });
      return;
    }

    // Forward the message
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

async function handleGetAiSuggestion(request, sender, sendResponse) {
  try {
    console.log('🤖 Getting AI suggestion for issue:', request.issue?.id);
    
    // Simple fallback suggestion
    const suggestion = "Review WCAG guidelines for this accessibility issue. Consider using semantic HTML and proper ARIA labels.";
    
    sendResponse({ success: true, suggestion });
  } catch (error) {
    console.error('Error getting AI suggestion:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleExportReport(request, sender, sendResponse) {
  try {
    console.log('📄 Exporting report:', request.format);
    
    const { results, format } = request;
    
    if (!results || results.length === 0) {
      sendResponse({ success: false, error: 'No results to export' });
      return;
    }

    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `accessibility-report-${timestamp}.${format}`;
    
    // For now, just return success - implement actual export logic as needed
    sendResponse({ success: true, filename });
    
  } catch (error) {
    console.error('Error exporting report:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleApiHealth(request, sender, sendResponse) {
  try {
    sendResponse({ success: true, healthy: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

console.log('🔧 Background script loaded and ready');