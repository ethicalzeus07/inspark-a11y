# main.py - Enhanced with lesson scanning support

from dotenv import load_dotenv
load_dotenv()
import os
import hashlib
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from io import BytesIO

import httpx
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# PDF generation
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.colors import HexColor, black, white, red, orange, green, gray
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# ─── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("inspark-a11y-assistant")

# ─── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Inspark AI-Powered Accessibility Assistant - Lesson Scanner",
    description="AI microservice for educational accessibility with lesson scanning support",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Enhanced Models ────────────────────────────────────────────────────────────
class ScreenInfo(BaseModel):
    screenNumber: int
    title: str
    url: str
    timestamp: str

class IssueRequest(BaseModel):
    issueType: str
    issueDescription: str
    element: str
    severity: str
    category: str = "a11y"
    context: Optional[Dict[str, Any]] = None
    screenInfo: Optional[ScreenInfo] = None

class SuggestionResponse(BaseModel):
    suggestion: str
    timestamp: str
    source: str = "heuristic"
    educationalContext: Optional[Dict[str, Any]] = None

class LessonData(BaseModel):
    totalScreens: int
    screenData: List[Dict[str, Any]]
    lessonDuration: Optional[float] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None

class AnalysisRequest(BaseModel):
    url: str
    html: str
    issues: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None
    analysisType: str = "quick_scan"  # "quick_scan" or "lesson_scan"
    lessonData: Optional[LessonData] = None

class AnalysisResponse(BaseModel):
    suggestions: Dict[str, str]
    summary: str
    timestamp: str
    aiSuggestionsCount: int = 0
    heuristicSuggestionsCount: int = 0
    analysisType: str = "quick_scan"
    lessonInsights: Optional[Dict[str, Any]] = None

class ReportRequest(BaseModel):
    url: str
    issues: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None
    includeAiSuggestions: bool = True
    reportTitle: Optional[str] = None
    reportType: str = "quick_scan"  # "quick_scan" or "lesson_scan"
    screenBreakdown: Optional[List[Dict[str, Any]]] = None

# ─── In-process cache for suggestions ─────────────────────────────────────────
suggestion_cache: Dict[str, str] = {}

# ─── Enhanced Helper Functions ─────────────────────────────────────────────────
def detect_and_redact_pii(text: str) -> str:
    return text  # Placeholder for PII detection

async def verify_api_key(request: Request):
    return True  # Placeholder for authentication

def get_educational_heuristic_suggestion(issue: IssueRequest) -> str:
    """
    Enhanced accessibility-focused heuristic suggestions with educational context
    """
    # Base suggestions for accessibility issues
    base_suggestions = {
        "color-contrast": "Ensure text meets WCAG 2.1 AA contrast ratio (4.5:1 for normal text, 3:1 for large text). Critical for students with visual impairments.",
        "image-alt": "Add descriptive alt text for informative images, or alt=\"\" for decorative images. Essential for students using screen readers.",
        "heading-structure": "Use proper heading hierarchy (h1→h2→h3) without skipping levels. Helps students navigate lesson content efficiently.",
        "form-label": "Associate form controls with labels using for/id attributes or aria-labelledby. Critical for assessment accessibility.",
        "link-purpose": "Make link text descriptive and meaningful out of context. Helps students understand navigation without visual cues.",
        "keyboard-navigation": "Ensure all interactive elements are keyboard accessible with visible focus indicators. Essential for students who can't use a mouse.",
        "aria-labels": "Use ARIA labels and roles to provide context for screen readers. Critical for complex educational interfaces.",
        "table-headers": "Use proper table headers (th) and scope attributes for data tables. Important for students accessing tabular lesson data.",
        "focus-management": "Manage focus properly for dynamic content and modal dialogs. Essential for seamless lesson navigation.",
        "semantic-markup": "Use semantic HTML elements (nav, main, section, article) for better structure. Helps students understand lesson organization.",
        "error-identification": "Clearly identify and describe form errors with helpful correction suggestions. Critical for assessment submissions.",
        "page-title": "Provide unique, descriptive page titles that identify lesson content or purpose.",
        "default": "Review WCAG 2.1 AA guidelines for educational accessibility compliance."
    }
    
    # Get base suggestion
    base_suggestion = base_suggestions.get(issue.issueType, base_suggestions["default"])
    
    # Add educational context if available
    if issue.context:
        page_type = issue.context.get("pageType", "content")
        platform = issue.context.get("platform", "unknown")
        
        # Add page-type specific guidance
        if page_type == "assessment":
            base_suggestion += " For assessments, ensure students with disabilities can complete tasks within their accommodated time limits."
        elif page_type == "video":
            base_suggestion += " For video content, provide captions and transcripts for deaf and hard-of-hearing students."
        elif page_type == "assignment":
            base_suggestion += " For assignments, ensure instructions are clear and accessible to students with cognitive disabilities."
        elif page_type == "discussion":
            base_suggestion += " For discussions, ensure threaded conversations are properly structured for screen reader users."
        
        # Add platform-specific guidance
        if platform == "inspark":
            base_suggestion += " Follow ASU accessibility standards for educational technology."
    
    # Add screen context for lesson scanning
    if issue.screenInfo:
        base_suggestion += f" This issue appears on screen {issue.screenInfo.screenNumber} of the lesson sequence."
    
    return base_suggestion

