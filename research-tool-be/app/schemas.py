from typing import List, Optional
from pydantic import BaseModel

SECTION_ORDER = ["overview", "key_people", "news", "financials", "risks"]


class KeyPerson(BaseModel):
    name: str
    title: str


class Financials(BaseModel):
    revenue: Optional[str] = None
    employee_count: Optional[str] = None
    market_cap: Optional[str] = None
    yoy_growth: Optional[str] = None


class ResearchRequest(BaseModel):
    company_name: str


class ReportSummary(BaseModel):
    id: int
    company_name: str
    created_at: str


class ReportDetail(ReportSummary):
    overview: Optional[str] = None
    key_people: List[KeyPerson] = []
    news: List[str] = []
    financials: Optional[Financials] = None
    risks: List[str] = []
