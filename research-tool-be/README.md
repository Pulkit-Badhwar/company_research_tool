# Company Research Tool — Backend

FastAPI + SQLite backend for the Company Research Tool. An AI agent researches a
company using live Google Search (via Gemini's search grounding) and streams a
5-section report to the frontend over Server-Sent Events.

## How to run

```bash
cd company-research-backend
pip install -r requirements.txt
cp .env.example .env        # then paste in your GEMINI_API_KEY (see below)
uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000`. Point the frontend's `VITE_API_URL` at
that address. No separate database setup needed — `reports.db` (SQLite) is
created automatically on first run, next to this README.

### Running without an API key

If `GEMINI_API_KEY` is unset (or `MOCK_MODE=true` in `.env`), the agent
automatically runs in **mock mode**: it returns canned section data instead of
calling Gemini, on a short artificial delay so the streaming UI still looks
real. The full agent implementation (prompt construction, grounded search,
JSON structuring) is still there in `app/agent.py` — mock mode just skips the
actual network call.

## LLM & search provider

**Google Gemini (`gemini-2.0-flash`)**, via the `google-genai` SDK. Get a free
key at https://aistudio.google.com/apikey — no card required, generous free
tier.

Gemini was chosen specifically because it has **built-in Google Search
grounding** as a model tool. That satisfies both the "LLM provider" and the
"must use live web search (Google Search)" requirements with a single API key
and no separate search API (no SerpAPI/Custom Search Engine setup needed).

## Agent design

For each of the 5 sections, in order (`overview → key_people → news →
financials → risks`):

1. **Grounded search call** — Gemini is called with the `google_search` tool
   enabled and a section-specific question, so it researches that one thing
   live on the web.
2. **Structuring call** — a second Gemini call (JSON response mode) turns that
   raw research into the section's fixed schema (e.g. `{name, title}` pairs
   for `key_people`).

This is what lets the API stream one *complete, ready-to-render* section at a
time instead of a wall of raw text — the frontend gets a `section_start` event
when research on a section begins and a `section_complete` event (with the
finished data) when it's ready.

If the `overview` section comes back empty, the agent treats the company as
unresearchable (bad/gibberish input) and emits an `error` event instead of
continuing — nothing gets saved to the DB in that case.

## API

- `POST /api/research` — `{"company_name": "..."}` → SSE stream of
  `section_start` / `section_complete` / `report_complete` / `error` events.
- `GET /api/reports` — list saved reports, newest first.
- `GET /api/reports/{id}` — full report detail.
- `DELETE /api/reports/{id}` — delete a report (204, or 404 if missing).
- `GET /api/health` — health check.

## Tests

```bash
pytest tests/ -v
```

Tests run with `MOCK_MODE=true`, so no real API calls are made or needed.
They cover: the happy-path stream + save + retrieve + delete flow, empty
input rejection, 404s on missing reports, and the "unresearchable company"
error path.

## Trade-offs / what I'd do differently with more time

- The two-call-per-section design (search, then structure) is simple and
  keeps each section independently streamable, but it's ~10 Gemini calls per
  report. A single combined call per section (asking for grounded search +
  structured output together) would be faster if/when Gemini's tool-calling
  and structured-output modes can be reliably combined in one request.
- No caching — researching the same company twice re-runs the whole agent.
  A simple time-based cache keyed on company name would cut latency and API
  usage for repeat searches.
- No duplicate-concurrent-search guard on the backend (the frontend cancels
  its own in-flight stream when a new search starts, which covers the main
  UX case, but two different browser tabs could still trigger overlapping
  research for the same company).
- SQLite access is synchronous stdlib `sqlite3` inside otherwise-async
  endpoints. Fine at this scale/traffic; would move to an async driver
  (`aiosqlite`) if this ever needed real concurrency.
