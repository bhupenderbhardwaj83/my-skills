"""FastAPI backend for a calm-app-design front end — a complete, secure starting point.

Matches assets/react/api.ts + useApi.ts:
  GET  /api/threats          server-side table: page, size, sort, order, q, range, filters (JSON)
  GET  /api/threats.csv      every matching row as CSV (formula-injection safe)
  POST /api/threats/bulk-close
  GET  /api/graph            nodes + edges for <GraphView>
  GET  /api/graph/events     Server-Sent Events for live graphs / workflows
  POST /api/assistant        streamed text for <AiAssistant>; 503 "not set up" without a model
  GET  /api/session          sets the CSRF cookie (double-submit) for cookie-based sessions

Run:   pip install "fastapi>=0.110" "uvicorn[standard]"
       ALLOWED_ORIGINS=http://localhost:3000 uvicorn app:app --reload --port 8000
Next.js: either rewrite /api/* to http://localhost:8000 (same origin — simplest, no CORS) or set
         NEXT_PUBLIC_API_URL and list the site in ALLOWED_ORIGINS.

Security, on by default: allow-listed CORS origins (never "*" with credentials), strict security
headers, every input bounded by Pydantic (lengths, ranges, allow-listed sort and filter fields),
CSRF check on writes when a cookie session exists, generic 500s (details only in the log),
a per-client rate limit on the AI endpoint, API docs off in production.
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import os
import random
import re
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Annotated, Generic, Iterator, Literal, TypeVar

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError

log = logging.getLogger("calm-api")

# ── settings (environment, never hard-coded secrets) ─────────────────────────
PRODUCTION = os.getenv("ENV", "development") == "production"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
if "*" in ALLOWED_ORIGINS:
    raise RuntimeError("ALLOWED_ORIGINS must list real origins: '*' cannot be used with cookies or auth headers.")
SECURE_COOKIES = PRODUCTION or os.getenv("SECURE_COOKIES") == "1"
AI_PROVIDER_KEY = os.getenv("AI_API_KEY")  # read on the server only; never sent to the browser
CSRF_COOKIE, CSRF_HEADER = "csrftoken", "X-CSRF-Token"
# Desktop sidecar (Tauri / Electron): the app starts this server with a random APP_TOKEN and sends
# it in X-App-Token, so other programs and web pages on this computer can't use the API.
APP_TOKEN = os.getenv("APP_TOKEN")

app = FastAPI(
    title="Calm console API",
    docs_url=None if PRODUCTION else "/docs",
    redoc_url=None,
    openapi_url=None if PRODUCTION else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", CSRF_HEADER, "Last-Event-ID", "X-App-Token"],
    max_age=600,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    if APP_TOKEN and request.method != "OPTIONS" and not secrets.compare_digest(request.headers.get("x-app-token", ""), APP_TOKEN):
        response = JSONResponse({"detail": "This service only answers its own app."}, status_code=401)
    else:
        response = await call_next(request)
    h = response.headers
    h.setdefault("X-Content-Type-Options", "nosniff")
    h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    h.setdefault("X-Frame-Options", "DENY")
    h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    # The API returns data, never pages: nothing in a response may load or run anything.
    h.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
    h.setdefault("Cache-Control", "no-store")
    if request.url.scheme == "https":
        h.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
    return response


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    # Full detail goes to the server log; the browser gets a calm message and a reference.
    ref = secrets.token_hex(4)
    log.exception("Unhandled error %s on %s %s", ref, request.method, request.url.path)
    return JSONResponse({"detail": f"The server had a problem (ref {ref}). Try again in a moment."}, status_code=500)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Same shape FastAPI uses ({detail: [{loc, msg}]}), without echoing the submitted input back.
    return JSONResponse({"detail": [{"loc": list(e.get("loc", ())), "msg": e.get("msg", "Invalid value")} for e in exc.errors()]}, status_code=422)


# ── CSRF (double-submit cookie) ──────────────────────────────────────────────
def csrf_protect(request: Request) -> None:
    """Writes made with a cookie session must echo the CSRF cookie in a header (api.ts does this).
    Requests authenticated only by an Authorization header are not exposed to CSRF."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    cookie = request.cookies.get(CSRF_COOKIE)
    if cookie is None and "authorization" in request.headers:
        return
    header = request.headers.get(CSRF_HEADER, "")
    if not cookie or not secrets.compare_digest(cookie, header):
        raise HTTPException(403, "Your session expired — reload the page and try again.")


