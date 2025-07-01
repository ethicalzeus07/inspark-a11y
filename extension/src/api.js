// api.js - Enhanced API service for lesson scanning

import { getApiEndpoint, debugLog, isInsparkPlatform, detectLessonContext } from './config.js';

/**
 * Enhanced API service for lesson scanning and educational accessibility
 */
class ApiService {
  constructor() {
    this.lessonScanActive = false;
    this.currentLessonData = null;
  }

  /**
   * Detect comprehensive educational context from the current page
   * @returns {Object} Enhanced context information for educational content
   */
  _getEducationalContext() {
    const hostname = window.location?.hostname || '';
    const pathname = window.location?.pathname || '';
    const title = document.title || '';
    
    return {
      contentType: "educational",
      platform: this._detectPlatform(hostname),
      pageType: this._detectPageType(pathname, title),
      courseContext: this._detectCourseContext(pathname, title),
      lessonContext: detectLessonContext(),
      domain: hostname,
      timestamp: new Date().toISOString(),
      isLessonScanning: this.lessonScanActive,
      screenInfo: this._getScreenInfo()
    };
  }

  /**
   * Detect the educational platform
   * @param {string} hostname 
   * @returns {string}
   */
  _detectPlatform(hostname) {
    if (hostname.includes('inspark')) return 'inspark';
    if (hostname.includes('asu.edu')) return 'asu';
    if (hostname.includes('canvas')) return 'canvas';
    if (hostname.includes('blackboard')) return 'blackboard';
    if (hostname.includes('moodle')) return 'moodle';
    return 'unknown';
  }

  /**
   * Enhanced page type detection for educational content
   * @param {string} pathname 
   * @param {string} title 
   * @returns {string}
   */
  _detectPageType(pathname, title) {
    const lower = (pathname + ' ' + title).toLowerCase();
    
    // Assessment types
    if (lower.includes('quiz') || lower.includes('test') || lower.includes('exam')) {
      return 'assessment';
    }
    if (lower.includes('assignment') || lower.includes('homework') || lower.includes('submit')) {
      return 'assignment';
    }
    
    // Content types
    if (lower.includes('video') || lower.includes('media') || lower.includes('watch')) {
      return 'video';
    }
    if (lower.includes('reading') || lower.includes('text') || lower.includes('article')) {
      return 'reading';
    }
    if (lower.includes('interactive') || lower.includes('simulation') || lower.includes('lab')) {
      return 'interactive';
    }
    
    // Communication types
    if (lower.includes('discussion') || lower.includes('forum') || lower.includes('chat')) {
      return 'discussion';
    }
    
    // Structural types
    if (lower.includes('lesson') || lower.includes('module') || lower.includes('unit')) {
      return 'lesson';
    }
    if (lower.includes('course') || lower.includes('class')) {
      return 'course';
    }
    
    return 'content';
  }

  /**
   * Enhanced course context detection
   * @param {string} pathname 
   * @param {string} title 
   * @returns {string}
   */
  _detectCourseContext(pathname, title) {
    // Extract course info from URL patterns common in LMS
    const coursePatterns = [
      /course[s]?[\/=]([^\/&]+)/i,
      /class[es]?[\/=]([^\/&]+)/i,
      /subject[s]?[\/=]([^\/&]+)/i,
      /module[s]?[\/=]([^\/&]+)/i
    ];
    
    for (const pattern of coursePatterns) {
      const match = pathname.match(pattern);
      if (match) {
        return decodeURIComponent(match[1]).replace(/[-_]/g, ' ');
      }
    }
    
    // Fallback to title-based detection
    const titleParts = title.split('-');
    if (titleParts.length > 1) {
      return titleParts[0].trim();
    }
    
    return 'unknown';
  }