async def call_mistral_api_enhanced(issue: IssueRequest) -> str:
    """
    Enhanced Mistral API call with educational context and lesson scanning awareness
    """
    api_key = os.getenv("MISTRAL_API_KEY", "").strip()
    if not api_key:
        logger.error("MISTRAL_API_KEY not set")
        raise HTTPException(500, "Mistral API key not configured.")

    # Shorten long fields
    desc = issue.issueDescription[:120] + ("…" if len(issue.issueDescription) > 120 else "")
    elem = issue.element[:80] + ("…" if len(issue.element) > 80 else "")
    
    # Build comprehensive educational context
    context_parts = []
    
    if issue.context:
        platform = issue.context.get("platform", "unknown")
        page_type = issue.context.get("pageType", "content")
        lesson_context = issue.context.get("lessonContext")
        
        context_parts.append(f"Platform: {platform}")
        context_parts.append(f"Content type: {page_type}")
        
        if lesson_context:
            context_parts.append(f"Educational context: {lesson_context}")
        
        # Add lesson scanning context
        if issue.context.get("isLessonScanning") and issue.screenInfo:
            context_parts.append(f"Screen {issue.screenInfo.screenNumber} in lesson sequence")
            context_parts.append(f"Screen title: {issue.screenInfo.title}")
        
        # Add special instructions from context
        special_instructions = issue.context.get("specialInstructions", "")
        if special_instructions:
            context_parts.append(f"Special considerations: {special_instructions}")
    
    context_info = ". ".join(context_parts) if context_parts else "Educational content"
    
    # Enhanced prompt for educational accessibility
    prompt = f"""You are an expert in web accessibility (WCAG 2.1 AA) specializing in educational technology for university students. 

Context: {context_info}

Provide a specific, actionable fix in 1-2 sentences (max 80 words) that addresses both the technical accessibility issue AND the educational impact.

Issue Details:
- Type: {issue.issueType}
- Severity: {issue.severity}
- Description: {desc}
- HTML Element: {elem}

Focus on:
1. WCAG 2.1 AA compliance
2. Educational accessibility best practices
3. Impact on students with disabilities
4. Practical implementation steps

When you reply, please use exactly this format:

Explanation:
<One or two sentences (max 80 words) summarizing the issue and why it matters to students with disabilities. Along with what does the issue mean and how it can negativiley affect the user, in simple language >

HTML:
```html
<Your updated markup here>"""

    url = "https://api.mistral.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "mistral-large-latest",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 120
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, headers=headers, timeout=20.0)
        resp.raise_for_status()
        data = resp.json()
        reply = data["choices"][0]["message"]["content"]
        return reply.strip()
    except httpx.HTTPStatusError as exc:
        logger.error(f"Mistral API HTTP error: {exc}")
        logger.error(f"Body was: {exc.response.text}")
        raise HTTPException(502, "Mistral API request failed.")
    except Exception as e:
        logger.error(f"Mistral API exception: {e}")
        raise HTTPException(502, "Mistral API request failed.")

