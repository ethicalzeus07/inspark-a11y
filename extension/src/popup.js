// popup.js – Complete working version with modal, PDF, and resizing

document.addEventListener('DOMContentLoaded', () => {
  console.log("🎉 popup.js loaded");

  // ────────── DOM Elements ──────────
  const scanBtn = document.getElementById('scanBtn');
  const globalScanBtn = document.getElementById('globalScanBtn');
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
  const advancedAiSuggestion = document.getElementById('deepseekAiSuggestion');
  
  // Summary elements
  const criticalCount = document.getElementById('criticalCount');
  const seriousCount = document.getElementById('seriousCount');
  const moderateCount = document.getElementById('moderateCount');
  const minorCount = document.getElementById('minorCount');
  const quickActions = document.getElementById('quickActions');

  // ────────── State ──────────
  let currentResults = [];
  let activeFilter = 'all';
  let currentIssueForAi = null;

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

  // Function to resize popup for modal
  function resizeForModal(isOpen = false) {
    if (isOpen) {
      // Expand popup for modal
      document.body.style.width = '600px';
      document.body.style.maxHeight = '90vh';
      document.body.classList.add('modal-open');
    } else {
      // Restore original size
      document.body.style.width = '480px';
      document.body.style.maxHeight = '700px';
      document.body.classList.remove('modal-open');
    }
  }

  // Load last scan from storage
  chrome.storage.local.get(['lastScanResults'], ({ lastScanResults }) => {
    if (lastScanResults) {
      currentResults = lastScanResults.map(issue => ({
        ...issue,
        description: prettifyDescription(issue.description)
      }));
      updateResultsView();
    }
  });

  // ────────── Modal Functionality ──────────
  function closeModal() {
    // Restore original popup size
    resizeForModal(false);
    
    if (issueDetail) {
      issueDetail.classList.add('hidden');
    }
    if (resultsContainer) {
      resultsContainer.classList.remove('hidden');
    }
  }

  // Modal event listeners
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
  }

  if (closeDetail) {
    closeDetail.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
  }

  // Prevent closing when clicking inside modal content
  const modalContent = document.querySelector('.modal-content');
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && issueDetail && !issueDetail.classList.contains('hidden')) {
      closeModal();
    }
  });

  // ────────── Export Dropdown Setup ──────────
  const exportDropdown = document.getElementById('exportDropdown');
  
  // Create export dropdown if it doesn't exist
  if (!exportDropdown && exportBtn) {
    const dropdownHtml = `
      <div id="exportDropdown" class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl z-50 hidden border border-gray-200 overflow-hidden">
        <div class="py-1">
          <button class="export-option flex items-center space-x-3 w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors border-b border-gray-100" data-format="pdf">
            <span class="text-lg">📋</span>
            <div>
              <div class="font-medium">PDF Report</div>
              <div class="text-xs text-gray-500">Professional report with AI suggestions</div>
            </div>
          </button>
          <button class="export-option flex items-center space-x-3 w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors" data-format="html">
            <span class="text-lg">📄</span>
            <span>HTML Report</span>
          </button>
          <button class="export-option flex items-center space-x-3 w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors" data-format="csv">
            <span class="text-lg">📊</span>
            <span>CSV Export</span>
          </button>
          <button class="export-option flex items-center space-x-3 w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors" data-format="json">
            <span class="text-lg">📋</span>
            <span>JSON Data</span>
          </button>
          <button class="export-option flex items-center space-x-3 w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors" data-format="markdown">
            <span class="text-lg">📝</span>
            <span>Markdown</span>
          </button>
        </div>
      </div>
    `;
    
    if (exportBtn.parentElement) {
      exportBtn.parentElement.style.position = 'relative';
      exportBtn.parentElement.insertAdjacentHTML('beforeend', dropdownHtml);
    }
  }

  // ────────── Event Handlers ──────────
  if (scanBtn) {
    scanBtn.addEventListener('click', startScan);
  }
  
  if (globalScanBtn) {
    globalScanBtn.addEventListener('click', startBatchScan);
  }
  
  // Export button click handler
  if (exportBtn) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!exportBtn.disabled) {
        const dropdown = document.getElementById('exportDropdown');
        if (dropdown) {
          dropdown.classList.toggle('hidden');
        }
      }
    });
  }

  // Export format handlers
  document.addEventListener('click', (e) => {
    if (e.target.closest('.export-option')) {
      const format = e.target.closest('.export-option').dataset.format;
      const dropdown = document.getElementById('exportDropdown');
      if (dropdown) dropdown.classList.add('hidden');
      exportReport(format);
    } else if (!e.target.closest('#exportBtn')) {
      // Close dropdown when clicking outside
      const dropdown = document.getElementById('exportDropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }
  });

  // Quick export handlers
  document.addEventListener('click', (e) => {
    if (e.target.closest('.quick-export')) {
      const format = e.target.closest('.quick-export').dataset.format;
      exportReport(format);
    }
  });

  // Filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      filterBtns.forEach(b => {
        b.classList.remove('active', 'bg-blue-100', 'border-blue-300');
      });
      btn.classList.add('active', 'bg-blue-100', 'border-blue-300');
      renderIssuesList();
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
        // Get AI suggestion
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ 
            action: 'getAiSuggestion', 
            issue: currentIssueForAi 
          }, resolve);
        });

        const suggestion = response?.suggestion || "Review WCAG guidelines for this accessibility issue. Consider using semantic HTML and proper ARIA labels.";
        
        // Display the AI suggestion
        if (advancedAiSuggestion) {
          if (suggestion.length > 300) {
            advancedAiSuggestion.innerHTML = `
              <div class="space-y-2">
                <div class="text-sm">${suggestion.slice(0, 300)}...</div>
                <button class="text-xs text-purple-600 hover:text-purple-800 underline" onclick="this.parentElement.innerHTML='${escapeHtml(suggestion)}'">
                  Show full analysis
                </button>
              </div>
            `;
          } else {
            advancedAiSuggestion.textContent = suggestion;
          }
        }

        // Log AI suggestion in currentResults and storage
        const idx = currentResults.findIndex(i => i.id === currentIssueForAi.id);
        if (idx > -1) {
          currentResults[idx].advancedAiSuggestion = suggestion;
          chrome.storage.local.set({ lastScanResults: currentResults });
        }
        
        showNotification('AI analysis complete!', 'success');
      } catch (error) {
        console.error('AI suggestion error:', error);
        if (advancedAiSuggestion) {
          advancedAiSuggestion.innerHTML = `
            <div class="flex items-center space-x-2 text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Could not get AI analysis. Please check your connection and try again.</span>
            </div>
          `;
        }
        showNotification('AI analysis failed. Please try again.', 'error');
      }

      fetchAiSuggestion.disabled = false;
      fetchAiSuggestion.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>Get Advanced AI Analysis</span>
      `;
    });
  }

  // ────────── Message Listeners ──────────
  chrome.runtime.onMessage.addListener(request => {
    console.log('📨 Popup received message:', request.action);
    switch(request.action) {
      case 'scanProgress':
        return updateScanProgress(request.progress);
      case 'scanComplete':
        return scanComplete(request.results);
      case 'batchScanStarted':
        return batchScanStarted(request);
      case 'batchScanProgress':
        return updateBatchProgress(request);
      case 'batchScanComplete':
        return batchScanComplete(request);
      case 'scanError':
        return showError(request.error);
      case 'aiSuggestionReady':
        return updateAiSuggestion(request.issueId, request.suggestion);
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

  // ────────── Scan Functions ──────────
  async function startScan() {
    console.log('🔍 Starting scan...');
    
    resetUI();
    
    try {
      const connection = await ensureConnectionToPage();
      
      if (!connection.success) {
        showError(connection.error);
        return;
      }

      if (scanStatus) scanStatus.textContent = 'Starting accessibility scan...';
      updateScanProgress(5);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'startScan' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Scan message error:', chrome.runtime.lastError);
              showError('Failed to start scan. Please refresh the page and try again.');
            } else if (!response || !response.success) {
              console.error('Scan failed:', response);
              showError('Scan failed: ' + (response?.error || 'Unknown error'));
            }
          });
        }
      });

    } catch (error) {
      console.error('Scan error:', error);
      showError('Failed to start scan: ' + error.message);
    }
  }

  async function startBatchScan() {
    console.log('📚 Starting batch scan...');
    
    resetUI();
    if (scanStatus) scanStatus.textContent = 'Analyzing lesson structure...';
    
    try {
      const connection = await ensureConnectionToPage();
      
      if (!connection.success) {
        showError(connection.error);
        return;
      }

      updateScanProgress(5);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'startBatchScan' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Batch scan message error:', chrome.runtime.lastError);
              showError('Failed to start batch scan. Please refresh the page and try again.');
            } else if (!response || !response.success) {
              console.error('Batch scan failed:', response);
              showError('Batch scan failed: ' + (response?.error || 'Unknown error'));
            }
          });
        }
      });

    } catch (error) {
      console.error('Batch scan error:', error);
      showError('Failed to start batch scan: ' + error.message);
    }
  }

  function resetUI() {
    if (scanStatus) {
      scanStatus.textContent = 'Preparing scan...';
      scanStatus.classList.remove('hidden');
    }
    if (scanProgress) scanProgress.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.add('hidden');
    if (issuesList) issuesList.innerHTML = '';
    
    // Disable buttons
    if (scanBtn) scanBtn.disabled = true;
    if (exportBtn) exportBtn.disabled = true;
    if (globalScanBtn) globalScanBtn.disabled = true;
  }

  // ────────── Response Handlers ──────────
  function scanComplete(results) {
    console.log('✅ Scan complete with', results.length, 'issues');
    
    hideProgress();
    enableButtons();
    
    currentResults = results.map(issue => ({
      ...issue,
      description: prettifyDescription(issue.description)
    }));
    
    chrome.storage.local.set({ lastScanResults: currentResults });
    updateResultsView();
    
    showNotification(`Scan complete: ${currentResults.length} issues found`, 'success');
  }

  function batchScanStarted(request) {
    if (scanStatus) {
      scanStatus.textContent = request.message || 'Starting batch scan...';
      scanStatus.classList.remove('hidden');
    }
    if (scanProgress) scanProgress.classList.remove('hidden');
  }

  function updateBatchProgress(request) {
    const { progress, current, total, screenTitle } = request;
    
    if (scanStatus) {
      scanStatus.textContent = screenTitle ? 
        `Scanning "${screenTitle}" (${current}/${total})...` : 
        `Scanning lesson screens... ${progress}%`;
    }
    
    updateScanProgress(progress);
  }

  function batchScanComplete(request) {
    console.log('✅ Batch scan complete');
    
    hideProgress();
    enableButtons();
    
    const { results, batchInfo } = request;
    
    currentResults = results.map(issue => ({
      ...issue,
      description: prettifyDescription(issue.description),
      isBatchResult: true,
      batchInfo
    }));
    
    chrome.storage.local.set({ lastScanResults: currentResults });
    updateResultsView();
    
    showNotification(
      `Batch scan complete: ${results.length} issues across ${batchInfo.totalScreens} screens`, 
      'success'
    );
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
  }

  function enableButtons() {
    if (scanBtn) scanBtn.disabled = false;
    if (exportBtn) exportBtn.disabled = false;
    if (globalScanBtn) globalScanBtn.disabled = false;
  }

  function showError(message) {
    console.error('❌ Error:', message);
    
    hideProgress();
    enableButtons();
    
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

  // ────────── UI Functions ──────────
  function updateResultsView() {
    if (currentResults.length) {
      if (emptyState) emptyState.classList.add('hidden');
      if (resultsContainer) resultsContainer.classList.remove('hidden');
      
      if (issueCount) issueCount.textContent = currentResults.length;
      
      // Enable export button
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.classList.remove('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
        exportBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'text-white');
      }
      
      // Update severity counts
      const severityCounts = {
        critical: currentResults.filter(i => i.severity === 'critical').length,
        serious: currentResults.filter(i => i.severity === 'serious').length,
        moderate: currentResults.filter(i => i.severity === 'moderate').length,
        minor: currentResults.filter(i => i.severity === 'minor').length
      };
      
      if (criticalCount) criticalCount.textContent = severityCounts.critical;
      if (seriousCount) seriousCount.textContent = severityCounts.serious;
      if (moderateCount) moderateCount.textContent = severityCounts.moderate;
      if (minorCount) minorCount.textContent = severityCounts.minor;
      
      if (quickActions) quickActions.classList.remove('hidden');
      
      updateScoreVisualization();
      renderIssuesList();
    } else {
      if (emptyState) emptyState.classList.remove('hidden');
      if (resultsContainer) resultsContainer.classList.add('hidden');
      if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.classList.add('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
        exportBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'text-white');
      }
    }
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
      el.className = `issue-item p-4 mx-4 my-2 rounded-lg cursor-pointer ${issue.severity}`;
      el.dataset.issueId = issue.id;
      
      const locationText = issue.location || 'On the page';
      const batchContext = issue.isBatchResult && issue.screenInfo ? 
        `Screen: ${issue.screenInfo.title}` : '';
      
      el.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex-1 pr-3">
            <h4 class="font-medium text-gray-900">${issue.title}</h4>
            <p class="text-sm text-gray-600 mt-1">
              ${issue.description.slice(0, 120)}${issue.description.length > 120 ? '...' : ''}
            </p>
            <div class="flex items-start mt-2 text-xs text-gray-500 space-y-1 flex-col">
              <div class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span class="text-blue-600 font-medium">${locationText}</span>
              </div>
              ${batchContext ? `
                <div class="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span class="text-purple-600">${batchContext}</span>
                </div>
              ` : ''}
              <div class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <code class="bg-gray-100 px-1 rounded text-gray-700">${truncate(issue.element, 50)}</code>
              </div>
            </div>
          </div>
          <div class="flex flex-col items-end space-y-1">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              ${issue.severity === 'critical' ? 'bg-red-100 text-red-800' : 
                issue.severity === 'serious' ? 'bg-orange-100 text-orange-800' :
                issue.severity === 'moderate' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'}">
              ${issue.severity}
            </span>
            ${issue.isBatchResult ? `
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
                Batch
              </span>
            ` : ''}
          </div>
        </div>
      `;
      
      el.addEventListener('click', () => showIssueDetail(issue));
      el.addEventListener('mouseover', () => highlightElement(issue.selector));
      el.addEventListener('mouseout', () => removeHighlight());
      issuesList.appendChild(el);
    });
  }

  function updateScoreVisualization() {
    const severityWeights = { critical: 10, serious: 5, moderate: 2, minor: 1 };
    let totalWeight = 0;
    
    currentResults.forEach(issue => {
      totalWeight += severityWeights[issue.severity] || 1;
    });
    
    const score = Math.max(0, 100 - totalWeight);
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    const color = score >= 90 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444';
    
    const scoreRing = document.getElementById('scoreRing');
    if (scoreRing) {
      scoreRing.innerHTML = `
        <svg class="w-full h-full">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" stroke-width="8"/>
          <circle cx="60" cy="60" r="54" fill="none" stroke="${color}" stroke-width="8"
                  class="score-ring-circle"
                  style="stroke-dashoffset: ${339.292 - (339.292 * score / 100)}"/>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <div class="text-2xl font-bold" style="color: ${color}">${grade}</div>
            <div class="text-xs text-gray-500">${score}/100</div>
          </div>
        </div>
      `;
    }
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
          
          ${issue.isBatchResult && issue.screenInfo ? `
            <div class="detail-section">
              <h5>Screen Context</h5>
              <div class="content-box bg-purple-50 border-purple-200">
                <div class="space-y-2">
                  <div class="flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span class="text-sm font-medium text-purple-800">${issue.screenInfo.title}</span>
                  </div>
                  <div class="text-xs text-purple-600">
                    Screen ${issue.screenInfo.index} of ${issue.screenInfo.total} • ${issue.screenInfo.type}
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

    // Set AI suggestion
    if (aiSuggestion) {
      aiSuggestion.textContent = issue.aiSuggestion || 'Getting basic accessibility recommendation...';
      if (!issue.aiSuggestion) {
        chrome.runtime.sendMessage({ action: 'getAiSuggestion', issue });
      }
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
        <span>Get Advanced AI Analysis</span>
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
    
    highlightElement(issue.selector);
  }

  function updateAiSuggestion(issueId, suggestion) {
    const idx = currentResults.findIndex(i => i.id === issueId);
    if (idx > -1) {
      currentResults[idx].aiSuggestion = suggestion;
      chrome.storage.local.set({ lastScanResults: currentResults });
      if (issueDetail && !issueDetail.classList.contains('hidden') &&
          detailTitle && detailTitle.textContent === currentResults[idx].title) {
        if (aiSuggestion) aiSuggestion.textContent = suggestion;
      }
    }
  }

  // ────────── Helper Functions ──────────
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
    if (!currentResults || currentResults.length === 0) {
      showNotification('No scan results to export', 'error');
      return;
    }

    // Show loading state
    const originalText = exportBtn.textContent;
    exportBtn.textContent = 'Exporting...';
    exportBtn.disabled = true;

    // Handle PDF generation separately
    if (format === 'pdf') {
      generatePdfReport();
      return;
    }

    // Handle other formats via background script
    chrome.runtime.sendMessage({ 
      action: 'exportReport', 
      results: currentResults,
      format: format 
    }, (response) => {
      // Restore button state
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

  async function generatePdfReport() {
    try {
      showNotification('Generating PDF report...', 'info');
      
      // Get current tab URL
      const tabs = await new Promise(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });
      const currentUrl = tabs[0]?.url || window.location.href;
      
      // Generate simple HTML report and trigger download
      const htmlContent = generateSimplePdfReport({
        url: currentUrl,
        issues: currentResults.map(issue => ({
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          category: issue.category,
          element: issue.element,
          selector: issue.selector,
          aiSuggestion: issue.advancedAiSuggestion || issue.aiSuggestion
        }))
      });
      
      // Create and download file
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const domain = currentUrl.split('/')[2] || 'report';
      a.download = `accessibility_report_${domain}_${timestamp}.html`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showNotification('PDF report downloaded successfully!', 'success');
      
    } catch (error) {
      console.error('PDF generation error:', error);
      showNotification('Failed to generate PDF report. Please try again.', 'error');
    } finally {
      exportBtn.textContent = 'Export';
      exportBtn.disabled = false;
    }
  }

  function generateSimplePdfReport(data) {
    const timestamp = new Date().toLocaleString();
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Accessibility Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: linear-gradient(135deg, #10b981, #3b82f6); color: white; padding: 20px; border-radius: 8px; }
        .issue { margin: 20px 0; padding: 15px; border-radius: 8px; border-left: 4px solid #e5e7eb; }
        .critical { border-left-color: #ef4444; background: #fef2f2; }
        .serious { border-left-color: #f59e0b; background: #fffbeb; }
        .moderate { border-left-color: #10b981; background: #f0fdf4; }
        .minor { border-left-color: #6b7280; background: #f9fafb; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ Accessibility Report</h1>
        <p>Generated on ${timestamp}</p>
        <p>URL: ${data.url}</p>
    </div>
    
    <h2>Summary</h2>
    <p>Total Issues: ${data.issues.length}</p>
    
    <h2>Issues</h2>
    ${data.issues.map((issue, index) => `
        <div class="issue ${issue.severity}">
            <h3>${index + 1}. ${issue.title}</h3>
            <p><strong>Severity:</strong> ${issue.severity}</p>
            <p><strong>Description:</strong> ${issue.description}</p>
            ${issue.aiSuggestion ? `<p><strong>AI Suggestion:</strong> ${issue.aiSuggestion}</p>` : ''}
        </div>
    `).join('')}
</body>
</html>`;
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