@app.get("/api/session")
def session(response: Response) -> dict:
    token = secrets.token_urlsafe(32)
    # Readable by the page's JS (that's the point of double-submit); SameSite stops cross-site sends.
    response.set_cookie(CSRF_COOKIE, token, samesite="lax", secure=SECURE_COOKIES, httponly=False, max_age=8 * 3600, path="/")
    return {"ok": True}


# ── models ───────────────────────────────────────────────────────────────────
T = TypeVar("T")
Severity = Literal["critical", "high", "medium", "low"]
Status = Literal["open", "in_progress", "resolved"]


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int


class Threat(BaseModel):
    id: str
    title: str
    severity: Severity
    status: Status
    assignee: str | None
    resources: int
    created: datetime


# Only these fields can be sorted or filtered: the allow-list is what keeps user input out of queries.
SortField = Literal["title", "severity", "status", "assignee", "resources", "created"]
FilterField = Literal["severity", "status", "assignee"]


class FilterIn(BaseModel):
    """One FilterBar chip: {field, not, values}."""
    model_config = ConfigDict(extra="forbid")
    field: FilterField
    not_: bool = Field(False, alias="not")
    values: list[Annotated[str, Field(max_length=100)]] = Field(max_length=50)


FILTERS = TypeAdapter(list[FilterIn])
RANGES = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30), "90d": timedelta(days=90), "12m": timedelta(days=365)}


class ListParams(BaseModel):
    page: int = 0
    size: int = 10
    sort: SortField | None = None
    order: Literal["asc", "desc"] = "asc"
    q: str | None = None
    range: Literal["24h", "7d", "30d", "90d", "12m"] | None = None
    filters: list[FilterIn] = []


def list_params(
    page: Annotated[int, Query(ge=0, le=100_000)] = 0,
    size: Annotated[int, Query(ge=1, le=200)] = 10,
    sort: SortField | None = None,
    order: Literal["asc", "desc"] = "asc",
    q: Annotated[str | None, Query(max_length=200)] = None,
    range: Literal["24h", "7d", "30d", "90d", "12m"] | None = None,
    filters: Annotated[str | None, Query(max_length=4000)] = None,
) -> ListParams:
    try:
        parsed = FILTERS.validate_json(filters) if filters else []
    except ValidationError as e:
        raise RequestValidationError([{**err, "loc": ("query", "filters", *err["loc"])} for err in e.errors()]) from None
    return ListParams(page=page, size=size, sort=sort, order=order, q=q, range=range, filters=parsed)


# ── demo data (replace with your database) ───────────────────────────────────
_rng = random.Random(7)
_NOW = datetime.now(timezone.utc)
_TITLES = ["Exposed storage bucket", "Outdated OpenSSL", "Admin without MFA", "Public SSH port", "Leaked access key",
           "Container runs as root", "Unpatched kernel", "Wildcard IAM policy", "Open database port", "Expired TLS certificate"]