def should_use_ai_for_issue(issue: Dict[str, Any], context: Dict[str, Any] = None) -> bool:
    """
    Enhanced decision logic for AI usage based on severity, type, and educational context
    """
    severity = issue.get("severity", "minor").lower()
    issue_type = issue.get("type", "").lower()
    
    # Always use AI for critical and serious issues
    if severity in ["critical", "serious"]:
        return True
    
    # Use AI for complex accessibility issues even if moderate severity
    complex_issues = [
        "aria-labels", "form-label", "keyboard-navigation", 
        "focus-management", "table-headers", "heading-structure",
        "error-identification"
    ]
    
    if severity == "moderate" and issue_type in complex_issues:
        return True
    
    # Use AI for educational-specific contexts
    if context:
        page_type = context.get("pageType", "")
        if page_type in ["assessment", "assignment"] and severity == "moderate":
            return True
        
        # Use AI for lesson scanning context on moderate+ issues
        if context.get("isLessonScanning") and severity in ["moderate", "serious", "critical"]:
            return True
    
    return False

def generate_lesson_insights(issues: List[Dict], screen_data: List[Dict] = None) -> Dict[str, Any]:
    """
    Generate insights specific to lesson accessibility patterns
    """
    insights = {
        "totalIssues": len(issues),
        "severityDistribution": {},
        "commonIssueTypes": {},
        "screenAnalysis": {},
        "recommendations": []
    }
    
    # Severity distribution
    for severity in ["critical", "serious", "moderate", "minor"]:
        insights["severityDistribution"][severity] = len([i for i in issues if i.get("severity") == severity])
    
    # Common issue types
    issue_types = {}
    for issue in issues:
        issue_type = issue.get("type", "unknown")
        issue_types[issue_type] = issue_types.get(issue_type, 0) + 1
    
    insights["commonIssueTypes"] = dict(sorted(issue_types.items(), key=lambda x: x[1], reverse=True)[:5])
    
    # Screen-specific analysis
    if screen_data:
        insights["screenAnalysis"] = {
            "totalScreens": len(screen_data),
            "screensWithIssues": len([s for s in screen_data if s.get("issues") and len(s["issues"]) > 0]),
            "averageIssuesPerScreen": round(len(issues) / len(screen_data), 2) if screen_data else 0,
            "problemScreens": []
        }
        
        # Identify problem screens (more than 3 critical/serious issues)
        for screen in screen_data:
            screen_issues = screen.get("issues", [])
            critical_serious = len([i for i in screen_issues if i.get("severity") in ["critical", "serious"]])
            if critical_serious > 3:
                insights["screenAnalysis"]["problemScreens"].append({
                    "screenNumber": screen.get("screenNumber"),
                    "title": screen.get("title", "Unknown"),
                    "criticalSeriousIssues": critical_serious
                })
    
    # Generate recommendations
    if insights["severityDistribution"]["critical"] > 0:
        insights["recommendations"].append("Address critical accessibility barriers immediately - these prevent students with disabilities from accessing content.")
    
    if insights["commonIssueTypes"].get("color-contrast", 0) > 2:
        insights["recommendations"].append("Review color contrast throughout the lesson - ensure 4.5:1 ratio for normal text.")
    
    if insights["commonIssueTypes"].get("keyboard-navigation", 0) > 1:
        insights["recommendations"].append("Test entire lesson with keyboard-only navigation for students who cannot use a mouse.")
    
    if screen_data and insights["screenAnalysis"]["averageIssuesPerScreen"] > 3:
        insights["recommendations"].append("Consider breaking down complex screens into simpler, more accessible segments.")
    
    return insights

