# Company Research Tool Startup

Open two PowerShell terminals from:

```powershell
cd C:\Users\pulkit.badhwar_infob\Desktop\company_research_tool
```

## Backend

```powershell
cd .\research-tool-be

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

No separate database setup is required. SQLite creates/uses `reports.db`
automatically.

For UI testing without Gemini quota:

```env
MOCK_MODE=true
```

## Frontend

In the second PowerShell terminal:

```powershell
cd C:\Users\pulkit.badhwar_infob\Desktop\company_research_tool\research-tool-fe
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

Run backend tests:

```powershell
cd C:\Users\pulkit.badhwar_infob\Desktop\company_research_tool\research-tool-be
pytest tests/ -v
```