DB: dict[str, Threat] = {
    f"T-{1000 + i}": Threat(
        id=f"T-{1000 + i}", title=f"{_rng.choice(_TITLES)} on {_rng.choice(['web', 'api', 'db', 'cache'])}-{_rng.randint(1, 40)}",
        severity=_rng.choice(["critical", "high", "high", "medium", "medium", "low"]),
        status=_rng.choice(["open", "open", "in_progress", "resolved"]),
        assignee=_rng.choice([None, "Asha", "Ben", "Chen", "Dana"]), resources=_rng.randint(1, 60),
        created=_NOW - timedelta(minutes=_rng.randint(0, 60 * 24 * 300)),
    )
    for i in range(240)
}
SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def query_threats(p: ListParams) -> list[Threat]:
    """With SQL: build the WHERE / ORDER BY from these same allow-listed fields and bind every value
    as a parameter (SQLAlchemy `select().where(col.in_(values))`) — never format strings into SQL."""
    rows = list(DB.values())
    if p.range:
        since = datetime.now(timezone.utc) - RANGES[p.range]
        rows = [r for r in rows if r.created >= since]
    for f in p.filters:
        rows = [r for r in rows if ((getattr(r, f.field) or "") in f.values) != f.not_]
    if p.q:
        words = p.q.lower().split()
        rows = [r for r in rows if all(w in f"{r.id} {r.title} {r.assignee or ''} {r.status} {r.severity}".lower() for w in words)]
    if p.sort:
        key = (lambda r: SEV_ORDER[r.severity]) if p.sort == "severity" else (lambda r: (getattr(r, p.sort) is None, getattr(r, p.sort) or ""))
        rows.sort(key=key, reverse=p.order == "desc")
    return rows


@app.get("/api/threats", response_model=Page[Threat])
def list_threats(p: Annotated[ListParams, Depends(list_params)]) -> Page[Threat]:
    rows = query_threats(p)
    return Page(items=rows[p.page * p.size : (p.page + 1) * p.size], total=len(rows))


_FORMULA = re.compile(r"^[=+\-@\t\r]")
_NUMBER = re.compile(r"^-?\d+(\.\d+)?$")


def csv_cell(value: object) -> str:
    """Spreadsheet-safe text: a cell starting with = + - @ would run as a formula in Excel / Sheets."""
    s = value.isoformat() if isinstance(value, datetime) else "" if value is None else str(value)
    return f"'{s}" if _FORMULA.match(s) and not _NUMBER.match(s) else s


