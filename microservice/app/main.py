# main.py

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import os
import json
import time
from datetime import datetime
import hashlib
import requests
from huggingface_hub import InferenceClient

# ─── Configure logging ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("inspark-a11y-assistant")

# ─── Instantiate HF client ────────────────────────────────────────
hf_api_key = os.getenv("MISTRAL_API_KEY")
if not hf_api_key:
    logger.warning("MISTRAL_API_KEY not set; /api/suggest will error")
hf_client = InferenceClient(token=hf_api_key)

# ─── FastAPI app setup ─────────────────────────────────────────────
app = FastAPI(
    title="Inspark AI-Powered Accessibility Assistant",
    description="AI microservice for generating accessibility and UI/UX suggestions",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # tighten this in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request / Response models ─────────────────────────────────────
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

# ─── In-memory cache ───────────────────────────────────────────────
suggestion_cache: Dict[str, str] = {}

# ─── PII redaction stub ────────────────────────────────────────────
def detect_and_redact_pii(text: str) -> str:
    # In prod you'd regex-redact emails, phones, SSNs, etc.
    return text

# ─── API key check stub ────────────────────────────────────────────
async def verify_api_key(request: Request):
    # No-op in dev. To enforce, check X-API-Key vs env var here.
    return True

# ─── HF call helper ────────────────────────────────────────────────
def call_hf_instruct(prompt: str) -> str:
    """
    Call Hugging Face inference API for Mistral-7B-Instruct.
    """
    if not hf_api_key:
        raise HTTPException(status_code=500, detail="Mistral API key not configured")

    # ✅ use /models/ rather than /pipeline/
    url = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1"
    headers = {"Authorization": f"Bearer {hf_api_key}"}
    payload = {
      "inputs": prompt,
      "parameters": {"max_new_tokens": 100}
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    resp.raise_for_status()
    out = resp.json()

    # HF returns a list of {generated_text: ...}
    if isinstance(out, list) and out and "generated_text" in out[0]:
        return out[0]["generated_text"]
    if isinstance(out, dict) and "generated_text" in out:
        return out["generated_text"]

    raise HTTPException(status_code=500, detail="Unexpected Hugging Face response")


# ─── Routes ────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"name": app.title, "version": app.version, "status": "operational"}

@app.post(
    "/api/suggest",
    response_model=SuggestionResponse,
    dependencies=[Depends(verify_api_key)]
)
async def generate_suggestion(request: IssueRequest):
    """
    Generate an AI-powered suggestion for a single issue.
    """
    try:
        # redact PII
        elem = detect_and_redact_pii(request.element)
        desc = detect_and_redact_pii(request.issueDescription)

        # caching key
        key = f"{request.category}:{request.issueType}:{hashlib.md5(elem.encode()).hexdigest()}"
        if key in suggestion_cache:
            logger.info(f"Cache hit: {key}")
            return SuggestionResponse(
                suggestion=suggestion_cache[key],
                timestamp=datetime.now().isoformat()
            )

        # build prompt
        prompt = (
            "You are an accessibility and UI/UX assistant.\n"
            f"Issue Type: {request.issueType}\n"
            f"Severity: {request.severity}\n"
            f"Description: {desc}\n"
            f"HTML Element: {elem}\n\n"
            "Please suggest a clear, concise fix."
        )

        # call HF
        suggestion = call_hf_instruct(prompt)

        # cache & return
        suggestion_cache[key] = suggestion
        return SuggestionResponse(
            suggestion=suggestion,
            timestamp=datetime.now().isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error [/api/suggest]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post(
    "/api/analyze",
    response_model=AnalysisResponse,
    dependencies=[Depends(verify_api_key)]
)
async def analyze_page(request: AnalysisRequest):
    """
    Analyze a full page and generate suggestions for each issue.
    """
    try:
        # redact PII from HTML
        _ = detect_and_redact_pii(request.html)
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

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error [/api/analyze]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# ─── Run locally ───────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
