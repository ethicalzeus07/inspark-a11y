// api.js - API service for communicating with the microservice

import { getApiEndpoint, debugLog } from './config.js';

/**
 * API service for communicating with the AI microservice
 */
class ApiService {
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
          category: issue.category
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
   * Get a DeepSeek AI-powered suggestion for an accessibility or UI/UX issue (calls /api/ai_suggest)
   *
   * @param {Object} issue - The issue to get a suggestion for
   * @returns {Promise<string>} - The DeepSeek AI suggestion text
   */
  async getDeepSeekSuggestion(issue) {
    try {
      debugLog('Getting DeepSeek AI suggestion for issue:', issue.id);
      const response = await fetch(getApiEndpoint('ai_suggest'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          issueType: issue.type,
          issueDescription: issue.description,
          element: issue.element,
          severity: issue.severity,
          category: issue.category
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }
      const data = await response.json();
      return data.suggestion;
    } catch (error) {
      debugLog('Error getting DeepSeek suggestion:', error);
      throw error;
    }
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
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
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
