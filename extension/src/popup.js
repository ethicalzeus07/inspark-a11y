// popup.js – Main script for the extension popup UI

document.addEventListener('DOMContentLoaded', function() {
  console.log("🎉 popup.js loaded");

  // DOM Elements
  const scanBtn                = document.getElementById('scanBtn');
  const globalScanBtn          = document.getElementById('globalScanBtn');
  const exportBtn              = document.getElementById('exportBtn');
  const scanStatus             = document.getElementById('scanStatus');
  const globalStatus           = document.getElementById('globalStatus');
  const resultsContainer       = document.getElementById('resultsContainer');
  const globalResultsContainer = document.getElementById('globalResultsContainer');
  const emptyState             = document.getElementById('emptyState');
  const issuesList             = document.getElementById('issuesList');
  const issueCount             = document.getElementById('issueCount');
  const filterBtns             = document.querySelectorAll('.filter-btn');
  const issueDetail            = document.getElementById('issueDetail');
  const closeDetail            = document.getElementById('closeDetail');
  const detailTitle            = document.getElementById('detailTitle');
  const detailContent          = document.getElementById('detailContent');
  const aiSuggestion           = document.getElementById('aiSuggestion');

  // State
  let currentResults = [];
  let globalResults  = {};    // { url: [issues...] }
  let activeFilter   = 'all';

  // Initialize per-page from storage
  chrome.storage.local.get(['lastScanResults'], ({ lastScanResults }) => {
    if (lastScanResults) {
      currentResults = lastScanResults;
      updateResultsView();
    }
  });

  // ─── Button handlers ─────────────────────────────────────────────

  scanBtn.addEventListener('click', startScan);
  globalScanBtn.addEventListener('click', startGlobalScan);
  exportBtn.addEventListener('click', exportReport);

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      filterBtns.forEach(b => b.classList.remove('bg-blue-100','border-blue-300'));
      btn.classList.add('bg-blue-100','border-blue-300');
      renderIssuesList();
    });
  });

  closeDetail.addEventListener('click', () => issueDetail.classList.add('hidden'));

  // ─── Start a single-page scan ────────────────────────────────────

  function startScan() {
    scanStatus.textContent = 'Scanning page… 0%';
    scanStatus.classList.remove('hidden');
    emptyState.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    issuesList.innerHTML = '';
    scanBtn.disabled = exportBtn.disabled = globalScanBtn.disabled = true;

    chrome.tabs.query({ active:true, currentWindow:true }, tabs => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'startScan' },
        () => {
          if (chrome.runtime.lastError) {
            showError('Could not connect to page. Please refresh and try again.');
          }
        }
      );
    });
  }

  // ─── Start a full global scan ─────────────────────────────────────

  function startGlobalScan() {
    globalStatus.textContent = 'Global scan in progress…';
    globalStatus.classList.remove('hidden');
    globalResultsContainer.innerHTML = '';
    scanBtn.disabled = exportBtn.disabled = globalScanBtn.disabled = true;

    chrome.tabs.query({ active:true, currentWindow:true }, tabs => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'startGlobalScan' },
        () => {
          if (chrome.runtime.lastError) {
            showError('Could not start global scan. Please refresh and try again.');
          }
        }
      );
    });
  }

  // ─── Message listener ─────────────────────────────────────────────

  chrome.runtime.onMessage.addListener(request => {
    console.log("🛰️ popup.js got message:", request);
    switch(request.action) {
      case 'scanProgress':
        updateScanProgress(request.progress);
        break;
      case 'scanComplete':
        scanComplete(request.results);
        break;
      case 'globalScanComplete':
        handleGlobalComplete(request.globalResults);
        break;
      case 'scanError':
        showError(request.error);
        break;
      case 'aiSuggestionReady':
        updateAiSuggestion(request.issueId, request.suggestion);
        break;
    }
    return true;
  });

  // ─── Handlers ────────────────────────────────────────────────────

  function scanComplete(results) {
    // hide global results when doing a page scan
    globalResultsContainer.classList.add('hidden');

    scanStatus.classList.add('hidden');
    scanBtn.disabled = exportBtn.disabled = globalScanBtn.disabled = false;
    currentResults = results;
    chrome.storage.local.set({ lastScanResults: results });
    updateResultsView();
  }

  function handleGlobalComplete(results) {
    // hide per-page results when doing a global scan
    resultsContainer.classList.add('hidden');

    globalStatus.classList.add('hidden');
    scanBtn.disabled = exportBtn.disabled = globalScanBtn.disabled = false;
    globalResults = results;
    updateGlobalResultsView();
  }

  // ─── Per-page UI updates ──────────────────────────────────────────

  function updateResultsView() {
    if (currentResults.length) {
      emptyState.classList.add('hidden');
      resultsContainer.classList.remove('hidden');
      exportBtn.disabled = false;
      issueCount.textContent = currentResults.length;
      renderIssuesList();
    } else {
      emptyState.classList.remove('hidden');
      resultsContainer.classList.add('hidden');
      exportBtn.disabled = true;
    }
  }

  function renderIssuesList() {
    issuesList.innerHTML = '';
    const list = activeFilter === 'all'
      ? currentResults
      : currentResults.filter(i => i.category === activeFilter);

    if (!list.length) {
      issuesList.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          No ${activeFilter==='all'?'':activeFilter} issues found
        </div>`;
      return;
    }

    list.forEach(issue => {
      const el = document.createElement('div');
      el.className = `issue-highlight p-3 bg-white rounded shadow-sm ${issue.severity}`;
      el.dataset.issueId = issue.id;
      el.innerHTML = `
        <div class="flex justify-between">
          <div class="font-medium">${issue.title}</div>
          <div class="text-xs px-2 py-1 rounded ${getSeverityClass(issue.severity)}">
            ${issue.severity}
          </div>
        </div>
        <div class="text-sm text-gray-600 mt-1">
          ${issue.description.slice(0,100)}${issue.description.length>100?'…':''}
        </div>
        <div class="text-xs text-gray-500 mt-2">Element: ${issue.element}</div>
      `;
      el.addEventListener('click', () => showIssueDetail(issue));
      el.addEventListener('mouseover', () => highlightElement(issue.selector));
      el.addEventListener('mouseout', () => removeHighlight());
      issuesList.appendChild(el);
    });
  }

  // ─── Global-scan UI updates ───────────────────────────────────────

  function updateGlobalResultsView() {
    globalResultsContainer.innerHTML = '<h4 class="font-medium mb-2">Global Scan Results</h4>';
    Object.entries(globalResults).forEach(([url, issues]) => {
      const item = document.createElement('div');
      item.className = 'mb-2 text-sm';
      item.innerHTML = `<strong>${url}</strong>: ${issues.length} issue(s)`;
      globalResultsContainer.appendChild(item);
    });
    globalResultsContainer.classList.remove('hidden');
  }

  // ─── Helpers (unchanged) ─────────────────────────────────────────

  function showIssueDetail(issue) {
    detailTitle.textContent = issue.title;
    detailContent.innerHTML = `
      <div class="mb-4">
        <div class="text-xs font-medium text-gray-500 uppercase mb-1">Description</div>
        <div class="text-sm">${issue.description}</div>
      </div>
      <div class="mb-4">
        <div class="text-xs font-medium text-gray-500 uppercase mb-1">Element</div>
        <div class="text-sm font-mono bg-gray-100 p-2 rounded">${issue.element}</div>
      </div>
      <div class="mb-4">
        <div class="text-xs font-medium text-gray-500 uppercase mb-1">Selector</div>
        <div class="text-sm font-mono bg-gray-100 p-2 rounded overflow-x-auto">${issue.selector}</div>
      </div>
      ${issue.screenshot ? `
        <div class="mb-4">
          <div class="text-xs font-medium text-gray-500 uppercase mb-1">Screenshot</div>
          <img src="${issue.screenshot}" alt="Issue screenshot" class="border border-gray-200 rounded max-w-full h-auto">
        </div>
      ` : ''}
    `;
    aiSuggestion.textContent = issue.aiSuggestion || 'Generating AI recommendation…';
    if (!issue.aiSuggestion) {
      chrome.runtime.sendMessage({ action: "getAiSuggestion", issue });
    }
    issueDetail.classList.remove('hidden');
    highlightElement(issue.selector);
  }

  function updateAiSuggestion(issueId, suggestion) {
    const idx = currentResults.findIndex(i => i.id === issueId);
    if (idx > -1) {
      currentResults[idx].aiSuggestion = suggestion;
      chrome.storage.local.set({ lastScanResults: currentResults });
      if (!issueDetail.classList.contains('hidden') &&
          detailTitle.textContent === currentResults[idx].title) {
        aiSuggestion.textContent = suggestion;
      }
    }
  }

  function highlightElement(selector) {
    chrome.tabs.query({ active:true, currentWindow:true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "highlightElement", selector });
    });
  }

  function removeHighlight() {
    chrome.tabs.query({ active:true, currentWindow:true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "removeHighlight" });
    });
  }

  function exportReport() {
    chrome.runtime.sendMessage({ action: "exportReport", results: currentResults });
  }

  function showError(message) {
    scanStatus.classList.add('hidden');
    globalStatus.classList.add('hidden');
    scanBtn.disabled = exportBtn.disabled = globalScanBtn.disabled = false;
    emptyState.classList.remove('hidden');
    emptyState.innerHTML = `
      <div class="text-red-500 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3
                   L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16
                   c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-700">Error</h3>
      <p class="text-gray-500 mt-1">${message}</p>
    `;
  }

  function getSeverityClass(sev) {
    switch (sev) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'serious':  return 'bg-orange-100 text-orange-800';
      case 'moderate': return 'bg-green-100 text-green-800';
      case 'minor':    return 'bg-gray-100 text-gray-800';
      default:         return 'bg-gray-100 text-gray-800';
    }
  }

  function updateScanProgress(pct) {
    scanStatus.textContent = `Scanning page… ${pct}%`;
  }
});
