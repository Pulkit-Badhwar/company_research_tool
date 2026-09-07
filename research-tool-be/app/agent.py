import asyncio
import json
import logging
import os
from typing import AsyncGenerator

from app.schemas import SECTION_ORDER

logger = logging.getLogger(__name__)
GEMINI_MODEL = "gemini-2.5-flash"

MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true" or not os.getenv("GEMINI_API_KEY")

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


class RateLimitError(Exception):
    """Raised when a Gemini request remains rate-limited after one retry."""


def _retry_delay_seconds(exc: Exception) -> float:
    """Extract a Gemini retry delay, falling back to a conservative wait."""
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", {}) or {}
    retry_after = headers.get("Retry-After") if hasattr(headers, "get") else None
    if retry_after:
        try:
            return float(retry_after)
        except (TypeError, ValueError):
            pass

    def find_delay(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key.lower() in {"retrydelay", "retry_delay"}:
                    if isinstance(item, str) and item.endswith("s"):
                        try:
                            return float(item[:-1])
                        except ValueError:
                            pass
                    if isinstance(item, (int, float)):
                        return float(item)
                delay = find_delay(item)
                if delay is not None:
                    return delay
        elif isinstance(value, list):
            for item in value:
                delay = find_delay(item)
                if delay is not None:
                    return delay
        return None

    for value in (
        getattr(exc, "response_json", None),
        getattr(exc, "details", None),
        getattr(response, "json", None),
    ):
        if callable(value):
            try:
                value = value()
            except Exception:
                continue
        delay = find_delay(value)
        if delay is not None:
            return delay
    return 20.0


def _is_rate_limited(exc: Exception) -> bool:
    from google.genai import errors

    if not isinstance(exc, errors.ClientError):
        return False
    response = getattr(exc, "response", None)
    status = (
        getattr(exc, "status_code", None)
        or getattr(exc, "code", None)
        or getattr(response, "status_code", None)
    )
    return status == 429


async def _generate_with_retry(generate_call):
    for attempt in range(2):
        try:
            return await generate_call()
        except Exception as exc:
            if not _is_rate_limited(exc):
                raise
            if attempt == 1:
                raise RateLimitError from exc
            await asyncio.sleep(_retry_delay_seconds(exc))


async def _grounded_search(client, company: str) -> str:
    """Research all report areas in one Gemini call, grounded in Google Search."""
    from google.genai import types

    prompt = (
        f"Research {company} using reliable, current web sources and provide plain-text "
        "research notes covering all five areas: what the company does (industry, "
        "products or services, customers, positioning), current key leadership (names "
        "and titles), recent news from the last few months, latest financials (revenue, "
        "employee count, market cap, and year-over-year growth), and sales-relevant "
        "risk factors (regulatory, security, competition, litigation, or financial "
        "instability). Clearly label each area. Do not invent facts or numbers."
    )
    response = await _generate_with_retry(
        lambda: client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )
    )
    return response.text or ""


async def _structure_report(client, company: str, raw_text: str) -> dict:
    """Turn all grounded research notes into the report's fixed JSON shape."""
    from google.genai import types

    prompt = (
        f"Company: {company}\n\n"
        f"Research notes:\n{raw_text}\n\n"
        "Split these notes into exactly this JSON schema: "
        '{"overview": str, "key_people": [{"name": str, "title": str}], '
        '"news": [str], "financials": {"revenue": str|null, '
        '"employee_count": str|null, "market_cap": str|null, "yoy_growth": str|null}, '
        '"risks": [str]}. Write a concise 3-5 sentence overview, current specific news '
        "bullets, and sales-relevant risk bullets. Keep every financials value as a "
        "short concrete value (for example, \"$36.4B\"), never a multi-sentence "
        "paragraph. Use null for any financials field you cannot find; never invent "
        "numbers. Use empty lists when no reliable items were found. "
        "Return raw JSON only - no markdown code fences, no commentary."
    )
    response = await _generate_with_retry(
        lambda: client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
    )
    text = (response.text or "{}").strip()
    return json.loads(text)


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

    if MOCK_MODE:
        for section in SECTION_ORDER:
            yield {"type": "section_start", "section": section}
            data = await _mock_section(section)
            yield {"type": "section_complete", "section": section, "data": data}
        return

    for section in SECTION_ORDER:
        yield {"type": "section_start", "section": section}

    try:
        raw_text = await _grounded_search(client, company_name)
        report = await _structure_report(client, company_name, raw_text)
    except RateLimitError:
        yield {
            "type": "error",
            "message": "The research service is rate-limited right now, please wait a minute "
            "and try again.",
        }
        return
    except Exception:
        logger.exception("Research failed for company=%r", company_name)
        yield {
            "type": "error",
            "message": f"Something went wrong researching {company_name}. Please try again.",
        }
        return

    # If we can't build an overview, treat the input as unresearchable.
    if not report.get("overview"):
        yield {
            "type": "error",
            "message": f"Couldn't find reliable information for '{company_name}'. "
            "Check the spelling and try again.",
        }
        return

    for section in SECTION_ORDER:
        yield {"type": "section_complete", "section": section, "data": report.get(section)}
        await asyncio.sleep(0.3)