  /**
   * Get current screen information for lesson scanning
   * @returns {Object}
   */
  _getScreenInfo() {
    try {
      // Try to detect screen number from various sources
      const screenIndicators = [
        '[data-screen]',
        '[data-lesson-screen]',
        '.screen-number',
        '.lesson-step',
        '.page-number'
      ];
      
      let screenNumber = null;
      let screenTitle = document.title;
      
      for (const selector of screenIndicators) {
        const element = document.querySelector(selector);
        if (element) {
          screenNumber = element.dataset.screen || 
                        element.dataset.lessonScreen || 
                        element.textContent.match(/\d+/)?.[0];
          if (screenNumber) break;
        }
      }
      
      // Try to extract screen info from URL
      if (!screenNumber) {
        const urlMatch = window.location.pathname.match(/screen[\/=](\d+)/i) ||
                        window.location.pathname.match(/step[\/=](\d+)/i) ||
                        window.location.search.match(/screen[=](\d+)/i);
        if (urlMatch) {
          screenNumber = parseInt(urlMatch[1]);
        }
      }
      
      // Try to get a more specific screen title
      const titleElements = [
        'h1', 'h2', '.screen-title', '.lesson-title', '.step-title'
      ];
      
      for (const selector of titleElements) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          screenTitle = element.textContent.trim();
          break;
        }
      }
      
