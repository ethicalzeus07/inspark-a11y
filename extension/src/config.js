// config.js - Enhanced configuration for lesson scanning

// Environment settings
const ENV = {
  development: {
    microserviceUrl: 'http://localhost:8000/api',
    debug: true
  },
  production: {
    microserviceUrl: 'https://your-microservice-domain.com/api', // Update with your actual domain
    debug: false
  }
};

// Current environment - Change to 'production' when deploying
const CURRENT_ENV = 'development';

// Export configuration
export const config = {
  ...ENV[CURRENT_ENV],
  version: '2.0.0',
  appName: 'Inspark Accessibility Testing Assistant - Lesson Scanner',
  
  // Storage keys
  storageKeys: {
    settings: 'inspark_a11y_settings',
    lastQuickScanResults: 'inspark_a11y_lastQuickScanResults',
    lastLessonScanResults: 'inspark_a11y_lastLessonScanResults',
    lastLessonScanScreenData: 'inspark_a11y_lastLessonScanScreenData',
    sessionHistory: 'inspark_a11y_sessionHistory'
  },
  
  // Default settings
  defaultSettings: {
    highlightIssues: true,
    autoScanOnLoad: false,
    aiSuggestions: true,
    includePdfAiSuggestions: true,
    criticalIssuesOnly: true, // New: Only scan for critical/serious issues
    lessonScanMode: 'auto', // 'auto' or 'manual'
    screenChangeDetection: true,
    maxScreensPerLesson: 50 // Prevent infinite scanning
  },
  
  // API endpoints
  endpoints: {
    suggest: 'suggest',
    aiSuggest: 'ai_suggest', 
    analyze: 'analyze',
    health: 'health',
    generateReport: 'generate_report'
  },
  
  // Lesson scanning configuration
  lessonScan: {
    // Screen change detection settings
    screenDetection: {
      urlChangeDelay: 1000, // ms to wait after URL change
      contentChangeDelay: 2000, // ms to wait after significant content change
      titleChangeDelay: 1000, // ms to wait after title change
      
      // What constitutes a significant content change
      significantChangeSelectors: [
        'main', 'section', 'article', '.lesson-content', 
        '.screen-content', '[data-lesson-screen]'
      ],
      
      // Minimum nodes that need to change
      minNodesForSignificantChange: 3
    },
    
    // Scanning preferences
    scanning: {
      onlyShowCriticalIssues: true, // Focus on critical/serious issues
      maxIssuesPerScreen: 20, // Prevent overwhelming results
      scanDelay: 500, // ms delay before scanning new screen
      
      // WCAG rules to focus on for educational content
      priorityRules: [
        'color-contrast',
        'keyboard-navigation', 
        'aria-labels',
        'heading-structure',
        'form-label',
        'link-purpose',
        'focus-management',
        'image-alt'
      ]
    },
    
    // UI preferences
    ui: {
      autoCollapseScreens: true, // Collapse screens with no issues
      showScreenThumbnails: false, // Future feature
      groupSimilarIssues: true,
      
      // Progress indicators
      showLiveProgress: true,
      showScreenCounter: true,
      showIssueCounter: true
    }
  },
  
  // Educational platform detection
  platformDetection: {
    inspark: {
      hostnames: ['inspark.education', 'app.inspark.education', 'learn.inspark.education'],
      lessonPathPatterns: [
        '/lesson/',
        '/course/',
        '/module/',
        '/unit/',
        '/screen/'
      ],
      screenIndicators: [
        '[data-screen]',
        '.lesson-screen',
        '.course-screen',
        '.module-content'
      ]
    },
    
    // Other LMS patterns for future expansion
    generic: {
      lessonPathPatterns: [
        '/learn/',
        '/training/',
        '/course/',
        '/lesson/',
        '/module/'
      ]
    }
  },
  
  // AI suggestion configuration
  aiSuggestions: {
    // When to use AI vs heuristics
    useAiFor: ['critical', 'serious'], // Severity levels
    
    // Educational context prompts
    educationalPrompts: {
      assessment: "This is a quiz or test interface. Ensure accessibility for students with extra time accommodations and those using assistive technology.",
      video: "This is educational video content. Prioritize captions, transcripts, and audio descriptions.",
      assignment: "This is an assignment interface. Ensure instructions are clear and accessible to all students.",
      discussion: "This is a discussion forum. Focus on keyboard navigation and screen reader compatibility.",
      lesson: "This is lesson content. Ensure all learning materials are accessible to students with disabilities."
    }
  },
  
  // Export and reporting
  reporting: {
    formats: ['html', 'pdf', 'csv', 'json'],
    includeScreenshots: false, // Future feature
    groupByScreen: true, // For lesson scan reports
    includeSummaryStats: true,
    
    // PDF report settings
    pdf: {
      includeAiSuggestions: true,
      includeScreenBreakdown: true,
      includeWcagReferences: true,
      maxIssuesPerPage: 5
    }
  }
};

// Helper functions
export function getApiEndpoint(path) {
  const endpoint = config.endpoints[path] || path;
  return `${config.microserviceUrl}/${endpoint}`;
}

export function debugLog(...args) {
  if (config.debug) {
    console.log('[Inspark A11y]', ...args);
  }
}

export function isInsparkPlatform() {
  const hostname = window.location?.hostname || '';
  return config.platformDetection.inspark.hostnames.some(host => 
    hostname.includes(host)
  );
}

export function detectLessonContext() {
  const pathname = window.location?.pathname || '';
  const title = document.title || '';
  
  // Check if we're in a lesson/course context
  const isLessonPath = config.platformDetection.inspark.lessonPathPatterns.some(pattern =>
    pathname.includes(pattern)
  );
  
  if (isLessonPath) {
    // Detect lesson type from URL and content
    const lower = (pathname + ' ' + title).toLowerCase();
    
    if (lower.includes('quiz') || lower.includes('test') || lower.includes('exam')) {
      return 'assessment';
    }
    if (lower.includes('video') || lower.includes('media')) {
      return 'video';
    }
    if (lower.includes('assignment') || lower.includes('homework')) {
      return 'assignment';
    }
    if (lower.includes('discussion') || lower.includes('forum')) {
      return 'discussion';
    }
    
    return 'lesson';
  }
  
  return null;
}

export function getScreenIdentifiers() {
  const indicators = config.platformDetection.inspark.screenIndicators;
  
  // Try to find screen number or ID
  for (const selector of indicators) {
    const element = document.querySelector(selector);
    if (element) {
      const screenNum = element.dataset.screen || 
                       element.dataset.index ||
                       element.getAttribute('data-lesson-screen');
      if (screenNum) {
        return { screenNumber: parseInt(screenNum), element };
      }
    }
  }
  
  return null;
}

export function shouldUseLessonScanning() {
  const lessonContext = detectLessonContext();
  const isInspark = isInsparkPlatform();
  
  return lessonContext && isInspark;
}