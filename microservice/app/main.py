# main.py

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
    title="Inspark AI-Powered Accessibility Assistant",
    description="AI microservice for generating accessibility and UI/UX suggestions",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ─────────────────────────────────────────────────────────────────────
class IssueRequest(BaseModel):
    issueType: str
    issueDescription: str
    element: str
    severity: str
    category: str
    context: Optional[Dict[str, Any]] = None

class SuggestionResponse(BaseModel):
    suggestion: str
    timestamp: str

class AnalysisRequest(BaseModel):
    url: str
    html: str
    issues: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None

class AnalysisResponse(BaseModel):
    suggestions: Dict[str, str]
    summary: str
    timestamp: str

class ReportRequest(BaseModel):
    url: str
    issues: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None
    includeAiSuggestions: bool = True
    reportTitle: Optional[str] = None

# ─── In-process cache for heuristic suggestions ─────────────────────────────────
suggestion_cache: Dict[str, str] = {}

# ─── Helpers ────────────────────────────────────────────────────────────────────
def detect_and_redact_pii(text: str) -> str:
    return text  # stub if you want to scrub e.g. emails

async def verify_api_key(request: Request):
    return True  # stub for any real auth you need

def fastapi_suggestion(issue: IssueRequest) -> str:
    fallbacks = {
        "a11y": {
            "color-contrast": "Increase contrast; try darker text or lighter background.",
            "image-alt":       "Add meaningful alt text, or alt=\"\" if decorative.",
            "default":         "Review WCAG 2.1 AA guidelines.",
        },
        "uiux": {
            "touch-target-size":   "Make touch targets at least 44×44px.",
            "font-size-too-small": "Use at least 16px for body text.",
            "viewport-width":      "Ensure content fits viewport without scrolling.",
            "layout-shift":        "Reserve image space; avoid late layout shifts.",
            "lcp":                 "Defer non-critical resources to speed LCP.",
            "inp":                 "Minimize JS blocking to under 200ms.",
            "default":             "Follow Inspark UI/UX guidelines.",
        },
    }
    cat = fallbacks.get(issue.category, {})
    return (
        cat.get(issue.issueType)
        or cat.get("default")
        or "Review accessibility & UI/UX best practices."
    )

async def call_mistral_api(issue: IssueRequest) -> str:
    """
    Call Mistral's chat completions endpoint.
    """
    api_key = os.getenv("MISTRAL_API_KEY", "").strip()
    if not api_key:
        logger.error("MISTRAL_API_KEY not set")
        raise HTTPException(500, "Mistral API key not configured.")

    # Shorten long fields
    desc = issue.issueDescription[:120] + ("…" if len(issue.issueDescription) > 120 else "")
    elem = issue.element[:80] + ("…" if len(issue.element) > 80 else "")
    
    # Enhanced prompt for educational context
    context_info = ""
    if issue.context and issue.context.get("contentType") == "educational":
        platform = issue.context.get("platform", "unknown")
        page_type = issue.context.get("pageType", "content")
        context_info = f" This is {platform} educational {page_type} content for university students."
    
    prompt = (
        "You are an expert in accessibility & UI/UX for educational content. "
        "Give a practical fix in 1-2 sentences under 50 words." + context_info + "\n"
        f"Issue: {issue.issueType}\n"
        f"Severity: {issue.severity}\n"
        f"Description: {desc}\n"
        f"Element: {elem}\n"
        "Return only the recommendation."
    )

    url = "https://api.mistral.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    }
    payload = {
        "model": "mistral-large-latest",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens":  80
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, headers=headers, timeout=15.0)
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

