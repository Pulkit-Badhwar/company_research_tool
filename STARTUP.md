# Company Research Tool Startup

Open two terminals, both starting from the project root folder
(`company_research_tool`, or whatever you've named it).

## Backend

```powershell
cd research-tool-be

pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `research-tool-be\.env` and set your own Gemini key:

```env
GEMINI_API_KEY=your_key_here
MOCK_MODE=false
```

Start the backend:

```powershell
uvicorn app.main:app --reload --port 8000
```

Backend URL: `http://localhost:8000`

For UI testing without using any Gemini quota:

```env
MOCK_MODE=true
```

### Which LLM, and why

We use **Google Gemini 2.5 Flash** (`gemini-2.5-flash`), via the `google-genai`
SDK. Get a free key at https://aistudio.google.com/apikey — no card required.

It was chosen specifically because it has **built-in Google Search grounding**
as a model tool. That covers both the assignment's "LLM provider" requirement
and its "must use live web search (Google Search)" requirement with a single
API key — no separate search API (SerpAPI, Custom Search Engine, etc.) needed.

**Free tier note:** the free tier is limited to 5 requests/minute per project.
The agent is designed to use only 2 Gemini calls per report (one grounded
research call, one structuring call), so a normal session comfortably fits
several company searches per minute. If you do see a `429` / rate-limit error,
wait about a minute and try again, or switch to `MOCK_MODE=true` above to keep
demoing without touching the API at all.

## Database (SQLite)

**No installation is required for the app to work.** SQLite isn't a server —
it's built directly into Python (`import sqlite3`). The moment the backend
starts (`uvicorn` command above), a file called `reports.db` is created
automatically inside `research-tool-be\` and used from then on. Nothing to
configure.

If you want to **open and inspect `reports.db` yourself** (to check saved
reports, debug, or show someone the raw data), install a free GUI viewer:

1. Download **DB Browser for SQLite** from https://sqlitebrowser.org/dl/
   (Windows `.msi`, 64-bit)
2. Run the installer, accept the defaults
3. Open **DB Browser for SQLite**
4. File → Open Database → navigate into your project's
   `research-tool-be\` folder → select `reports.db` → Open
5. Click the **Browse Data** tab, then select the `reports` table from the
   dropdown — this shows every saved report as a row
6. DB Browser doesn't auto-refresh — after generating a new report in the app,
   click the refresh icon (or re-select the `reports` table) to see the new row

## Frontend

In the second terminal, from the project root:

```powershell
cd research-tool-fe
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:3000`.

The frontend defaults to the backend at `http://localhost:8000`. If a different
backend URL is needed, create `research-tool-fe\.env` with:

```env
VITE_API_URL=http://localhost:8000
```

## Stop

Press `Ctrl+C` in each terminal.

## Useful checks

Backend health: `http://localhost:8000/api/health`

Run backend tests (from the project root):

```powershell
cd research-tool-be
pytest tests/ -v
```

View saved reports directly: open `reports.db` in DB Browser for SQLite (see
**Database (SQLite)** section above).