@app.get("/api/threats.csv")
def export_threats(
    page: Annotated[int, Query(ge=0)] = 0,
    size: Annotated[int, Query(ge=0, le=200)] = 0,  # api.ts sends size=0 → every matching row
    sort: SortField | None = None,
    order: Literal["asc", "desc"] = "asc",
    q: Annotated[str | None, Query(max_length=200)] = None,
    range: Literal["24h", "7d", "30d", "90d", "12m"] | None = None,
    filters: Annotated[str | None, Query(max_length=4000)] = None,
) -> StreamingResponse:
    p = list_params(page=0, size=1, sort=sort, order=order, q=q, range=range, filters=filters)
    rows = query_threats(p)[:50_000]
    cols = ["id", "title", "severity", "status", "assignee", "resources", "created"]

    def gen() -> Iterator[str]:
        buf = io.StringIO()
        w = csv.writer(buf)
        buf.write("﻿")  # Excel reads UTF-8 with a BOM
        w.writerow(cols)
        for r in rows:
            w.writerow([csv_cell(getattr(r, c)) for c in cols])
            if buf.tell() > 64_000:
                yield buf.getvalue(); buf.seek(0); buf.truncate()
        yield buf.getvalue()

    return StreamingResponse(gen(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="threats.csv"'})


class BulkClose(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[Annotated[str, Field(pattern=r"^T-\d{1,9}$")]] = Field(min_length=1, max_length=500)


@app.post("/api/threats/bulk-close", dependencies=[Depends(csrf_protect)])
def bulk_close(body: BulkClose) -> dict:
    # Real apps: check the signed-in user may change each row (authorisation), not just that it exists.
    closed = 0
    for i in body.ids:
        if (t := DB.get(i)) and t.status != "resolved":
            DB[i] = t.model_copy(update={"status": "resolved"})
            closed += 1
    return {"closed": closed}


# ── graph + live events ──────────────────────────────────────────────────────
class GraphNodeOut(BaseModel):
    id: str
    label: str
    sublabel: str | None = None
    tone: Literal["default", "accent", "critical", "high", "medium", "low", "ok", "muted"] = "default"
    badge: int | None = None


class GraphEdgeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    from_: str = Field(alias="from")
    to: str
    label: str | None = None
    active: bool = False


class Graph(BaseModel):
    nodes: list[GraphNodeOut]
    edges: list[GraphEdgeOut]


GRAPH = Graph(
    nodes=[GraphNodeOut(id="internet", label="Internet"), GraphNodeOut(id="lb", label="Load balancer", sublabel="public"),
           GraphNodeOut(id="web", label="web-12", sublabel="VM", tone="high", badge=3),
           GraphNodeOut(id="db", label="orders-db", sublabel="Postgres", tone="critical", badge=1),
           GraphNodeOut(id="key", label="Access key", sublabel="leaked", tone="critical")],
    edges=[GraphEdgeOut(**{"from": "internet", "to": "lb"}), GraphEdgeOut(**{"from": "lb", "to": "web", "label": "443"}),
           GraphEdgeOut(**{"from": "web", "to": "db", "label": "5432"}), GraphEdgeOut(**{"from": "key", "to": "db"})],
)


@app.get("/api/graph", response_model=Graph, response_model_by_alias=True)
def graph() -> Graph:
    return GRAPH


def sse(data: object, event: str | None = None, id: str | None = None) -> str:
    """One Server-Sent Event. JSON never contains a raw newline, so one data: line is enough."""
    head = (f"id: {id}\n" if id else "") + (f"event: {event}\n" if event else "")
    return f"{head}data: {json.dumps(data, separators=(',', ':'))}\n\n"


@app.get("/api/graph/events")
async def graph_events(request: Request) -> StreamingResponse:
    """Live updates: which edge is carrying traffic now. api.ts `subscribe` reconnects and sends
    Last-Event-ID; a real feed would resume from it."""
    last = request.headers.get("last-event-id", "")
    start = int(last) if last.isdigit() and len(last) < 12 else 0

    async def gen():
        n = start
        yield "retry: 3000\n\n"
        while not await request.is_disconnected():
            n += 1
            edge = GRAPH.edges[n % len(GRAPH.edges)]
            yield sse({"active": [f"{edge.from_}->{edge.to}"], "at": time.time()}, event="flow", id=str(n))
            for _ in range(10):  # ~1 s between events, with a quick check for disconnects
                await asyncio.sleep(0.1)
                if await request.is_disconnected():
                    return
            if n % 15 == 0:
                yield ": keep-alive\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"X-Accel-Buffering": "no"})


# ── AI assistant ─────────────────────────────────────────────────────────────
class Msg(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class AskIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    messages: list[Msg] = Field(min_length=1, max_length=40)


_hits: dict[str, deque[float]] = defaultdict(deque)


def rate_limit(request: Request, per_minute: int = 20) -> None:
    """Small in-process limiter (one server). Behind several workers use your proxy or Redis."""
    who = request.client.host if request.client else "unknown"
    now, q = time.monotonic(), _hits[who]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= per_minute:
        raise HTTPException(429, "Too many questions in a minute — wait a moment and try again.")
    q.append(now)


@app.post("/api/assistant", dependencies=[Depends(csrf_protect), Depends(rate_limit)])
async def assistant(body: AskIn) -> StreamingResponse:
    if AI_PROVIDER_KEY is None and os.getenv("DEMO_ASSISTANT") != "1":
        # The UI shows its calm "not set up" state; everything else keeps working.
        raise HTTPException(503, "The assistant isn't set up on this server.")
    question = body.messages[-1].content

    async def gen():
        # Call your model provider here with AI_PROVIDER_KEY and stream its text. Treat the
        # model's output as untrusted text: the UI renders it as text (no HTML).
        answer = f"Here is what I found about **{question[:80]}**:\n- 3 critical threats are open\n- 2 are on internet-facing hosts"
        for word in answer.split(" "):
            yield word + " "
            await asyncio.sleep(0.02)

    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8")
