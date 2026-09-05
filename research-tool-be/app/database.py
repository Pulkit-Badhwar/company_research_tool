import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).resolve().parent.parent / "reports.db"


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                overview TEXT,
                key_people TEXT NOT NULL,
                news TEXT NOT NULL,
                financials TEXT,
                risks TEXT NOT NULL
            )
            """
        )


def create_report(company_name: str, sections: dict) -> dict:
    created_at = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO reports (company_name, created_at, overview, key_people, news, financials, risks)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                company_name,
                created_at,
                sections.get("overview"),
                json.dumps(sections.get("key_people", [])),
                json.dumps(sections.get("news", [])),
                json.dumps(sections.get("financials")) if sections.get("financials") else None,
                json.dumps(sections.get("risks", [])),
            ),
        )
        return {"id": cursor.lastrowid, "company_name": company_name, "created_at": created_at}


def list_reports() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, company_name, created_at FROM reports ORDER BY created_at DESC"
        ).fetchall()
        return [dict(row) for row in rows]


def get_report(report_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        if row is None:
            return None
        report = dict(row)
        report["key_people"] = json.loads(report["key_people"])
        report["news"] = json.loads(report["news"])
        report["financials"] = json.loads(report["financials"]) if report["financials"] else None
        report["risks"] = json.loads(report["risks"])
        return report


def delete_report(report_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
        return cursor.rowcount > 0
