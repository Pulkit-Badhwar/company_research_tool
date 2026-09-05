import asyncio
import json
import logging
import os
from typing import AsyncGenerator

from app.schemas import SECTION_ORDER

logger = logging.getLogger(__name__)
GEMINI_MODEL = "gemini-2.5-flash"

MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true" or not os.getenv("GEMINI_API_KEY")

# Each section gets its own web-search question and its own structuring
# instructions, so the agent can research and stream one section at a time.
SECTION_SEARCH_PROMPTS = {
    "overview": "What does {company} do? Describe its industry, core products or "
    "services, target customers, and market positioning.",
    "key_people": "Who are the current C-suite and senior leadership at {company} "
    "(CEO, CTO, CFO, CIO, CISO, etc.)? Include their names and titles.",
    "news": "What is the most recent news about {company} in the last few months? "
    "Look for acquisitions, earnings, product launches, partnerships, layoffs, or "
    "leadership changes.",
    "financials": "What are {company}'s latest financial figures: revenue, employee "
    "count, market cap (if public), and year-over-year growth?",
    "risks": "What risk factors could come up in a sales conversation with {company}? "
    "Look for regulatory scrutiny, security breaches, competitive threats, pending "
    "litigation, or financial instability.",
}

SECTION_STRUCTURE_INSTRUCTIONS = {
    "overview": (
        "Write a 3-5 sentence briefing paragraph a sales rep could read in 30 seconds. "
        'Return ONLY JSON: {"overview": "<paragraph, or null if nothing reliable was found>"}'
    ),
    "key_people": (
        'Return ONLY JSON: {"key_people": [{"name": "...", "title": "..."}]}. '
        "Include only senior leadership relevant to a sales conversation. "
        "Return an empty list if none were found."
    ),
    "news": (
        'Return ONLY JSON: {"news": ["<bullet>", ...]}. 3-4 bullets, most recent first. '
        "Each bullet should be one specific, current fact - not generic filler. "
        "Return an empty list if nothing current was found."
    ),
    "financials": (
        'Return ONLY JSON: {"financials": {"revenue": "...", "employee_count": "...", '
        '"market_cap": "...", "yoy_growth": "..."}}. Use null for any figure that is '
        "genuinely unavailable (e.g. market_cap for a private company). Never invent numbers."
    ),
    "risks": (
        'Return ONLY JSON: {"risks": ["<bullet>", ...]}. 2-3 bullets. '
        "Return an empty list if none were found."
    ),
}

_MOCK_DATA = {
    "overview": "Acme Corp is a mid-market SaaS company providing supply-chain "
    "visibility software to logistics and manufacturing clients. It positions "
    "itself as a faster, cheaper alternative to legacy ERP add-ons, targeting "
    "operations and procurement leaders at companies with 500-5,000 employees.",
    "key_people": [
        {"name": "Jordan Lee", "title": "Chief Executive Officer"},
        {"name": "Priya Nair", "title": "Chief Technology Officer"},
        {"name": "Sam Okafor", "title": "Chief Financial Officer"},
    ],
    "news": [
        "Announced a $40M Series C led by a growth-stage VC firm (this quarter).",
        "Launched an AI-powered demand forecasting module.",
        "Signed a partnership with a major freight carrier for integrated tracking.",
    ],
    "financials": {
        "revenue": "$65M ARR (est.)",
        "employee_count": "~310",
        "market_cap": None,
        "yoy_growth": "42%",
    },
    "risks": [
        "Operates in a crowded space with several well-funded competitors.",
        "Recent leadership turnover in the VP Sales role.",
    ],
}


async def _mock_section(section: str):
    await asyncio.sleep(0.6)  # simulate research taking a moment
    return _MOCK_DATA[section]


async def _grounded_search(client, company: str, section: str) -> str:
    """Ask Gemini to research a section live, grounded in Google Search."""
    from google.genai import types

    prompt = SECTION_SEARCH_PROMPTS[section].format(company=company)
    response = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
        ),
    )
    return response.text or ""


async def _structure_section(client, company: str, section: str, raw_text: str) -> dict:
    """Turn raw grounded research text into the section's fixed JSON shape."""
    from google.genai import types

    prompt = (
        f"Company: {company}\n\n"
        f"Research notes:\n{raw_text}\n\n"
        f"{SECTION_STRUCTURE_INSTRUCTIONS[section]}\n"
        "Return raw JSON only - no markdown code fences, no commentary."
    )
    response = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    text = (response.text or "{}").strip()
    parsed = json.loads(text)
    return parsed.get(section)


async def research_company(company_name: str) -> AsyncGenerator[dict, None]:
    """
    Runs the research agent for one company, yielding SSE-ready event dicts
    as each section completes. Stops early and yields an "error" event if the
    company can't be researched at all (e.g. gibberish input).
    """
    client = None
    if not MOCK_MODE:
        from google import genai

        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    for section in SECTION_ORDER:
        yield {"type": "section_start", "section": section}

        try:
            if MOCK_MODE:
                data = await _mock_section(section)
            else:
                raw_text = await _grounded_search(client, company_name, section)
                data = await _structure_section(client, company_name, section, raw_text)
        except Exception:  # network / API / parsing failures
            logger.exception("Research failed for company=%r section=%s", company_name, section)
            yield {
                "type": "error",
                "message": f"Something went wrong researching {company_name}. Please try again.",
            }
            return

        # If we can't even build an overview, treat the input as unresearchable
        # (gibberish company name, nothing found on the web) and stop there.
        if section == "overview" and not data:
            yield {
                "type": "error",
                "message": f"Couldn't find reliable information for '{company_name}'. "
                "Check the spelling and try again.",
            }
            return

        yield {"type": "section_complete", "section": section, "data": data}
