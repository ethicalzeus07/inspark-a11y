// api.js - API service for communicating with the microservice

import { getApiEndpoint, debugLog } from './config.js';

/**
 * API service for communicating with the AI microservice
 */
class ApiService {
  /**
   * Detect educational context from the current page
   * @returns {Object} Context information for educational content
   */
  _getEducationalContext() {
    const hostname = window.location?.hostname || '';
    const pathname = window.location?.pathname || '';
    const title = document.title || '';
    
    return {
      contentType: "educational",
      platform: hostname.includes('inspark') ? 'inspark' : 
                hostname.includes('asu.edu') ? 'asu' : 'unknown',
      pageType: this._detectPageType(pathname, title),
      courseContext: this._detectCourseContext(pathname, title),
      domain: hostname,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Detect the type of educational page
   * @param {string} pathname 
   * @param {string} title 
   * @returns {string}
   */
  _detectPageType(pathname, title) {
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
    if (lower.includes('lesson') || lower.includes('module') || lower.includes('unit')) {
      return 'lesson';
    }
    return 'content';
  }

  /**
   * Detect course context from URL and page content
   * @param {string} pathname 
   * @param {string} title 
   * @returns {string}
   */
  _detectCourseContext(pathname, title) {
    // Extract course info from URL patterns common in LMS
    const courseMatch = pathname.match(/course[s]?[\/=]([^\/&]+)/i) || 
                       pathname.match(/class[es]?[\/=]([^\/&]+)/i);
    
    if (courseMatch) {
      return courseMatch[1];
    }
    
    // Fallback to title-based detection
    return title.split('-')[0]?.trim() || 'unknown';
  }

  /**
   * Get a classic (fast) AI-powered suggestion for an accessibility or UI/UX issue
   *
   * @param {Object} issue - The issue to get a suggestion for
   * @returns {Promise<string>} - The suggestion text
   */
  async getSuggestion(issue) {
    try {
      debugLog('Getting suggestion for issue:', issue.id);
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
      debugLog('Error getting suggestion:', error);
      throw error;
    }
  }

  /**
   * Get an AI-powered suggestion for an accessibility issue with educational context
   *
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
            // Add specific educational guidance
            specialInstructions: this._getEducationalInstructions(issue, educationalContext)
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
   * Get educational-specific instructions for AI suggestions
   * @param {Object} issue 
   * @param {Object} context 
   * @returns {string}
   */
  _getEducationalInstructions(issue, context) {
    const instructions = [
      "This is educational content for university students",
      "Prioritize solutions that work with screen readers and assistive technology",
      "Consider diverse learning needs and disabilities"
    ];

    // Add context-specific instructions
    switch (context.pageType) {
      case 'assessment':
        instructions.push("Ensure quiz/test accessibility for students with extra time accommodations");
        break;
      case 'video':
        instructions.push("Focus on captions, transcripts, and audio descriptions for educational videos");
        break;
      case 'assignment':
        instructions.push("Ensure assignment instructions are clear and accessible to all students");
        break;
    }

    if (context.platform === 'inspark') {
      instructions.push("Follow ASU's accessibility guidelines and standards");
    }

    return instructions.join(". ");
  }

  /**
   * Analyze a full page for accessibility and UI/UX issues
   *
   * @param {string} url - The URL of the page
   * @param {string} html - The HTML content of the page
   * @param {Array} issues - The issues found on the page
   * @returns {Promise<Object>} - The analysis results
   */
  async analyzePage(url, html, issues) {
    try {
      debugLog('Analyzing page:', url);

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
      debugLog('Error analyzing page:', error);
      throw error;
    }
  }

  /**
   * Check if the microservice is available
   * 
   * @returns {Promise<boolean>} - Whether the microservice is available
   */
  async checkHealth() {
    try {
      const response = await fetch(getApiEndpoint('health'));
      return response.ok;
    } catch (error) {
      debugLog('Health check failed:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const apiService = new ApiService();