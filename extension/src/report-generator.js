// report-generator.js - Enhanced report generation

class ReportGenerator {
  constructor() {
    this.templates = {
      html: this.getHtmlTemplate(),
      markdown: this.getMarkdownTemplate(),
      csv: this.getCsvTemplate()
    };
  }

  /**
   * Generate comprehensive report in multiple formats
   */
  async generateReport(results, tab, format = 'html') {
    const reportData = {
      pageInfo: {
        title: tab.title,
        url: tab.url,
        timestamp: new Date().toISOString(),
        scanDuration: results.scanDuration || 'N/A'
      },
      summary: this.generateSummary(results),
      issues: this.categorizeIssues(results),
      metrics: this.calculateMetrics(results),
      recommendations: await this.generateRecommendations(results)
    };

    switch (format) {
      case 'html':
        return this.generateHtmlReport(reportData);
      case 'markdown':
        return this.generateMarkdownReport(reportData);
      case 'csv':
        return this.generateCsvReport(reportData);
      case 'json':
        return JSON.stringify(reportData, null, 2);
      default:
        return this.generateHtmlReport(reportData);
    }
  }

  /**
   * Generate summary statistics
   */
  generateSummary(results) {
    const summary = {
      total: results.length,
      byCategory: {},
      bySeverity: {},
      passingChecks: 0,
      failingChecks: results.length
    };

    results.forEach(issue => {
      // By category
      summary.byCategory[issue.category] = 
        (summary.byCategory[issue.category] || 0) + 1;
      
      // By severity
      summary.bySeverity[issue.severity] = 
        (summary.bySeverity[issue.severity] || 0) + 1;
    });

    return summary;
  }

  /**
   * Calculate accessibility score and metrics
   */
  calculateMetrics(results) {
    const weights = {
      critical: 10,
      serious: 5,
      moderate: 2,
      minor: 1
    };

    let totalWeight = 0;
    let maxPossibleWeight = 100; // Baseline for perfect score

    results.forEach(issue => {
      totalWeight += weights[issue.severity] || 1;
    });

    const score = Math.max(0, maxPossibleWeight - totalWeight);
    const grade = this.getGrade(score);

    return {
      score,
      grade,
      totalWeight,
      avgSeverity: totalWeight / (results.length || 1)
    };
  }