      return {
        screenNumber: screenNumber ? parseInt(screenNumber) : null,
        title: screenTitle,
        url: window.location.href,
        hasNavigationControls: this._hasNavigationControls(),
        estimatedScreenCount: this._estimateScreenCount()
      };
    } catch (error) {
      debugLog('Error getting screen info:', error);
      return {
        screenNumber: null,
        title: document.title,
        url: window.location.href,
        hasNavigationControls: false,
        estimatedScreenCount: null
      };
    }
  }

  /**
   * Check if page has lesson navigation controls
   * @returns {boolean}
   */
  _hasNavigationControls() {
    const navSelectors = [
      '.next-btn', '.prev-btn', '.previous-btn',
      '[data-action="next"]', '[data-action="previous"]',
      '.lesson-nav', '.screen-nav', '.step-nav',
      'button[onclick*="next"]', 'button[onclick*="prev"]'
    ];
    
    return navSelectors.some(selector => document.querySelector(selector));
  }

  /**
   * Try to estimate total screen count for lesson
   * @returns {number|null}
   */
  _estimateScreenCount() {
    try {
      // Look for progress indicators
      const progressSelectors = [
        '.progress-total', '[data-total-screens]', '.total-steps',
        '.lesson-progress .total', '.screen-count'
      ];
      
      for (const selector of progressSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const totalMatch = element.textContent.match(/(\d+)/);
          if (totalMatch) {
            return parseInt(totalMatch[1]);
          }
        }
      }
      
      // Look for pagination or step indicators
      const stepIndicators = document.querySelectorAll('.step, .screen-indicator, .lesson-step');
      if (stepIndicators.length > 1) {
        return stepIndicators.length;
      }
      
      return null;
    } catch (error) {
      debugLog('Error estimating screen count:', error);
      return null;
    }
  }

  /**
   * Get educational-specific instructions for AI suggestions
   * @param {Object} issue 
   * @param {Object} context 
   * @returns {string}
   */
  _getEducationalInstructions(issue, context) {
    const baseInstructions = [
      "This is educational content for university students at Inspark.education",
      "Prioritize solutions that work with screen readers and assistive technology",
      "Consider diverse learning needs and disabilities",
      "Focus on WCAG 2.1 AA compliance for educational institutions"
    ];

    // Add context-specific instructions
    switch (context.pageType) {
      case 'assessment':
        baseInstructions.push(
          "This is a quiz/test interface - ensure accessibility for students with extra time accommodations",
          "Focus on clear instructions, proper form labels, and keyboard navigation",
          "Consider students who use screen readers for test questions"
        );
        break;
        
      case 'video':
        baseInstructions.push(
          "This is educational video content - prioritize captions, transcripts, and audio descriptions",
          "Ensure video controls are keyboard accessible",
          "Consider students with hearing or visual impairments"
        );
        break;
        
      case 'assignment':
        baseInstructions.push(
          "This is an assignment interface - ensure instructions are clear and accessible",
          "Focus on proper heading structure and form accessibility",
          "Consider students who need clear task organization"
        );
        break;
        
      case 'discussion':
        baseInstructions.push(
          "This is a discussion forum - focus on keyboard navigation and screen reader compatibility",
          "Ensure threaded conversations are properly structured",
          "Consider students who navigate by headings or landmarks"
        );
        break;
        
      case 'reading':
        baseInstructions.push(
          "This is reading content - ensure proper heading hierarchy and text structure",
          "Focus on color contrast and text readability",
          "Consider students with dyslexia or visual processing difficulties"
        );
        break;
        
      case 'interactive':
        baseInstructions.push(
          "This is interactive content - ensure all interactions are keyboard accessible",
          "Provide alternative ways to access interactive elements",
          "Consider students who cannot use a mouse or touch interface"
        );
        break;
    }

    // Add platform-specific instructions
    if (context.platform === 'inspark') {
      baseInstructions.push(
        "Follow ASU's accessibility guidelines and standards",
        "Ensure compatibility with common assistive technologies used by ASU students"
      );
    }

    // Add lesson scanning context
    if (this.lessonScanActive && context.screenInfo?.screenNumber) {
      baseInstructions.push(
        `This issue is on screen ${context.screenInfo.screenNumber} of a lesson sequence`,
        "Consider how this affects the overall learning flow and navigation"
      );
    }

    return baseInstructions.join(". ");
  }

  /**
   * Get a heuristic suggestion for quick scanning
   * @param {Object} issue - The issue to get a suggestion for
   * @returns {Promise<string>} - The suggestion text
   */
  async getSuggestion(issue) {
    try {
      debugLog('Getting heuristic suggestion for issue:', issue.id);
      const response = await fetch(getApiEndpoint('suggest'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          issueType: issue.type,
          issueDescription: issue.description,
          element: issue.element,
          severity: issue.severity,
          category: issue.category,
          context: this._getEducationalContext()
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      return data.suggestion;
    } catch (error) {
      debugLog('Error getting heuristic suggestion:', error);
      throw error;
    }
  }

  /**
   * Get an AI-powered suggestion with enhanced educational context
   * @param {Object} issue - The issue to get a suggestion for
   * @returns {Promise<string>} - The AI suggestion text
   */
  async getAiSuggestion(issue) {
    try {
      debugLog('Getting AI suggestion for issue:', issue.id);
      
      const educationalContext = this._getEducationalContext();
      
      const response = await fetch(getApiEndpoint('aiSuggest'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          issueType: issue.type,
          issueDescription: issue.description,
          element: issue.element,
          severity: issue.severity,
          category: issue.category,
          context: {
            ...educationalContext,
            specialInstructions: this._getEducationalInstructions(issue, educationalContext),
            lessonScanContext: this.lessonScanActive ? {
              isLessonScanning: true,
              currentScreen: educationalContext.screenInfo?.screenNumber,
              lessonType: educationalContext.pageType
            } : null
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }
      const data = await response.json();
      return data.suggestion;
    } catch (error) {
      debugLog('Error getting AI suggestion:', error);
      throw error;
    }
  }

  /**
   * Analyze a single screen (quick scan)
   * @param {string} url - The URL of the page
   * @param {string} html - The HTML content of the page
   * @param {Array} issues - The issues found on the page
   * @returns {Promise<Object>} - The analysis results
   */
  async analyzeScreen(url, html, issues) {
    try {
      debugLog('Analyzing single screen:', url);

      const response = await fetch(getApiEndpoint('analyze'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          html,
          issues,
          metadata: {
            ...this._getEducationalContext(),
            analysisType: 'quick_scan',
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            issueCount: issues.length
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      debugLog('Error analyzing screen:', error);
      throw error;
    }
  }

  /**
   * Analyze complete lesson data (lesson scan)
   * @param {Array} screenData - Array of screen data with issues
   * @param {Object} lessonInfo - Overall lesson information
   * @returns {Promise<Object>} - The analysis results
   */
  async analyzeLessonData(screenData, lessonInfo) {
    try {
      debugLog('Analyzing complete lesson data:', screenData.length, 'screens');

      // Flatten all issues from all screens
      const allIssues = screenData.flatMap(screen => 
        (screen.issues || []).map(issue => ({
          ...issue,
          screenContext: {
            screenNumber: screen.screenNumber,
            screenTitle: screen.title,
            screenUrl: screen.url
          }
        }))
      );

      const response = await fetch(getApiEndpoint('analyze'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: lessonInfo.startUrl || window.location.href,
          html: '', // Not needed for lesson analysis
          issues: allIssues,
          metadata: {
            ...this._getEducationalContext(),
            analysisType: 'lesson_scan',
            lessonData: {
              totalScreens: screenData.length,
              screenData: screenData.map(screen => ({
                screenNumber: screen.screenNumber,
                title: screen.title,
                url: screen.url,
                issueCount: screen.issues?.length || 0
              })),
              lessonDuration: lessonInfo.duration,
              startTime: lessonInfo.startTime,
              endTime: lessonInfo.endTime
            },
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            totalIssues: allIssues.length
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      debugLog('Error analyzing lesson data:', error);
      throw error;
    }
  }

  /**
   * Generate a comprehensive lesson accessibility report
   * @param {Array} screenData - Screen data with issues
   * @param {Object} lessonInfo - Lesson metadata
   * @param {Object} options - Report options
   * @returns {Promise<Blob>} - PDF blob
   */
  async generateLessonReport(screenData, lessonInfo, options = {}) {
    try {
      debugLog('Generating lesson accessibility report');

      const allIssues = screenData.flatMap(screen => 
        (screen.issues || []).map(issue => ({
          ...issue,
          screenInfo: {
            screenNumber: screen.screenNumber,
            title: screen.title,
            url: screen.url,
            timestamp: screen.timestamp
          }
        }))
      );

      const response = await fetch(getApiEndpoint('generateReport'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: lessonInfo.startUrl || window.location.href,
          issues: allIssues,
          metadata: {
            ...this._getEducationalContext(),
            reportType: 'lesson_scan',
            lessonInfo: {
              ...lessonInfo,
              totalScreens: screenData.length,
              totalIssues: allIssues.length
            },
            screenBreakdown: screenData.map(screen => ({
              screenNumber: screen.screenNumber,
              title: screen.title,
              url: screen.url,
              issueCount: screen.issues?.length || 0,
              criticalIssues: screen.issues?.filter(i => i.severity === 'critical').length || 0,
              seriousIssues: screen.issues?.filter(i => i.severity === 'serious').length || 0
            }))
          },
          includeAiSuggestions: options.includeAiSuggestions !== false,
          reportTitle: options.title || `Lesson Accessibility Report - ${lessonInfo.courseContext || 'Unknown Course'}`
        })
      });

      if (!response.ok) {
        throw new Error(`Report generation failed: ${response.status}`);
      }

      return await response.blob();
    } catch (error) {
      debugLog('Error generating lesson report:', error);
      throw error;
    }
  }

  /**
   * Set lesson scan state
   * @param {boolean} active 
   * @param {Object} lessonData 
   */
  setLessonScanState(active, lessonData = null) {
    this.lessonScanActive = active;
    this.currentLessonData = lessonData;
    debugLog('Lesson scan state updated:', { active, lessonData });
  }

  /**
   * Check if the microservice is available
   * @returns {Promise<boolean>} - Whether the microservice is available
   */
  async checkHealth() {
    try {
      const response = await fetch(getApiEndpoint('health'));
      const data = await response.json();
      
      debugLog('Health check result:', data);
      return response.ok && data.status === 'healthy';
    } catch (error) {
      debugLog('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get enhanced health information including lesson scan capabilities
   * @returns {Promise<Object>} - Detailed health information
   */
  async getHealthInfo() {
    try {
      const response = await fetch(getApiEndpoint('health'));
      const data = await response.json();
      
      return {
        ...data,
        lessonScanSupported: true,
        educationalContextDetection: isInsparkPlatform(),
        currentContext: this._getEducationalContext()
      };
    } catch (error) {
      debugLog('Health info request failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        lessonScanSupported: false
      };
    }
  }
}

// Export a singleton instance
export const apiService = new ApiService();