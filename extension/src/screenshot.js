// screenshot.js - Add to extension for visual capture

class ScreenshotService {
  constructor() {
    this.screenshots = new Map();
  }

  /**
   * Capture full page screenshot
   */
  async captureFullPage() {
    return new Promise((resolve) => {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Screenshot failed:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(dataUrl);
      });
    });
  }

  /**
   * Capture element screenshot using intersection observer
   */
  async captureElement(selector) {
    // Send message to content script to scroll element into view
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { 
          action: 'scrollToElement', 
          selector: selector 
        },
        async (response) => {
          if (response?.bounds) {
            // Wait for scroll animation
            setTimeout(async () => {
              const screenshot = await this.captureFullPage();
              if (screenshot) {
                // Crop to element bounds
                const croppedImage = await this.cropImage(
                  screenshot, 
                  response.bounds
                );
                resolve(croppedImage);
              } else {
                resolve(null);
              }
            }, 500);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Crop image to specific bounds
   */
  async cropImage(dataUrl, bounds) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Account for device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = bounds.width * dpr;
        canvas.height = bounds.height * dpr;
        
        ctx.drawImage(
          img,
          bounds.x * dpr,
          bounds.y * dpr,
          bounds.width * dpr,
          bounds.height * dpr,
          0,
          0,
          bounds.width * dpr,
          bounds.height * dpr
        );
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }

  /**
   * Compare two screenshots for visual differences
   */
  async compareScreenshots(screenshot1, screenshot2, threshold = 0.1) {
    // This would integrate with a visual comparison library
    // For now, return a placeholder
    return {
      match: false,
      difference: 0.15,
      diffImage: null
    };
  }

  /**
   * Store screenshot for issue
   */
  storeScreenshot(issueId, dataUrl) {
    this.screenshots.set(issueId, {
      dataUrl,
      timestamp: Date.now()
    });
  }

  /**
   * Get screenshot for issue
   */
  getScreenshot(issueId) {
    return this.screenshots.get(issueId);
  }

  /**
   * Clear old screenshots to free memory
   */
  cleanup(olderThan = 3600000) { // 1 hour default
    const now = Date.now();
    for (const [id, data] of this.screenshots) {
      if (now - data.timestamp > olderThan) {
        this.screenshots.delete(id);
      }
    }
  }
}

// Add to content.js to handle scroll requests
function handleScrollToElement(selector) {
  const element = document.querySelector(selector);
  if (!element) return null;
  
  element.scrollIntoView({ 
    behavior: 'smooth', 
    block: 'center', 
    inline: 'center' 
  });
  
  // Return element bounds after scroll
  setTimeout(() => {
    const rect = element.getBoundingClientRect();
    chrome.runtime.sendMessage({
      action: 'elementBounds',
      bounds: {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
      }
    });
  }, 600);
}

// Export for use in background.js
export const screenshotService = new ScreenshotService();