  /**
   * Get letter grade based on score
   */
  getGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 65) return 'D+';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Categorize issues for better organization
   */
  categorizeIssues(results) {
    const categorized = {
      accessibility: {
        wcag2a: [],
        wcag2aa: [],
        bestPractices: []
      },
      uiux: {
        layout: [],
        interaction: [],
        performance: [],
        responsive: []
      }
    };

    results.forEach(issue => {
      if (issue.category === 'a11y') {
        // Categorize by WCAG level
        if (issue.wcagLevel === '2.0-A') {
          categorized.accessibility.wcag2a.push(issue);
        } else if (issue.wcagLevel === '2.0-AA') {
          categorized.accessibility.wcag2aa.push(issue);
        } else {
          categorized.accessibility.bestPractices.push(issue);
        }
      } else {
        // Categorize UI/UX issues
        if (['layout-shift', 'fixed-header-overlap', 'viewport-width'].includes(issue.type)) {
          categorized.uiux.layout.push(issue);
        } else if (['touch-target-size', 'focus-indicators-missing'].includes(issue.type)) {
          categorized.uiux.interaction.push(issue);
        } else if (['lcp', 'inp', 'image-too-large'].includes(issue.type)) {
          categorized.uiux.performance.push(issue);
        } else {
          categorized.uiux.responsive.push(issue);
        }
      }
    });

    return categorized;
  }

  /**
   * Generate AI-powered recommendations
   */
  async generateRecommendations(results) {
    // Group similar issues
    const issueGroups = {};
    
    results.forEach(issue => {
      if (!issueGroups[issue.type]) {
        issueGroups[issue.type] = [];
      }
      issueGroups[issue.type].push(issue);
    });

    // Generate recommendations for each group
    const recommendations = [];
    
    for (const [type, issues] of Object.entries(issueGroups)) {
      if (issues.length >= 3) {
        recommendations.push({
          type,
          count: issues.length,
          priority: this.getPriority(issues),
          suggestion: `Multiple ${type} issues detected. Consider implementing a systematic fix.`
        });
      }
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate priority score for issue group
   */
  getPriority(issues) {
    const severityScores = {
      critical: 4,
      serious: 3,
      moderate: 2,
      minor: 1
    };

    return issues.reduce((total, issue) => 
      total + (severityScores[issue.severity] || 1), 0
    );
  }

  /**
   * Generate enhanced HTML report
   */
  generateHtmlReport(data) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility & UI/UX Report - ${data.pageInfo.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    
    /* Header */
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 0;
      margin-bottom: 30px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    header h1 { font-size: 2.5em; margin-bottom: 10px; }
    
    /* Score Card */
    .score-card {
      background: white;
      border-radius: 10px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.08);
      text-align: center;
    }
    .score-circle {
      width: 150px;
      height: 150px;
      margin: 0 auto 20px;
      position: relative;
    }
    .score-grade {
      font-size: 3em;
      font-weight: bold;
      color: ${this.getGradeColor(data.metrics.grade)};
    }
    
    /* Statistics Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.08);
      text-align: center;
    }
    .stat-number { font-size: 2.5em; font-weight: bold; }
    .stat-label { color: #666; font-size: 0.9em; }
    
    /* Issue Cards */
    .issue-section {
      background: white;
      border-radius: 10px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.08);
    }
    .issue-card {
      border-left: 4px solid;
      padding: 15px;
      margin-bottom: 15px;
      background: #f8f9fa;
      border-radius: 0 8px 8px 0;
      transition: transform 0.2s;
    }
    .issue-card:hover { transform: translateX(5px); }
    .issue-card.critical { border-color: #e74c3c; }
    .issue-card.serious { border-color: #e67e22; }
    .issue-card.moderate { border-color: #f39c12; }
    .issue-card.minor { border-color: #95a5a6; }
    
    /* Recommendations */
    .recommendations {
      background: #e3f2fd;
      border-radius: 10px;
      padding: 30px;
      margin-bottom: 30px;
    }
    .recommendation-item {
      background: white;
      padding: 20px;
      margin-bottom: 15px;
      border-radius: 8px;
      border-left: 4px solid #2196f3;
    }
    
    /* Charts */
    .chart-container {
      background: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.08);
    }
    
    /* Print Styles */
    @media print {
      body { background: white; }
      .no-print { display: none; }
      .issue-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Accessibility & UI/UX Report</h1>
      <p><strong>Page:</strong> ${data.pageInfo.title}</p>
      <p><strong>URL:</strong> ${data.pageInfo.url}</p>
      <p><strong>Scanned:</strong> ${new Date(data.pageInfo.timestamp).toLocaleString()}</p>
    </header>

    <div class="score-card">
      <div class="score-circle">
        <div class="score-grade">${data.metrics.grade}</div>
      </div>
      <h2>Accessibility Score: ${data.metrics.score}/100</h2>
      <p>Based on WCAG 2.1 guidelines and UI/UX best practices</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">${data.summary.total}</div>
        <div class="stat-label">Total Issues</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${data.summary.bySeverity.critical || 0}</div>
        <div class="stat-label">Critical Issues</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${data.summary.byCategory.a11y || 0}</div>
        <div class="stat-label">Accessibility Issues</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${data.summary.byCategory.uiux || 0}</div>
        <div class="stat-label">UI/UX Issues</div>
      </div>
    </div>

    ${this.renderRecommendations(data.recommendations)}
    ${this.renderIssuesByCategory(data.issues)}
    ${this.renderCharts(data)}

    <footer style="text-align: center; margin-top: 50px; color: #666;">
      <p>Generated by Inspark Accessibility Assistant v1.0.0</p>
    </footer>
  </div>

  <script>
    // Add interactive features
    document.querySelectorAll('.issue-card').forEach(card => {
      card.addEventListener('click', () => {
        card.classList.toggle('expanded');
      });
    });
  </script>
</body>
</html>`;
  }

  getGradeColor(grade) {
    const colors = {
      'A+': '#27ae60',
      'A': '#27ae60',
      'B+': '#2ecc71',
      'B': '#f39c12',
      'C+': '#e67e22',
      'C': '#e67e22',
      'D+': '#e74c3c',
      'D': '#e74c3c',
      'F': '#c0392b'
    };
    return colors[grade] || '#666';
  }

  renderRecommendations(recommendations) {
    if (!recommendations.length) return '';
    
    return `
      <div class="recommendations">
        <h2>Top Recommendations</h2>
        ${recommendations.map(rec => `
          <div class="recommendation-item">
            <h3>${this.formatType(rec.type)}</h3>
            <p>${rec.count} occurrences • Priority: High</p>
            <p>${rec.suggestion}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderIssuesByCategory(issues) {
    // Implementation continues...
    return '<div class="issue-section"><!-- Issues rendered here --></div>';
  }

  renderCharts(data) {
    // Placeholder for chart rendering
    return '<div class="chart-container"><!-- Charts rendered here --></div>';
  }

  formatType(type) {
    return type.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  // Other format generators (Markdown, CSV) would go here...
}

export const reportGenerator = new ReportGenerator();