import json
import os

os.environ["MOCK_MODE"] = "true"  # never hit the real Gemini API in tests

import pytest
from fastapi.testclient import TestClient

from app import database, main


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    """Point the DB at a throwaway file for every test."""
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test_reports.db")
    database.init_db()
    yield


@pytest.fixture
def client():
    return TestClient(main.app)


def read_events(client, company_name="Acme Corp"):
    events = []
    with client.stream("POST", "/api/research", json={"company_name": company_name}) as r:
        assert r.status_code == 200
        for line in r.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: "):]))
    return events


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_reports_empty_initially(client):
    r = client.get("/api/reports")
    assert r.status_code == 200
    assert r.json() == []


def test_empty_company_name_rejected(client):
    r = client.post("/api/research", json={"company_name": "   "})
    assert r.status_code == 400


def test_full_research_flow_streams_and_saves(client):
    events = read_events(client, "Acme Corp")

    section_starts = [e["section"] for e in events if e["type"] == "section_start"]
    section_completes = [e["section"] for e in events if e["type"] == "section_complete"]
    assert section_starts == ["overview", "key_people", "news", "financials", "risks"]
    assert section_completes == section_starts

    final = events[-1]
    assert final["type"] == "report_complete"
    assert final["company_name"] == "Acme Corp"

    # It should now show up in history and be individually fetchable
    listing = client.get("/api/reports").json()
    assert len(listing) == 1
    assert listing[0]["id"] == final["report_id"]

    detail = client.get(f"/api/reports/{final['report_id']}").json()
    assert detail["overview"]
    assert len(detail["key_people"]) > 0
    assert detail["financials"]["market_cap"] is None  # mock data leaves this null


def test_get_nonexistent_report_404s(client):
    r = client.get("/api/reports/999")
    assert r.status_code == 404


def test_delete_report(client):
    events = read_events(client, "Acme Corp")
    report_id = events[-1]["report_id"]

    r = client.delete(f"/api/reports/{report_id}")
    assert r.status_code == 204
    assert client.get(f"/api/reports/{report_id}").status_code == 404


def test_delete_nonexistent_report_404s(client):
    r = client.delete("/api/reports/999")
    assert r.status_code == 404


def test_unresearchable_company_streams_error(client, monkeypatch):
    async def fake_research(company_name):
        yield {"type": "section_start", "section": "overview"}
        yield {"type": "error", "message": "Couldn't find reliable information."}

    monkeypatch.setattr(main, "research_company", fake_research)

    events = read_events(client, "asdkfjaslkdfj")
    assert events[-1]["type"] == "error"
    assert client.get("/api/reports").json() == []  # nothing was saved