def generate_pdf_report(report_data: ReportRequest) -> BytesIO:
    """Generate a professional PDF report for accessibility issues"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*inch, bottomMargin=1*inch)
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=24,
        spaceAfter=30,
        textColor=HexColor('#2563EB'),
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        spaceAfter=12,
        textColor=HexColor('#1F2937'),
        borderWidth=0,
        borderColor=HexColor('#E5E7EB'),
        borderPadding=8
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        textColor=HexColor('#374151')
    )
    
    # Content
    content = []
    
    # Title
    title = report_data.reportTitle or "Accessibility Assessment Report"
    content.append(Paragraph(title, title_style))
    content.append(Spacer(1, 20))
    
    # Report metadata
    platform = report_data.metadata.get('platform', 'Unknown') if report_data.metadata else 'Unknown'
    page_type = report_data.metadata.get('pageType', 'content') if report_data.metadata else 'content'
    
    metadata_table = Table([
        ['URL:', report_data.url],
        ['Platform:', platform.title()],
        ['Content Type:', page_type.title()],
        ['Scan Date:', datetime.now().strftime('%Y-%m-%d %H:%M')],
        ['Total Issues:', str(len(report_data.issues))]
    ], colWidths=[2*inch, 4*inch])
    
    metadata_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 0), (0, -1), HexColor('#F3F4F6')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 1, HexColor('#E5E7EB'))
    ]))
    
    content.append(metadata_table)
    content.append(Spacer(1, 30))
    
    # Summary
    severity_counts = {'critical': 0, 'serious': 0, 'moderate': 0, 'minor': 0}
    for issue in report_data.issues:
        severity = issue.get('severity', 'minor')
        if severity in severity_counts:
            severity_counts[severity] += 1
    
    content.append(Paragraph("Executive Summary", heading_style))
    
    summary_data = [
        ['Severity', 'Count', 'Description'],
        ['Critical', str(severity_counts['critical']), 'Blocks access for users with disabilities'],
        ['Serious', str(severity_counts['serious']), 'Significantly impacts accessibility'],
        ['Moderate', str(severity_counts['moderate']), 'May cause accessibility issues'],
        ['Minor', str(severity_counts['minor']), 'Minor accessibility improvements']
    ]
    
    summary_table = Table(summary_data, colWidths=[1.5*inch, 1*inch, 3.5*inch])
    summary_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1F2937')),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('BACKGROUND', (0, 1), (-1, 1), HexColor('#FEF2F2')),  # Critical - red
        ('BACKGROUND', (0, 2), (-1, 2), HexColor('#FFFBEB')),  # Serious - orange
        ('BACKGROUND', (0, 3), (-1, 3), HexColor('#F0FDF4')),  # Moderate - green
        ('BACKGROUND', (0, 4), (-1, 4), HexColor('#F9FAFB')),  # Minor - gray
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 1, HexColor('#E5E7EB'))
    ]))
    
    content.append(summary_table)
    content.append(Spacer(1, 30))
    
    # Issues detail
    content.append(Paragraph("Detailed Issues", heading_style))
    
    for i, issue in enumerate(report_data.issues, 1):
        # Issue header
        severity = issue.get('severity', 'minor')
        severity_colors = {
            'critical': HexColor('#EF4444'),
            'serious': HexColor('#F59E0B'),
            'moderate': HexColor('#10B981'),
            'minor': HexColor('#6B7280')
        }
        
        issue_title = f"{i}. {issue.get('title', 'Unknown Issue')}"
        issue_style = ParagraphStyle(
            'IssueTitle',
            parent=styles['Heading3'],
            fontSize=14,
            spaceAfter=8,
            textColor=severity_colors.get(severity, black),
            leftIndent=0
        )
        
        content.append(Paragraph(issue_title, issue_style))
        
        # Issue details
        issue_details = [
            ['Severity:', severity.title()],
            ['Category:', issue.get('category', 'unknown').title()],
            ['Element:', issue.get('element', 'N/A')[:100] + ('...' if len(issue.get('element', '')) > 100 else '')],
        ]
        
        if issue.get('selector'):
            issue_details.append(['Selector:', issue.get('selector')])
        
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
        content.append(Paragraph(f"<b>Description:</b> {description}", body_style))
        content.append(Spacer(1, 8))
        
        # AI Suggestion if requested and available
        if report_data.includeAiSuggestions and issue.get('aiSuggestion'):
            ai_suggestion = issue.get('aiSuggestion')
            suggestion_style = ParagraphStyle(
                'AISuggestion',
                parent=body_style,
                leftIndent=20,
                backgroundColor=HexColor('#F0FDF4'),
                borderColor=HexColor('#10B981'),
                borderWidth=1,
                borderPadding=8
            )
            content.append(Paragraph(f"<b>💡 AI Recommendation:</b> {ai_suggestion}", suggestion_style))
        
        content.append(Spacer(1, 20))
        
        # Page break after every 3 issues (except the last)
        if i % 3 == 0 and i < len(report_data.issues):
            content.append(PageBreak())
    
    # Footer information
    content.append(Spacer(1, 40))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=HexColor('#6B7280'),
        alignment=TA_CENTER
    )
    
    content.append(Paragraph("Generated by Inspark Accessibility Assistant", footer_style))
    content.append(Paragraph(f"Report created on {datetime.now().strftime('%Y-%m-%d at %H:%M')}", footer_style))
    content.append(Paragraph("For questions about accessibility compliance, contact your development team.", footer_style))
    
    # Build PDF
    doc.build(content)
    buffer.seek(0)
    return buffer

# ─── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"name": app.title, "version": app.version, "status": "ok"}

@app.post(
    "/api/suggest",
    response_model=SuggestionResponse,
    dependencies=[Depends(verify_api_key)]
)
async def generate_suggestion(request: IssueRequest):
    """
    Simple heuristic suggestion (no AI call).
    """
    try:
        elem = detect_and_redact_pii(request.element)
        key = f"{request.category}:{request.issueType}:{hashlib.md5(elem.encode()).hexdigest()}"
        if key in suggestion_cache:
            txt = suggestion_cache[key]
        else:
            txt = fastapi_suggestion(request)
            suggestion_cache[key] = txt
        return SuggestionResponse(suggestion=txt, timestamp=datetime.now().isoformat())
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
    On-demand Mistral AI suggestion via chat.
    """
    try:
        request.issueDescription = detect_and_redact_pii(request.issueDescription)
        request.element          = detect_and_redact_pii(request.element)
        ai_txt = await call_mistral_api(request)
        return SuggestionResponse(suggestion=ai_txt, timestamp=datetime.now().isoformat())
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
    Batch page analysis using the heuristic /api/suggest.
    """
    try:
        suggestions: Dict[str, str] = {}
        for idx, issue in enumerate(request.issues, start=1):
            req = IssueRequest(
                issueType=issue.get("type", "unknown"),
                issueDescription=detect_and_redact_pii(issue.get("description", "")),
                element=detect_and_redact_pii(issue.get("element", "")),
                severity=issue.get("severity", "moderate"),
                category=issue.get("category", "a11y"),
            )
            resp = await generate_suggestion(req)
            suggestions[f"issue-{idx}"] = resp.suggestion

        summary = f"Analyzed {len(request.issues)} issues on {request.url}"
        return AnalysisResponse(
            suggestions=suggestions,
            summary=summary,
            timestamp=datetime.now().isoformat()
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
    Generate a PDF accessibility report.
    """
    try:
        logger.info(f"Generating PDF report for {request.url}")
        
        # Generate PDF
        pdf_buffer = generate_pdf_report(request)
        
        # Create filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        domain = request.url.split('/')[2] if '/' in request.url else 'report'
        filename = f"accessibility_report_{domain}_{timestamp}.pdf"
        
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
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# ─── Uvicorn entrypoint ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)