import json

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app import database
from app.agent import research_company
from app.schemas import ReportDetail, ReportSummary, ResearchRequest

app = FastAPI(title="Company Research Tool API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local take-home project - fine to leave open
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    database.init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


@app.post("/api/research")
async def research(request: ResearchRequest):
    company_name = request.company_name.strip()
    if not company_name:
        raise HTTPException(status_code=400, detail="Company name is required.")
    if len(company_name) > 200:
        raise HTTPException(status_code=400, detail="Company name is too long.")

    async def event_stream():
        sections: dict = {}
        async for event in research_company(company_name):
            yield _sse(event)

            if event["type"] == "error":
                return  # stream ends here, nothing is saved

            if event["type"] == "section_complete":
                sections[event["section"]] = event["data"]

        saved = database.create_report(company_name, sections)
        yield _sse(
            {
                "type": "report_complete",
                "report_id": saved["id"],
                "company_name": saved["company_name"],
                "created_at": saved["created_at"],
            }
        )

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/reports", response_model=list[ReportSummary])
def get_reports():
    return database.list_reports()


@app.get("/api/reports/{report_id}", response_model=ReportDetail)
def get_report(report_id: int):
    report = database.get_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")
    return report


@app.delete("/api/reports/{report_id}", status_code=204)
def delete_report(report_id: int):
    deleted = database.delete_report(report_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Report not found.")