def generate_enhanced_pdf_report(report_data: ReportRequest) -> BytesIO:
    """
    Generate enhanced PDF report with lesson scanning support
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pageSize=A4, topMargin=1*inch, bottomMargin=1*inch)
    
    # Enhanced styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=26,
        spaceAfter=30,
        textColor=HexColor('#2563EB'),
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=18,
        spaceAfter=15,
        textColor=HexColor('#1F2937'),
        borderWidth=1,
        borderColor=HexColor('#E5E7EB'),
        borderPadding=10
    )
    
    subheading_style = ParagraphStyle(
        'CustomSubHeading',
        parent=styles['Heading3'],
        fontSize=14,
        spaceAfter=10,
        textColor=HexColor('#374151')
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=8,
        textColor=HexColor('#374151')
    )
    
    # Content
    content = []
    
    # Enhanced title based on report type
    if report_data.reportType == "lesson_scan":
        title = report_data.reportTitle or "Lesson Accessibility Assessment Report"
        subtitle = "Screen-by-Screen Analysis"
    else:
        title = report_data.reportTitle or "Quick Accessibility Assessment Report"
        subtitle = "Single Screen Analysis"
    
    content.append(Paragraph(title, title_style))
    content.append(Paragraph(subtitle, subheading_style))
    content.append(Spacer(1, 20))
    
    # Enhanced metadata table
    platform = report_data.metadata.get('platform', 'Unknown') if report_data.metadata else 'Unknown'
    page_type = report_data.metadata.get('pageType', 'content') if report_data.metadata else 'content'
    lesson_context = report_data.metadata.get('lessonContext', 'Unknown') if report_data.metadata else 'Unknown'
    
    metadata_rows = [
        ['URL:', report_data.url],
        ['Platform:', platform.title()],
        ['Content Type:', page_type.title()],
        ['Lesson Context:', lesson_context.title()],
        ['Scan Date:', datetime.now().strftime('%Y-%m-%d %H:%M')],
        ['Analysis Type:', report_data.reportType.replace('_', ' ').title()],
        ['Total Issues:', str(len(report_data.issues))]
    ]
    
    # Add lesson-specific metadata
    if report_data.reportType == "lesson_scan" and report_data.screenBreakdown:
        metadata_rows.append(['Total Screens:', str(len(report_data.screenBreakdown))])
        screens_with_issues = len([s for s in report_data.screenBreakdown if s.get('issueCount', 0) > 0])
        metadata_rows.append(['Screens with Issues:', str(screens_with_issues)])
    
    metadata_table = Table(metadata_rows, colWidths=[2*inch, 4*inch])
    metadata_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 0), (0, -1), HexColor('#F3F4F6')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 1, HexColor('#E5E7EB'))
    ]))
    
    content.append(metadata_table)
    content.append(Spacer(1, 30))
    
    # Executive Summary with enhanced analysis
    content.append(Paragraph("Executive Summary", heading_style))
    
    severity_counts = {'critical': 0, 'serious': 0, 'moderate': 0, 'minor': 0}
    for issue in report_data.issues:
        severity = issue.get('severity', 'minor')
        if severity in severity_counts:
            severity_counts[severity] += 1
    
    # Enhanced summary table
    summary_data = [
        ['Severity', 'Count', 'Impact on Student Learning'],
        ['Critical', str(severity_counts['critical']), 'Completely blocks access for students with disabilities'],
        ['Serious', str(severity_counts['serious']), 'Significantly impairs learning for students with disabilities'],
        ['Moderate', str(severity_counts['moderate']), 'Creates barriers that may frustrate students'],
        ['Minor', str(severity_counts['minor']), 'Minor improvements to enhance accessibility']
    ]
    
    summary_table = Table(summary_data, colWidths=[1.2*inch, 0.8*inch, 4*inch])
    summary_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1F2937')),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('BACKGROUND', (0, 1), (-1, 1), HexColor('#FEF2F2')),  # Critical
        ('BACKGROUND', (0, 2), (-1, 2), HexColor('#FFFBEB')),  # Serious
        ('BACKGROUND', (0, 3), (-1, 3), HexColor('#F0FDF4')),  # Moderate
        ('BACKGROUND', (0, 4), (-1, 4), HexColor('#F9FAFB')),  # Minor
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 1, HexColor('#E5E7EB'))
    ]))
    
    content.append(summary_table)
    content.append(Spacer(1, 20))
    
    # Lesson-specific screen breakdown
    if report_data.reportType == "lesson_scan" and report_data.screenBreakdown:
        content.append(Paragraph("Screen Breakdown", heading_style))
        
        screen_data = []
        screen_data.append(['Screen', 'Title', 'Issues', 'Critical', 'Status'])
        
        for screen in report_data.screenBreakdown:
            screen_num = str(screen.get('screenNumber', 'N/A'))
            title = screen.get('title', 'Unknown')[:30] + ('...' if len(screen.get('title', '')) > 30 else '')
            issue_count = str(screen.get('issueCount', 0))
            critical_count = str(screen.get('criticalIssues', 0))
            
            if screen.get('issueCount', 0) == 0:
                status = '✓ Accessible'
            elif screen.get('criticalIssues', 0) > 0:
                status = '⚠ Critical Issues'
            else:
                status = '⚡ Minor Issues'
            
            screen_data.append([screen_num, title, issue_count, critical_count, status])
        
        screen_table = Table(screen_data, colWidths=[0.8*inch, 2.5*inch, 0.8*inch, 0.8*inch, 1.1*inch])
        screen_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (-1, 0), HexColor('#3B82F6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 1, HexColor('#E5E7EB'))
        ]))
        
        content.append(screen_table)
        content.append(Spacer(1, 30))
    
    # Detailed Issues
    content.append(Paragraph("Detailed Issues", heading_style))
    
    # Group issues by screen if lesson scan
    if report_data.reportType == "lesson_scan":
        # Group issues by screen
        issues_by_screen = {}
        for issue in report_data.issues:
            screen_info = issue.get('screenInfo', {})
            screen_num = screen_info.get('screenNumber', 1)
            if screen_num not in issues_by_screen:
                issues_by_screen[screen_num] = []
            issues_by_screen[screen_num].append(issue)
        
        # Render issues grouped by screen
        for screen_num in sorted(issues_by_screen.keys()):
            screen_issues = issues_by_screen[screen_num]
            screen_title = screen_issues[0].get('screenInfo', {}).get('title', f'Screen {screen_num}')
            
            # Screen header
            content.append(Paragraph(f"Screen {screen_num}: {screen_title}", subheading_style))
            content.append(Paragraph(f"Found {len(screen_issues)} issue(s) on this screen:", body_style))
            content.append(Spacer(1, 10))
            
            # Render issues for this screen
            for i, issue in enumerate(screen_issues, 1):
                content.extend(render_issue(issue, f"{screen_num}.{i}"))
            
            content.append(Spacer(1, 20))
            
            # Page break after every 2 screens (except the last)
            if screen_num % 2 == 0 and screen_num < max(issues_by_screen.keys()):
                content.append(PageBreak())
    else:
        # Render all issues for quick scan
        for i, issue in enumerate(report_data.issues, 1):
            content.extend(render_issue(issue, str(i)))
            
            # Page break after every 3 issues (except the last)
            if i % 3 == 0 and i < len(report_data.issues):
                content.append(PageBreak())
    
    # Enhanced footer
    content.append(Spacer(1, 40))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=HexColor('#6B7280'),
        alignment=TA_CENTER
    )
    
    content.append(Paragraph("Generated by Inspark Accessibility Assistant - Lesson Scanner", footer_style))
    content.append(Paragraph(f"Report created on {datetime.now().strftime('%Y-%m-%d at %H:%M')}", footer_style))
    content.append(Paragraph("For accessibility support, contact the ASU Disability Resource Center.", footer_style))
    content.append(Paragraph("This report follows WCAG 2.1 AA guidelines for educational accessibility.", footer_style))
    
    # Build PDF
    doc.build(content)
    buffer.seek(0)
    return buffer

def render_issue(issue: Dict[str, Any], issue_number: str) -> List:
    """Helper function to render a single issue in the PDF"""
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
    
    styles = getSampleStyleSheet()
    content = []
    
    # Issue title
    severity = issue.get('severity', 'minor')
    severity_colors = {
        'critical': HexColor('#EF4444'),
        'serious': HexColor('#F59E0B'),
        'moderate': HexColor('#10B981'),
        'minor': HexColor('#6B7280')
    }
    
    issue_title = f"{issue_number}. {issue.get('title', issue.get('type', 'Unknown Issue')).title()}"
    issue_style = ParagraphStyle(
        'IssueTitle',
        parent=styles['Heading4'],
        fontSize=12,
        spaceAfter=8,
        textColor=severity_colors.get(severity, HexColor('#000000')),
        leftIndent=0
    )
    
    content.append(Paragraph(issue_title, issue_style))
    
    # Issue details table
    issue_details = [
        ['Severity:', severity.title()],
        ['Type:', issue.get('type', 'unknown').replace('-', ' ').title()],
        ['Element:', issue.get('element', 'N/A')[:100] + ('...' if len(issue.get('element', '')) > 100 else '')],
    ]
    
    if issue.get('selector'):
        issue_details.append(['Selector:', issue.get('selector')])
    
    if issue.get('location'):
        issue_details.append(['Location:', issue.get('location')])
    
    issue_table = Table(issue_details, colWidths=[1.2*inch, 4.8*inch])
    issue_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 0), (0, -1), HexColor('#F9FAFB')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E7EB'))
    ]))
    
    content.append(issue_table)
    content.append(Spacer(1, 8))
    
    # Description
    description = issue.get('description', 'No description available.')
    content.append(Paragraph(f"<b>Description:</b> {description}", styles['Normal']))
    content.append(Spacer(1, 8))
    
    # AI Suggestion if available
    if issue.get('aiSuggestion'):
        ai_suggestion = issue.get('aiSuggestion')
        suggestion_style = ParagraphStyle(
            'AISuggestion',
            parent=styles['Normal'],
            leftIndent=20,
            backgroundColor=HexColor('#F0FDF4'),
            borderColor=HexColor('#10B981'),
            borderWidth=1,
            borderPadding=8,
            fontSize=10
        )
        content.append(Paragraph(f"<b>🤖 AI Recommendation:</b> {ai_suggestion}", suggestion_style))
    elif issue.get('suggestion'):
        # Fallback suggestion
        suggestion_style = ParagraphStyle(
            'Suggestion',
            parent=styles['Normal'],
            leftIndent=20,
            backgroundColor=HexColor('#F3F4F6'),
            borderColor=HexColor('#6B7280'),
            borderWidth=1,
            borderPadding=8,
            fontSize=10
        )
        content.append(Paragraph(f"<b>📋 Recommendation:</b> {issue.get('suggestion')}", suggestion_style))
    
    content.append(Spacer(1, 15))
    
    return content

# ─── Enhanced Routes ────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "name": app.title, 
        "version": app.version, 
        "status": "ok",
        "features": ["lesson_scanning", "educational_ai", "screen_analysis"]
    }

@app.post(
    "/api/suggest",
    response_model=SuggestionResponse,
    dependencies=[Depends(verify_api_key)]
)
async def generate_suggestion(request: IssueRequest):
    """
    Enhanced heuristic accessibility suggestion with educational context
    """
    try:
        elem = detect_and_redact_pii(request.element)
        context_key = hashlib.md5(str(request.context).encode()).hexdigest()[:8] if request.context else "default"
        key = f"heuristic:{request.issueType}:{context_key}:{hashlib.md5(elem.encode()).hexdigest()[:8]}"
        
        if key in suggestion_cache:
            txt = suggestion_cache[key]
        else:
            txt = get_educational_heuristic_suggestion(request)
            suggestion_cache[key] = txt
            
        return SuggestionResponse(
            suggestion=txt, 
            timestamp=datetime.now().isoformat(),
            source="heuristic",
            educationalContext=request.context
        )
    except Exception as e:
        logger.error(f"[/api/suggest] error: {e}")
        raise HTTPException(500, str(e))

@app.post(
    "/api/ai_suggest",
    response_model=SuggestionResponse,
    dependencies=[Depends(verify_api_key)]
)
async def ai_generate_suggestion(request: IssueRequest):
    """
    Enhanced AI-powered accessibility suggestion with educational context
    """
    try:
        request.issueDescription = detect_and_redact_pii(request.issueDescription)
        request.element = detect_and_redact_pii(request.element)
        
        # Enhanced cache key including educational context
        elem = request.element
        context_key = hashlib.md5(str(request.context).encode()).hexdigest()[:8] if request.context else "default"
        screen_key = f"s{request.screenInfo.screenNumber}" if request.screenInfo else "single"
        cache_key = f"ai:{request.issueType}:{request.severity}:{context_key}:{screen_key}:{hashlib.md5(elem.encode()).hexdigest()[:8]}"
        
        if cache_key in suggestion_cache:
            ai_txt = suggestion_cache[cache_key]
        else:
            ai_txt = await call_mistral_api_enhanced(request)
            suggestion_cache[cache_key] = ai_txt
            
        return SuggestionResponse(
            suggestion=ai_txt, 
            timestamp=datetime.now().isoformat(),
            source="ai",
            educationalContext=request.context
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[/api/ai_suggest] error: {e}")
        raise HTTPException(500, str(e))

@app.post(
    "/api/analyze",
    response_model=AnalysisResponse,
    dependencies=[Depends(verify_api_key)]
)
async def analyze_page(request: AnalysisRequest):
    """
    Enhanced analysis supporting both quick scan and lesson scan modes
    """
    try:
        suggestions: Dict[str, str] = {}
        ai_count = 0
        heuristic_count = 0
        
        for idx, issue in enumerate(request.issues, start=1):
            req = IssueRequest(
                issueType=issue.get("type", "unknown"),
                issueDescription=detect_and_redact_pii(issue.get("description", "")),
                element=detect_and_redact_pii(issue.get("element", "")),
                severity=issue.get("severity", "moderate"),
                category="a11y",
                context=request.metadata,
                screenInfo=ScreenInfo(**issue.get("screenInfo")) if issue.get("screenInfo") else None
            )
            
            # Enhanced decision logic including educational context
            if should_use_ai_for_issue(issue, request.metadata):
                try:
                    resp = await ai_generate_suggestion(req)
                    suggestions[f"issue-{idx}"] = f"🤖 {resp.suggestion}"
                    ai_count += 1
                    logger.info(f"Used AI for issue {idx}: {issue.get('type')} ({issue.get('severity')})")
                except Exception as e:
                    logger.warning(f"AI failed for issue {idx}, using heuristic: {e}")
                    resp = await generate_suggestion(req)
                    suggestions[f"issue-{idx}"] = f"📋 {resp.suggestion}"
                    heuristic_count += 1
            else:
                resp = await generate_suggestion(req)
                suggestions[f"issue-{idx}"] = resp.suggestion
                heuristic_count += 1
                logger.info(f"Used heuristic for issue {idx}: {issue.get('type')} ({issue.get('severity')})")

        # Generate summary based on analysis type
        if request.analysisType == "lesson_scan":
            analysis_method = f"Lesson scan: {ai_count} AI suggestions, {heuristic_count} heuristic suggestions"
            summary = f"Analyzed {len(request.issues)} accessibility issues across lesson screens. {analysis_method}"
            
            # Generate lesson insights
            lesson_insights = None
            if request.lessonData:
                lesson_insights = generate_lesson_insights(
                    request.issues, 
                    request.lessonData.screenData if request.lessonData else None
                )
        else:
            analysis_method = f"Quick scan: {ai_count} AI suggestions, {heuristic_count} heuristic suggestions"
            summary = f"Analyzed {len(request.issues)} accessibility issues on {request.url}. {analysis_method}"
            lesson_insights = None
        
        return AnalysisResponse(
            suggestions=suggestions,
            summary=summary,
            timestamp=datetime.now().isoformat(),
            aiSuggestionsCount=ai_count,
            heuristicSuggestionsCount=heuristic_count,
            analysisType=request.analysisType,
            lessonInsights=lesson_insights
        )
    except Exception as e:
        logger.error(f"[/api/analyze] error: {e}")
        raise HTTPException(500, str(e))

@app.post(
    "/api/generate_report",
    dependencies=[Depends(verify_api_key)]
)
async def generate_report(request: ReportRequest):
    """
    Enhanced PDF report generation supporting lesson scanning
    """
    try:
        logger.info(f"Generating {request.reportType} PDF report for {request.url}")
        
        # Generate enhanced PDF
        pdf_buffer = generate_enhanced_pdf_report(request)
        
        # Create enhanced filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        domain = request.url.split('/')[2] if '/' in request.url else 'report'
        report_type = request.reportType.replace('_', '-')
        filename = f"accessibility-{report_type}-{domain}_{timestamp}.pdf"
        
        # Return PDF as streaming response
        return StreamingResponse(
            BytesIO(pdf_buffer.read()),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"[/api/generate_report] error: {e}")
        raise HTTPException(500, f"Report generation failed: {str(e)}")

@app.get("/api/health")
async def health():
    mistral_key_configured = bool(os.getenv("MISTRAL_API_KEY"))
    
    return {
        "status": "healthy", 
        "timestamp": datetime.now().isoformat(),
        "focus": "educational_accessibility",
        "ai_enabled": mistral_key_configured,
        "mistral_api_key_configured": mistral_key_configured,
        "features": {
            "lesson_scanning": True,
            "educational_context": True,
            "screen_analysis": True,
            "enhanced_ai": mistral_key_configured
        },
        "version": "2.0.0"
    }

# ─── Uvicorn entrypoint ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)