# main.py

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import os
from datetime import datetime
import hashlib
import requests

# ─── Logging ───
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("inspark-a11y-assistant")

# ─── FastAPI app ───
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

# ─── Models ───
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

# ─── Cache (for classic suggestion only) ───
suggestion_cache: Dict[str, str] = {}

# ─── Helpers ───
def detect_and_redact_pii(text: str) -> str:
    return text

async def verify_api_key(request: Request):
    return True

# ─── FastAPI/heuristic suggestion (classic) ───
def fastapi_suggestion(issue: IssueRequest) -> str:
    suggestions = {
        "a11y": {
            "color-contrast": "Increase the contrast ratio. Try using a darker text or lighter background.",
            "image-alt": "Add alt text to images describing their function.",
            "default": "Review WCAG guidelines for accessibility compliance.",
        },
        "uiux": {
            "touch-target-size": "Increase touch target to at least 44×44 px so users can tap easily.",
            "font-size-too-small": "Boost text size to at least 16 px for readability.",
            "viewport-width": "Ensure content fits within the viewport to avoid horizontal scrolling.",
            "layout-shift": "Reduce layout shifts by reserving image space and avoiding late DOM changes.",
            "lcp": "Optimize largest contentful paint by deferring unused CSS and images.",
            "inp": "Improve interactivity by reducing JavaScript blocking time below 200 ms.",
            "default": "Follow Inspark UI/UX guidelines to ensure a smooth user experience.",
        }
    }
    return (
        suggestions.get(issue.category, {}).get(issue.issueType)
        or suggestions.get(issue.category, {}).get("default")
        or "Review accessibility and UI/UX best practices."
    )

# ─── OpenRouter/DeepSeek Suggestion with Multiple API Key Support ───
def call_deepseek_openrouter(issue: IssueRequest) -> str:
    raw_keys = os.getenv("OPENROUTER_API_KEY", "")
    all_keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
    if not all_keys:
        raise HTTPException(status_code=500, detail="OpenRouter API key not configured.")

    # Shorten description to first 100 characters
    short_desc = issue.issueDescription
    if len(short_desc) > 100:
        short_desc = short_desc[:100] + "…"

    # Shorten HTML element to first 80 characters
    short_elem = issue.element
    if len(short_elem) > 80:
        short_elem = short_elem[:80] + "…"

    # Build a concise prompt asking for a brief recommendation
    prompt = (
        "You are an accessibility and UI/UX expert. Give a very brief fix (under 30 words).\n"
        f"Issue Type: {issue.issueType}\n"
        f"Severity: {issue.severity}\n"
        f"Description (short): {short_desc}\n"
        f"HTML Element (short): {short_elem}\n"
        "Return only the recommendation."
    )

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = { "Content-Type": "application/json" }
    payload_template = {
        "model": "mistralai/mistral-7b-instruct:free",
        "messages": [ { "role": "user", "content": prompt } ]
    }

    last_error = None
    for key in all_keys:
        headers["Authorization"] = f"Bearer {key}"
        try:
            resp = requests.post(url, headers=headers, json=payload_template, timeout=30)
            resp.raise_for_status()
            out = resp.json()
            if (
                "choices" in out and len(out["choices"]) > 0 and
                "message" in out["choices"][0] and
                "content" in out["choices"][0]["message"]
            ):
                return out["choices"][0]["message"]["content"].strip()
            return "Sorry, could not generate an AI suggestion."
        except Exception as e:
            last_error = e
            logger.warning(f"OpenRouter key failed: {key} → {e}")
            continue

    logger.error(f"All API keys failed: {last_error}")
    raise HTTPException(status_code=500, detail="All OpenRouter keys failed or are exhausted.")

# ─── Routes ───

@app.get("/")
async def root():
    return {"name": app.title, "version": app.version, "status": "operational"}

@app.post("/api/suggest", response_model=SuggestionResponse, dependencies=[Depends(verify_api_key)])
async def generate_suggestion(request: IssueRequest):
    """
    Classic FastAPI/heuristic suggestion (always runs)
    """
    try:
        elem = detect_and_redact_pii(request.element)
        desc = detect_and_redact_pii(request.issueDescription)
        key = f"{request.category}:{request.issueType}:{hashlib.md5(elem.encode()).hexdigest()}"
        if key in suggestion_cache:
            logger.info(f"Cache hit: {key}")
            return SuggestionResponse(
                suggestion=suggestion_cache[key],
                timestamp=datetime.now().isoformat()
            )
        suggestion = fastapi_suggestion(request)
        suggestion_cache[key] = suggestion
        return SuggestionResponse(
            suggestion=suggestion,
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        logger.error(f"Error [/api/suggest]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai_suggest", response_model=SuggestionResponse, dependencies=[Depends(verify_api_key)])
async def ai_generate_suggestion(request: IssueRequest):
    """
    DeepSeek (OpenRouter) AI suggestion (only runs when user clicks AI Suggestion)
    """
    try:
        elem = detect_and_redact_pii(request.element)
        desc = detect_and_redact_pii(request.issueDescription)
        ai_suggestion = call_deepseek_openrouter(request)
        return SuggestionResponse(
            suggestion=ai_suggestion,
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        logger.error(f"Error [/api/ai_suggest]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze", response_model=AnalysisResponse, dependencies=[Depends(verify_api_key)])
async def analyze_page(request: AnalysisRequest):
    """
    Analyze a full page and generate suggestions for each issue (using FastAPI/heuristic).
    """
    try:
        suggestions: Dict[str, str] = {}
        for idx, issue in enumerate(request.issues):
            req = IssueRequest(
                issueType=issue.get("type", "unknown"),
                issueDescription=detect_and_redact_pii(issue.get("description", "")),
                element=detect_and_redact_pii(issue.get("element", "")),
                severity=issue.get("severity", "moderate"),
                category=issue.get("category", "a11y"),
                context={"url": request.url}
            )
            resp = await generate_suggestion(req)
            suggestions[f"issue-{idx+1}"] = resp.suggestion

        summary = f"Analysis completed for {request.url}. Found {len(request.issues)} issues."
        return AnalysisResponse(
            suggestions=suggestions,
            summary=summary,
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        logger.error(f"Error [/api/analyze]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# ─── Run locally ───
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
