"""Pydantic models for the ChartVoice API.

These classes are the API contract in code (see docs/api-contract.md).
FastAPI uses them to validate requests and to shape responses, so if a
field changes here, it changes for everyone.
"""

from typing import Literal, Optional, Union

from pydantic import BaseModel, Field

ChartType = Literal["bar", "line", "pie", "unknown"]
Trend = Literal["increasing", "decreasing", "flat", "mixed"]
Cell = Union[str, float, int, None]


class ChartTable(BaseModel):
    """First column holds labels; other columns hold numbers or null."""

    columns: list[str]
    rows: list[list[Cell]]


class Point(BaseModel):
    label: str
    value: float


class Change(BaseModel):
    from_: str = Field(alias="from")
    to: str
    change: float

    model_config = {"populate_by_name": True}


class Share(BaseModel):
    label: str
    percent: float


class SeriesFacts(BaseModel):
    name: str
    max: Optional[Point] = None
    min: Optional[Point] = None
    first: Optional[Point] = None
    last: Optional[Point] = None
    change_abs: Optional[float] = None
    change_pct: Optional[float] = None
    trend: Trend = "flat"
    biggest_rise: Optional[Change] = None
    biggest_drop: Optional[Change] = None
    total: Optional[float] = None
    shares: Optional[list[Share]] = None


class Facts(BaseModel):
    series: list[SeriesFacts] = []


class ApiWarning(BaseModel):
    code: str
    message: str


class Timing(BaseModel):
    extract: int = 0
    llm: int = 0
    total: int = 0


class AnalyzeResponse(BaseModel):
    chart_type: ChartType
    title: Optional[str] = None
    table: ChartTable
    facts: Facts
    summary: str
    explanation: str
    text_source: Literal["llm", "template"]
    extractor: Literal["vision", "deplot"] = "deplot"
    warnings: list[ApiWarning] = []
    timing_ms: Timing


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    title: Optional[str] = None
    chart_type: ChartType = "unknown"
    table: ChartTable
    facts: Facts
    history: list[ChatMessage] = Field(default_factory=list, max_length=6)


class AskResponse(BaseModel):
    answer: str
    on_topic: bool


class CompareResponse(BaseModel):
    description: str
    model: str
    timing_ms: int


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    extractor: str = "auto"
    online: bool = False
