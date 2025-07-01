// popup.js - Enhanced with lesson scanning functionality

document.addEventListener('DOMContentLoaded', () => {
  console.log("🎉 Enhanced popup.js loaded");

  // ────────── DOM Elements ──────────
  const quickScanBtn = document.getElementById('quickScanBtn');
  const lessonScanBtn = document.getElementById('lessonScanBtn');
  const stopLessonBtn = document.getElementById('stopLessonBtn');
  const exportBtn = document.getElementById('exportBtn');
  const scanStatus = document.getElementById('scanStatus');
  const resultsContainer = document.getElementById('resultsContainer');
  const emptyState = document.getElementById('emptyState');
  const issuesList = document.getElementById('issuesList');
  const issueCount = document.getElementById('issueCount');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const progressPercent = document.getElementById('progressPercent');
  const progressFill = document.getElementById('progressFill');
  const scanProgress = document.getElementById('scanProgress');
  
  // New lesson scan elements
  const lessonScanContainer = document.getElementById('lessonScanContainer');
  const lessonStatus = document.getElementById('lessonStatus');
  const lessonProgress = document.getElementById('lessonProgress');
  const currentScreenDisplay = document.getElementById('currentScreen');
  const totalIssuesDisplay = document.getElementById('totalIssues');
  const screensContainer = document.getElementById('screensContainer');
  const screensList = document.getElementById('screensList');
  
  // Modal elements
  const issueDetail = document.getElementById('issueDetail');
  const backBtn = document.getElementById('backBtn');
  const closeDetail = document.getElementById('closeDetail');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const detailTitle = document.getElementById('detailTitle');
  const detailContent = document.getElementById('detailContent');
  const detailSeverity = document.getElementById('detailSeverity');
  const detailCategory = document.getElementById('detailCategory');
  const aiSuggestion = document.getElementById('aiSuggestion');
  const fetchAiSuggestion = document.getElementById('fetchAiSuggestion');
  const advancedAiSuggestion = document.getElementById('advancedAiSuggestion');
  
  // Summary elements
  const criticalCount = document.getElementById('criticalCount');
  const seriousCount = document.getElementById('seriousCount');
  const moderateCount = document.getElementById('moderateCount');
  const minorCount = document.getElementById('minorCount');

  // ────────── State ──────────
  let currentResults = [];
  let lessonScanData = [];
  let activeFilter = 'all';
  let currentIssueForAi = null;
  let lessonScanActive = false;
  let viewMode = 'quick'; // 'quick' or 'lesson'

  // ────────── Helper Functions ──────────
  const truncate = (str, max) =>
    (str && str.length > max) ? str.slice(0, max) + '…' : str;

  function prettifyDescription(raw) {
    if (!raw) return '';
    let text = raw.trim();
    if (!text.endsWith('.')) {
      text += '.';
    }
    return text;
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatAiSuggestion(suggestion) {
    if (!suggestion) return '<div class="text-sm text-gray-400">No suggestion available</div>';
    
    // Split suggestion into explanation and code parts
    const parts = suggestion.split(/```|`{3,}/);
    
    // Check for HTML/CSS code patterns
    const codePatterns = [
      /<[^>]+>/,  // HTML tags
      /style\s*=\s*"[^"]*"/,  // Style attributes
      /background-color\s*:\s*#[0-9a-fA-F]{6}/,  // CSS colors
      /color\s*:\s*#[0-9a-fA-F]{6}/,  // CSS colors
      /aria-[a-z-]+\s*=/,  // ARIA attributes
      /class\s*=\s*"[^"]*"/  // Class attributes
    ];
    
    let formattedHTML = '<div class="space-y-4">';
    
    if (parts.length > 1) {
      // Handle explicit code blocks (with ```)
      parts.forEach((part, index) => {
        if (index % 2 === 0) {
          // Text part
          if (part.trim()) {
            formattedHTML += `<div class="ai-explanation">${formatExplanation(part.trim())}</div>`;
          }
        } else {
          // Code part
          formattedHTML += formatCodeBlock(part.trim());
        }
      });
    } else {
      // Auto-detect code within the suggestion
      const lines = suggestion.split('\n');
      let currentSection = '';
      let inCodeSection = false;
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        
        // Check if this line contains code
        const isCodeLine = codePatterns.some(pattern => pattern.test(trimmedLine));
        
        if (isCodeLine && !inCodeSection) {
          // Starting a code section
          if (currentSection.trim()) {
            formattedHTML += `<div class="ai-explanation">${formatExplanation(currentSection.trim())}</div>`;
            currentSection = '';
          }
          inCodeSection = true;
          currentSection = trimmedLine;
        } else if (isCodeLine && inCodeSection) {
          // Continuing code section
          currentSection += '\n' + trimmedLine;
        } else if (!isCodeLine && inCodeSection) {
          // Ending code section
          formattedHTML += formatCodeBlock(currentSection);
          currentSection = trimmedLine;
          inCodeSection = false;
        } else {
          // Regular text
          if (trimmedLine) {
            currentSection += (currentSection ? '\n' : '') + trimmedLine;
          }
        }
      });
      
      // Handle remaining content
      if (currentSection.trim()) {
        if (inCodeSection) {
          formattedHTML += formatCodeBlock(currentSection);
        } else {
          formattedHTML += `<div class="ai-explanation">${formatExplanation(currentSection.trim())}</div>`;
        }
      }
    }
    
    formattedHTML += '</div>';
    return formattedHTML;
  }

  function formatExplanation(text) {
    // Format the explanation text with better typography
    let formatted = escapeHtml(text);
    
    // Highlight important terms
    formatted = formatted
      .replace(/WCAG\s+[\d.]+\s*AA?/gi, '<span class="wcag-highlight">$&</span>')
      .replace(/(\d+\.?\d*:\d+)/g, '<span class="ratio-highlight">$1</span>')
      .replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/gi, '<span class="color-highlight" style="background-color: $&; color: white; padding: 1px 4px; border-radius: 3px; font-family: monospace;">$&</span>')
      .replace(/aria-[a-z-]+/gi, '<span class="aria-highlight">$&</span>')
      .replace(/\b(screen reader|assistive technology|keyboard navigation|accessibility)\b/gi, '<span class="a11y-highlight">$&</span>');
    
    return `<p class="text-sm leading-relaxed">${formatted}</p>`;
  }

  function formatCodeBlock(code) {
    if (!code || !code.trim()) return '';
    
    const escapedCode = escapeHtml(code.trim());
    
    // Determine code type
    let language = 'html';
    if (code.includes('style=') || code.includes('background-color:') || code.includes('color:')) {
      language = 'html';
    } else if (code.includes('{') && code.includes('}')) {
      language = 'css';
    }
    
    return `
      <div class="code-block">
        <div class="code-header">
          <span class="code-language">${language.toUpperCase()}</span>
          <button class="copy-code-btn" onclick="copyToClipboard('${escapedCode.replace(/'/g, "\\'")}')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </button>
        </div>
        <pre class="code-content"><code class="language-${language}">${formatSyntaxHighlight(escapedCode, language)}</code></pre>
      </div>
    `;
  }

  function formatSyntaxHighlight(code, language) {
    if (language === 'html') {
      return code
        .replace(/(&lt;\/?)([a-zA-Z][a-zA-Z0-9]*)/g, '$1<span class="html-tag">$2</span>')
        .replace(/(\w+)=&quot;([^&]*)&quot;/g, '<span class="html-attr">$1</span>=<span class="html-value">&quot;$2&quot;</span>')
        .replace(/(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})/g, '<span class="color-value">$1</span>');
    } else if (language === 'css') {
      return code
        .replace(/([a-zA-Z-]+)(\s*:\s*)([^;]+)/g, '<span class="css-prop">$1</span>$2<span class="css-value">$3</span>')
        .replace(/(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})/g, '<span class="color-value">$1</span>');
    }
    return code;
  }

  // Copy to clipboard function
  window.copyToClipboard = function(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    showNotification('📋 Code copied to clipboard!', 'success');
  };

  function resizeForModal(isOpen = false) {
    if (isOpen) {
      document.body.style.width = '700px';
      document.body.style.maxHeight = '90vh';
      document.body.classList.add('modal-open');
    } else {
      document.body.style.width = '480px';
      document.body.style.maxHeight = '700px';
      document.body.classList.remove('modal-open');
    }
  }

  // Load previous scan results
  chrome.storage.local.get(['lastQuickScanResults', 'lastLessonScanResults', 'lastLessonScanScreenData'], (data) => {
    if (data.lastQuickScanResults) {
      currentResults = data.lastQuickScanResults.map(issue => ({
        ...issue,
        description: prettifyDescription(issue.description)
      }));
      viewMode = 'quick';
      updateResultsView();
    } else if (data.lastLessonScanResults) {
      currentResults = data.lastLessonScanResults.map(issue => ({
        ...issue,
        description: prettifyDescription(issue.description)
      }));
      lessonScanData = data.lastLessonScanScreenData || [];
      viewMode = 'lesson';
      updateLessonView();
    }
  });

  // Check lesson scan state on load
  chrome.runtime.sendMessage({ action: 'getLessonScanState' }, (response) => {
    if (response && response.success && response.state.isActive) {
      lessonScanActive = true;
      updateLessonScanUI(true);
    }
  });

  // ────────── Modal Functionality ──────────
  function closeModal() {
    resizeForModal(false);
    if (issueDetail) issueDetail.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.remove('hidden');
    if (screensContainer) screensContainer.classList.remove('hidden');
  }

  // Modal event listeners
  if (backBtn) backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  });

  if (closeDetail) closeDetail.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  });

  if (modalBackdrop) modalBackdrop.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && issueDetail && !issueDetail.classList.contains('hidden')) {
      closeModal();
    }
  });

  // ────────── Event Handlers ──────────
  if (quickScanBtn) {
    quickScanBtn.addEventListener('click', startQuickScan);
  }
  
  if (lessonScanBtn) {
    lessonScanBtn.addEventListener('click', startLessonScan);
  }

  if (stopLessonBtn) {
    stopLessonBtn.addEventListener('click', stopLessonScan);
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportReport('html'));
  }

  // Filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      filterBtns.forEach(b => {
        b.classList.remove('active', 'bg-blue-100', 'border-blue-300');
      });
      btn.classList.add('active', 'bg-blue-100', 'border-blue-300');
      
      if (viewMode === 'lesson') {
        renderLessonScreens();
      } else {
        renderIssuesList();
      }
    });
  });

  // AI suggestion handler
  if (fetchAiSuggestion) {
    fetchAiSuggestion.addEventListener('click', async () => {
      if (!currentIssueForAi) return;

      fetchAiSuggestion.disabled = true;
      fetchAiSuggestion.innerHTML = `
        <svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Getting AI Analysis...</span>
      `;
      
      if (advancedAiSuggestion) {
        advancedAiSuggestion.classList.remove('hidden');
        advancedAiSuggestion.innerHTML = `
          <div class="flex items-center space-x-2">
            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Analyzing for educational accessibility...</span>
          </div>
        `;
      }

      try {
        console.log('🤖 Requesting AI suggestion for issue:', currentIssueForAi.id);
        
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ 
            action: 'getAiSuggestion', 
            issue: currentIssueForAi 
          }, resolve);
        });

        console.log('📥 AI suggestion response:', response);

        if (response && response.success && response.suggestion) {
          const suggestion = response.suggestion;
          
          // Parse and format the AI suggestion
          const formattedSuggestion = formatAiSuggestion(suggestion);
          
          // Display the formatted AI suggestion
          if (advancedAiSuggestion) {
            advancedAiSuggestion.innerHTML = formattedSuggestion;
          }

          // Update stored results
          const idx = currentResults.findIndex(i => i.id === currentIssueForAi.id);
          if (idx > -1) {
            currentResults[idx].advancedAiSuggestion = suggestion;
            const storageKey = viewMode === 'lesson' ? 'lastLessonScanResults' : 'lastQuickScanResults';
            chrome.storage.local.set({ [storageKey]: currentResults });
          }
          
          showNotification('🤖 AI analysis complete!', 'success');
        } else {
          throw new Error(response?.error || 'Failed to get AI suggestion');
        }
      } catch (error) {
        console.error('❌ AI suggestion error:', error);
        
        let errorMessage = 'Could not get AI analysis. ';
        if (error.message.includes('microservice') || error.message.includes('API')) {
          errorMessage += 'Make sure the microservice is running on localhost:8000.';
        } else {
          errorMessage += 'Please check your connection and try again.';
        }
        
        if (advancedAiSuggestion) {
          advancedAiSuggestion.innerHTML = `
            <div class="flex items-start space-x-2 text-red-400 bg-red-900 bg-opacity-20 p-3 rounded-lg border border-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div class="font-medium">AI Service Unavailable</div>
                <div class="text-sm mt-1">${errorMessage}</div>
                <div class="text-xs mt-2 text-red-300">
                  Tip: Start the microservice with: <code class="bg-red-800 px-1 rounded">python main.py</code>
                </div>
              </div>
            </div>
          `;
        }
        showNotification('❌ AI analysis failed. Check if microservice is running.', 'error');
      }

      fetchAiSuggestion.disabled = false;
      fetchAiSuggestion.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>Get AI Recommendation</span>
      `;
    });
  }

  // ────────── Message Listeners ──────────
  chrome.runtime.onMessage.addListener(request => {
    console.log('📨 Popup received message:', request.action);
    switch(request.action) {
      case 'scanProgress':
        return updateScanProgress(request.progress);
      case 'quickScanComplete':
        return quickScanComplete(request.results);
      case 'lessonScanStarted':
        return lessonScanStarted(request);
      case 'lessonScanProgress':
        return updateLessonProgress(request);
      case 'lessonScanComplete':
        return lessonScanComplete(request);
      case 'scanError':
        return showError(request.error);
    }
  });

  // ────────── Connection Helper ──────────
  async function ensureConnectionToPage() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs[0]) {
          resolve({ success: false, error: 'No active tab found' });
          return;
        }

        const tab = tabs[0];
        
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
          resolve({ success: false, error: 'Cannot scan browser internal pages' });
          return;
        }

        try {
          chrome.runtime.sendMessage({ action: 'ensureContentScript' }, async (response) => {
            if (chrome.runtime.lastError) {
              console.error('Runtime error:', chrome.runtime.lastError);
              resolve({ success: false, error: 'Extension service unavailable' });
              return;
            }

            if (response && response.success) {
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (pingResponse) => {
                  if (chrome.runtime.lastError) {
                    console.error('Ping error:', chrome.runtime.lastError);
                    resolve({ success: false, error: 'Could not connect to page. Please refresh and try again.' });
                  } else if (pingResponse && pingResponse.pong) {
                    console.log('✅ Connection established');
                    resolve({ success: true });
                  } else {
                    console.error('No pong response:', pingResponse);
                    resolve({ success: false, error: 'Page connection failed. Please refresh and try again.' });
                  }
                });
              }, 500);
            } else {
              console.error('Failed to ensure content script:', response);
              resolve({ success: false, error: 'Failed to prepare page for scanning' });
            }
          });
        } catch (error) {
          console.error('Connection error:', error);
          resolve({ success: false, error: 'Connection failed: ' + error.message });
        }
      });
    });
  }

  // ────────── Quick Scan Functions ──────────
  async function startQuickScan() {
    console.log('⚡ Starting quick scan...');
    
    resetUI();
    viewMode = 'quick';
    
    try {
      const connection = await ensureConnectionToPage();
      
      if (!connection.success) {
        showError(connection.error);
        return;
      }

      if (scanStatus) scanStatus.textContent = 'Starting quick accessibility scan...';
      updateScanProgress(5);

      chrome.runtime.sendMessage({ action: 'startQuickScan' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Quick scan message error:', chrome.runtime.lastError);
          showError('Failed to start quick scan. Please refresh the page and try again.');
        } else if (!response || !response.success) {
          console.error('Quick scan failed:', response);
          showError('Quick scan failed: ' + (response?.error || 'Unknown error'));
        }
      });

    } catch (error) {
      console.error('Quick scan error:', error);
      showError('Failed to start quick scan: ' + error.message);
    }
  }

  function quickScanComplete(results) {
    console.log('⚡ Quick scan complete with', results.length, 'issues');
    
    hideProgress();
    enableButtons();
    
    currentResults = results.map(issue => ({
      ...issue,
      description: prettifyDescription(issue.description)
    }));
    
    viewMode = 'quick';
    chrome.storage.local.set({ lastQuickScanResults: currentResults });
    updateResultsView();
    
    showNotification(`Quick scan complete: ${currentResults.length} critical issues found`, 'success');
  }

  // ────────── Lesson Scan Functions ──────────
  async function startLessonScan() {
    console.log('📚 Starting lesson scan...');
    
    resetUI();
    viewMode = 'lesson';
    lessonScanActive = true;
    updateLessonScanUI(true);
    
    try {
      const connection = await ensureConnectionToPage();
      
      if (!connection.success) {
        showError(connection.error);
        return;
      }

      if (lessonStatus) lessonStatus.textContent = 'Starting lesson scan...';
      if (lessonProgress) lessonProgress.classList.remove('hidden');

      chrome.runtime.sendMessage({ action: 'startLessonScan' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Lesson scan message error:', chrome.runtime.lastError);
          showError('Failed to start lesson scan. Please refresh the page and try again.');
          updateLessonScanUI(false);
        } else if (!response || !response.success) {
          console.error('Lesson scan failed:', response);
          showError('Lesson scan failed: ' + (response?.error || 'Unknown error'));
          updateLessonScanUI(false);
        }
      });

    } catch (error) {
      console.error('Lesson scan error:', error);
      showError('Failed to start lesson scan: ' + error.message);
      updateLessonScanUI(false);
    }
  }

  async function stopLessonScan() {
    console.log('⏹️ Stopping lesson scan...');
    
    if (lessonStatus) lessonStatus.textContent = 'Stopping lesson scan...';
    if (stopLessonBtn) stopLessonBtn.disabled = true;

    chrome.runtime.sendMessage({ action: 'stopLessonScan' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Stop lesson scan message error:', chrome.runtime.lastError);
        showError('Failed to stop lesson scan.');
      } else if (!response || !response.success) {
        console.error('Stop lesson scan failed:', response);
        showError('Stop lesson scan failed: ' + (response?.error || 'Unknown error'));
      }
      
      updateLessonScanUI(false);
    });
  }

  function lessonScanStarted(request) {
    if (lessonStatus) lessonStatus.textContent = 'Lesson scan active - navigate through lesson screens...';
    if (currentScreenDisplay) currentScreenDisplay.textContent = request.currentScreen || 1;
    
    lessonScanData = request.screenData || [];
    updateLessonView();
  }

  function updateLessonProgress(request) {
    const { screenNumber, issuesCount, screenData } = request;
    
    if (lessonStatus) {
      lessonStatus.textContent = `Scanning screen ${screenNumber}... (${issuesCount} issues found)`;
    }
    
    if (currentScreenDisplay) currentScreenDisplay.textContent = screenNumber;
    
    lessonScanData = screenData || [];
    updateLessonView();
  }

  function lessonScanComplete(request) {
    console.log('📚 Lesson scan complete');
    
    hideProgress();
    enableButtons();
    updateLessonScanUI(false);
    
    const { results, screenData, summary } = request;
    
    currentResults = results.map(issue => ({
      ...issue,
      description: prettifyDescription(issue.description)
    }));
    
    lessonScanData = screenData || [];
    
    chrome.storage.local.set({ 
      lastLessonScanResults: currentResults,
      lastLessonScanScreenData: lessonScanData 
    });
    
    updateLessonView();
    
    showNotification(
      `Lesson scan complete: ${results.length} critical issues across ${summary.totalScreens} screens`, 
      'success'
    );
  }

  function updateLessonScanUI(isActive) {
    lessonScanActive = isActive;
    
    if (lessonScanBtn) lessonScanBtn.disabled = isActive;
    if (stopLessonBtn) {
      stopLessonBtn.disabled = !isActive;
      stopLessonBtn.classList.toggle('hidden', !isActive);
    }
    if (quickScanBtn) quickScanBtn.disabled = isActive;
    
    if (lessonScanContainer) {
      lessonScanContainer.classList.toggle('hidden', !isActive);
    }
  }

  // ────────── UI Update Functions ──────────
  function resetUI() {
    if (scanStatus) {
      scanStatus.textContent = 'Preparing scan...';
      scanStatus.classList.remove('hidden');
    }
    if (scanProgress) scanProgress.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.add('hidden');
    if (screensContainer) screensContainer.classList.add('hidden');
    if (issuesList) issuesList.innerHTML = '';
    if (screensList) screensList.innerHTML = '';
    
    // Disable buttons
    if (quickScanBtn) quickScanBtn.disabled = true;
    if (lessonScanBtn) lessonScanBtn.disabled = true;
    if (exportBtn) exportBtn.disabled = true;
  }

  function updateResultsView() {
    if (viewMode === 'lesson') {
      updateLessonView();
      return;
    }
    
    if (currentResults.length) {
      if (emptyState) emptyState.classList.add('hidden');
      if (resultsContainer) resultsContainer.classList.remove('hidden');
      if (screensContainer) screensContainer.classList.add('hidden');
      
      if (issueCount) issueCount.textContent = currentResults.length;
      
      // Enable export button
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.classList.remove('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
        exportBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'text-white');
      }
      
      updateSeverityCounts();
      renderIssuesList();
    } else {
      if (emptyState) emptyState.classList.remove('hidden');
      if (resultsContainer) resultsContainer.classList.add('hidden');
      if (screensContainer) screensContainer.classList.add('hidden');
    }
  }

  function updateLessonView() {
    if (lessonScanData.length) {
      if (emptyState) emptyState.classList.add('hidden');
      if (resultsContainer) resultsContainer.classList.add('hidden');
      if (screensContainer) screensContainer.classList.remove('hidden');
      
      const totalIssues = lessonScanData.reduce((sum, screen) => sum + (screen.issues?.length || 0), 0);
      if (totalIssuesDisplay) totalIssuesDisplay.textContent = totalIssues;
      
      // Enable export button
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.classList.remove('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
        exportBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'text-white');
      }
      
      updateSeverityCounts();
      renderLessonScreens();
    } else {
      if (emptyState) emptyState.classList.remove('hidden');
      if (resultsContainer) resultsContainer.classList.add('hidden');
      if (screensContainer) screensContainer.classList.add('hidden');
    }
  }

  function updateSeverityCounts() {
    const issues = viewMode === 'lesson' 
      ? lessonScanData.flatMap(screen => screen.issues || [])
      : currentResults;
    
    const severityCounts = {
      critical: issues.filter(i => i.severity === 'critical').length,
      serious: issues.filter(i => i.severity === 'serious').length,
      moderate: issues.filter(i => i.severity === 'moderate').length,
      minor: issues.filter(i => i.severity === 'minor').length
    };
    
    if (criticalCount) criticalCount.textContent = severityCounts.critical;
    if (seriousCount) seriousCount.textContent = severityCounts.serious;
    if (moderateCount) moderateCount.textContent = severityCounts.moderate;
    if (minorCount) minorCount.textContent = severityCounts.minor;
  }

  function renderIssuesList() {
    if (!issuesList) return;
    
    issuesList.innerHTML = '';
    const list = activeFilter === 'all'
      ? currentResults
      : currentResults.filter(i => i.category === activeFilter);

    if (!list.length) {
      issuesList.innerHTML = `
        <div class="text-center text-gray-400 py-12">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No ${activeFilter === 'all' ? '' : activeFilter} issues found</p>
        </div>`;
      return;
    }

    list.forEach(issue => {
      const el = document.createElement('div');
      el.className = `issue-item p-4 mx-4 my-2 rounded-lg cursor-pointer border-l-4 ${getSeverityClasses(issue.severity)}`;
      el.dataset.issueId = issue.id;
      
      el.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex-1 pr-3">
            <h4 class="font-medium text-gray-900">${issue.title}</h4>
            <p class="text-sm text-gray-600 mt-1">
              ${issue.description.slice(0, 120)}${issue.description.length > 120 ? '...' : ''}
            </p>
            <div class="flex items-center mt-2 text-xs text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span class="text-blue-600 font-medium">${issue.location || 'On the page'}</span>
            </div>
          </div>
          <div class="flex flex-col items-end space-y-1">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityBadgeClasses(issue.severity)}">
              ${issue.severity}
            </span>
          </div>
        </div>
      `;
      
      el.addEventListener('click', () => showIssueDetail(issue));
      el.addEventListener('mouseover', () => highlightElement(issue.selector));
      el.addEventListener('mouseout', () => removeHighlight());
      issuesList.appendChild(el);
    });
  }

  function renderLessonScreens() {
    if (!screensList) return;
    
    screensList.innerHTML = '';
    
    if (!lessonScanData.length) {
      screensList.innerHTML = `
        <div class="text-center text-gray-400 py-12">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p>No lesson screens scanned yet</p>
        </div>`;
      return;
    }

    lessonScanData.forEach(screen => {
      const issues = screen.issues || [];
      const filteredIssues = activeFilter === 'all' ? issues : issues.filter(i => i.category === activeFilter);
      
      const el = document.createElement('div');
      el.className = 'screen-item p-4 mx-4 my-2 rounded-lg cursor-pointer border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors';
      el.dataset.screenNumber = screen.screenNumber;
      
      const severityCounts = {
        critical: issues.filter(i => i.severity === 'critical').length,
        serious: issues.filter(i => i.severity === 'serious').length
      };
      
      el.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center space-x-2 mb-2">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Screen ${screen.screenNumber}
              </span>
              ${issues.length > 0 ? `
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  severityCounts.critical > 0 ? 'bg-red-100 text-red-800' :
                  severityCounts.serious > 0 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                }">
                  ${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}
                </span>
              ` : `
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✓ No issues
                </span>
              `}
            </div>
            <h4 class="font-medium text-gray-900 mb-1">${truncate(screen.title, 60)}</h4>
            <p class="text-xs text-gray-500">${screen.url}</p>
            ${issues.length > 0 ? `
              <div class="mt-2 flex space-x-2">
                ${severityCounts.critical > 0 ? `<span class="text-xs text-red-600">⚠️ ${severityCounts.critical} critical</span>` : ''}
                ${severityCounts.serious > 0 ? `<span class="text-xs text-orange-600">⚠️ ${severityCounts.serious} serious</span>` : ''}
              </div>
            ` : ''}
          </div>
          <div class="text-right">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      `;
      
      el.addEventListener('click', () => showScreenIssues(screen));
      screensList.appendChild(el);
    });
  }

  // ────────── Screen Issues View ──────────
  function showScreenIssues(screen) {
    console.log('Showing issues for screen:', screen.screenNumber);
    
    // Update currentResults to only show issues from this screen
    currentResults = screen.issues || [];
    viewMode = 'screen-detail';
    
    // Hide screens container and show results
    if (screensContainer) screensContainer.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.remove('hidden');
    
    // Update header to show screen context
    if (issueCount) issueCount.textContent = currentResults.length;
    
    // Add a back button to screen list
    const backToScreensBtn = document.createElement('button');
    backToScreensBtn.className = 'mb-4 text-sm text-blue-600 hover:text-blue-800 flex items-center';
    backToScreensBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      Back to all screens
    `;
    backToScreensBtn.addEventListener('click', () => {
      viewMode = 'lesson';
      updateLessonView();
      backToScreensBtn.remove();
    });
    
    if (resultsContainer) {
      resultsContainer.insertBefore(backToScreensBtn, resultsContainer.firstChild);
    }
    
    updateSeverityCounts();
    renderIssuesList();
  }

  // ────────── Issue Detail Modal ──────────
  function showIssueDetail(issue) {
    console.log('Showing detail for:', issue.title);
    
    currentIssueForAi = issue;
    
    if (detailTitle) detailTitle.textContent = issue.title;
    if (detailSeverity) detailSeverity.textContent = issue.severity.toUpperCase();
    if (detailCategory) detailCategory.textContent = issue.category === 'a11y' ? 'Accessibility' : 'UI/UX';
    
    if (detailContent) {
      detailContent.innerHTML = `
        <div class="space-y-4">
          <div class="detail-section">
            <h5>Description</h5>
            <div class="content-box">
              <p class="issue-description">${issue.description}</p>
            </div>
          </div>
          
          ${issue.location ? `
            <div class="detail-section">
              <h5>Location on Page</h5>
              <div class="content-box bg-blue-50 border-blue-200">
                <div class="flex items-start space-x-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span class="text-sm text-blue-800 font-medium">${issue.location}</span>
                </div>
              </div>
            </div>
          ` : ''}
          
          ${issue.screenInfo ? `
            <div class="detail-section">
              <h5>Screen Context</h5>
              <div class="content-box bg-purple-50 border-purple-200">
                <div class="space-y-2">
                  <div class="flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span class="text-sm font-medium text-purple-800">Screen ${issue.screenInfo.screenNumber}: ${issue.screenInfo.title}</span>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}
          
          <div class="detail-section">
            <h5>Affected Element</h5>
            <div class="content-box code">
              <code class="text-xs">${escapeHtml(issue.element)}</code>
            </div>
          </div>
          
          <div class="detail-section">
            <h5>CSS Selector</h5>
            <div class="content-box">
              <code class="text-xs text-gray-700">${issue.selector || 'N/A'}</code>
            </div>
          </div>
          
          ${issue.wcagLevel ? `
            <div class="detail-section">
              <h5>WCAG Guidelines</h5>
              <div class="flex items-center space-x-2">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  ${issue.wcagLevel}
                </span>
                ${issue.wcagReference ? `
                  <a href="${issue.wcagReference}" target="_blank" class="text-xs text-indigo-600 hover:text-indigo-800 underline">
                    View Guidelines ↗
                  </a>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    // Reset advanced AI UI
    if (advancedAiSuggestion) {
      advancedAiSuggestion.classList.add('hidden');
      advancedAiSuggestion.textContent = '';
    }
    
    if (fetchAiSuggestion) {
      fetchAiSuggestion.disabled = false;
      fetchAiSuggestion.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>Get AI Recommendation</span>
      `;
    }

    // Resize popup for modal and show
    resizeForModal(true);
    
    if (issueDetail) {
      issueDetail.classList.remove('hidden');
    }
    if (resultsContainer) {
      resultsContainer.classList.add('hidden');
    }
    if (screensContainer) {
      screensContainer.classList.add('hidden');
    }
    
    highlightElement(issue.selector);
  }

  // ────────── Utility Functions ──────────
  function getSeverityClasses(severity) {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'serious': return 'border-orange-500 bg-orange-50';
      case 'moderate': return 'border-green-500 bg-green-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  }

  function getSeverityBadgeClasses(severity) {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'serious': return 'bg-orange-100 text-orange-800';
      case 'moderate': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function updateScanProgress(pct) {
    console.log('📊 Progress:', pct + '%');
    
    const scanText = pct < 30 ? 'Analyzing page structure...' : 
                    pct < 70 ? 'Checking accessibility compliance...' :
                    'Finalizing scan...';
    
    if (scanStatus) scanStatus.textContent = scanText;
    if (progressPercent) progressPercent.textContent = `${pct}%`;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (scanProgress) scanProgress.classList.remove('hidden');
  }

  function hideProgress() {
    if (scanStatus) scanStatus.classList.add('hidden');
    if (scanProgress) scanProgress.classList.add('hidden');
    if (lessonProgress) lessonProgress.classList.add('hidden');
  }

  function enableButtons() {
    if (quickScanBtn) quickScanBtn.disabled = false;
    if (lessonScanBtn) lessonScanBtn.disabled = false;
    if (exportBtn) exportBtn.disabled = false;
  }

  function showError(message) {
    console.error('❌ Error:', message);
    
    hideProgress();
    enableButtons();
    updateLessonScanUI(false);
    
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.innerHTML = `
        <div class="text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto" fill="none"
               viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667
                     1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34
                     16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-700">Error</h3>
        <p class="text-gray-500 mt-1">${message}</p>
      `;
    }
    
    showNotification(message, 'error');
  }

  function highlightElement(selector) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightElement', selector });
      }
    });
  }

  function removeHighlight() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'removeHighlight' });
      }
    });
  }

  function exportReport(format = 'html') {
    if ((!currentResults || currentResults.length === 0) && (!lessonScanData || lessonScanData.length === 0)) {
      showNotification('No scan results to export', 'error');
      return;
    }

    const originalText = exportBtn.textContent;
    exportBtn.textContent = 'Exporting...';
    exportBtn.disabled = true;

    chrome.runtime.sendMessage({ 
      action: 'exportReport', 
      results: viewMode === 'lesson' ? lessonScanData.flatMap(s => s.issues || []) : currentResults,
      format: format,
      mode: viewMode,
      screenData: lessonScanData
    }, (response) => {
      exportBtn.textContent = originalText;
      exportBtn.disabled = false;

      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        showNotification('Export failed. Please try again.', 'error');
        return;
      }

      if (response && response.success) {
        showNotification(`${format.toUpperCase()} report exported successfully!`, 'success');
      } else {
        showNotification('Export failed. Please try again.', 'error');
        console.error('Export error:', response?.error);
      }
    });
  }

  function showNotification(message, type = 'info') {
    console.log(`📢 ${type}: ${message}`);
    
    const notification = document.createElement('div');
    notification.className = `notification px-4 py-3 rounded-lg text-white text-sm shadow-lg ${
      type === 'success' ? 'bg-green-600' : 
      type === 'error' ? 'bg-red-600' : 
      'bg-blue-600'
    }`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    `;
    notification.innerHTML = `
      <div class="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          ${type === 'success' ? 
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />' :
            type === 'error' ?
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />' :
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />'}
        </svg>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Add CSS for slide-in animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
});