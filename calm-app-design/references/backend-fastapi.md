# Connecting to a Python backend (FastAPI first)

The front end talks to Python through one small client, `assets/react/api.ts`, and three hooks in
`useApi.ts`. `assets/fastapi/app.py` is a matching, tested backend to copy from (28 tests in
`test_app.py`). Flask, Django REST and Litestar work too — the contract is plain JSON + HTTP.

## Contents
1. Wiring (same origin vs separate API)
2. The contract (lists, errors, streams, live events)
3. Front-end recipes
4. Backend recipe
5. Plain HTML / Tauri / Electron

## 1. Wiring

**Prefer one origin.** The browser then sends cookies without CORS, and CSRF is simpler.
- Next.js: `next.config.js` → `rewrites: async () => [{ source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" }]`, then `createApi()` with no `baseUrl`.
- Vite: `server.proxy: { "/api": "http://127.0.0.1:8000" }`.
- Production: one reverse proxy (Caddy / nginx) serves the site and `/api`.

**Separate API origin**: `createApi({ baseUrl: process.env.NEXT_PUBLIC_API_URL, credentials: "include" })`
and on the server `ALLOWED_ORIGINS=https://app.example.com` (exact origins; the example refuses `*`).

```ts
// src/lib/api.ts — one instance for the whole app
import { createApi } from "@/components/calm";
export const api = createApi({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
  onUnauthorized: () => { window.location.href = "/login"; },
});
```
Cookie sessions: call `GET /api/session` once at start-up so the CSRF cookie exists; `api.ts`
copies it into `X-CSRF-Token` on every write. Bearer tokens: `getToken: () => auth.token` (memory).

## 2. The contract

| Need | Request | Response |
|---|---|---|
| Server-side table | `GET /api/things?page=0&size=25&sort=created&order=desc&q=word&range=30d&filters=[{"field":"status","not":false,"values":["open"]}]` | `{ "items": [...], "total": 240 }` (`Page[T]`) |
| Export all matches | same query + `size=0` to `GET /api/things.csv` | `text/csv`, formula-safe cells |
| Bulk action | `POST /api/things/bulk-close` `{ "ids": [...] }` | `{ "closed": 12 }` |
| Validation error | — | 422 `{ "detail": [{ "loc": ["body","email"], "msg": "…" }] }` → `ApiError.fields.email` |
| Other error | — | `{ "detail": "Plain sentence for the user" }` → `ApiError.message` |
| AI answer | `POST /api/assistant` `{ "messages": [{role, content}] }` | `StreamingResponse`, `text/plain`; 503 when not set up |
| Live updates | `GET /api/x/events` (+ `Last-Event-ID`) | `text/event-stream`: `id:`, `event:`, `data: <json>` |
| Graph | `GET /api/graph` | `{ nodes: [{id,label,sublabel,tone,badge}], edges: [{from,to,label,active}] }` |

Write `detail` strings for people ("That name is taken — try another."); the UI shows them as-is.
`api.ts` already turns 401/403/404/409/413/429/5xx, timeouts and "server not running" into calm
sentences, so components only show `error.message` (and `error.fields` next to inputs).

## 3. Front-end recipes

```tsx
// Server-side table with FilterBar — backend searches, sorts, pages; CSV downloads every match
const [filters, setFilters] = useState<Filter[]>([]);
const [range, setRange] = useState<TimeRange>("30d");
const t = useServerTable<Threat>(api, "/api/threats", { filters, range, csv: true });
<FilterBar fields={fields} primary={["severity", "status"]} filters={filters} onChange={setFilters} range={range} onRange={setRange} resultLabel={`${t.server.total} threats`} />
<DataTable rows={t.rows} server={t.server} columns={columns} getKey={(r) => r.id} />

// One resource with loading / error / retry
const { data, error, loading, reload } = useResource((signal) => api.get<Stats>("/api/stats", { signal }), []);
if (error) return <EmptyState title="Couldn't load stats" hint={error.message} action={{ label: "Try again", onClick: reload }} />;

// Forms: show 422 messages under the fields
try { await api.post("/api/users", form); } catch (e) { if (e instanceof ApiError) setFieldErrors(e.fields); }

// AI assistant — streams; Stop cancels the request; 503 → show the "not set up" state
<AiAssistant onAsk={api.assistant("/api/assistant")} available={aiReady} />

// Live graph / workflow — reconnects with back-off; show the status next to the Live control
const [status, setStatus] = useState<"live" | "reconnecting" | "stopped">("stopped");
useLiveEvents(api, live ? "/api/graph/events" : null, (e) => setActive(JSON.parse(e.data).active), setStatus);
```
Client-side tables are fine up to a few thousand rows (`DataTable rows={all}`); beyond that, or
when rows are private per user, use server mode.

## 4. Backend recipe (see `assets/fastapi/app.py`)

- **Pydantic for every input**, with limits: `Query(ge=, le=, max_length=)`, `Field(max_length=)`,
  `model_config = ConfigDict(extra="forbid")`. `sort` and filter `field` are `Literal[...]`
  allow-lists — that is what keeps user text out of SQL.
- **SQL**: SQLAlchemy `select(Model).where(Model.status.in_(values)).order_by(getattr(Model, sort))`
  only after `sort` passed the allow-list; never f-strings. Count with the same WHERE for `total`.
- **Streaming**: `StreamingResponse(gen(), media_type="text/plain")` for AI;
  `media_type="text/event-stream"` + `X-Accel-Buffering: no` for SSE; stop when
  `await request.is_disconnected()`; send `: keep-alive` comments under proxies with idle timeouts.
- **Errors**: one handler returns `{"detail": "…(ref abc123)"}` for 500s and logs the traceback;
  the 422 handler returns `loc` + `msg` only (no echo of submitted values).
- **Long work** (exports, AI batches, media): return `202 {"job_id"}` and let the UI poll
  `GET /api/jobs/{id}` or listen on SSE for progress — the UI never waits on one long request.
- Test with `fastapi.testclient.TestClient` (see `test_app.py`): pagination, sort/filter
  allow-lists, 422 shape, CSRF, CORS, headers, rate limit.

## 5. Plain HTML / Tauri / Electron

- Plain HTML: `fetch` with the same contract; render rows with `textContent`, then
  `box.calm.refresh()`. For SSE without auth headers `new EventSource("/api/x/events")` is enough.
- Tauri / Electron with a Python sidecar on `127.0.0.1:<port>`: bind to 127.0.0.1 only (never
  0.0.0.0), add the app's origin (`tauri://localhost`, `http://tauri.localhost`) to
  `ALLOWED_ORIGINS`, and require a per-launch random token header so other local programs and web
  pages can't call it.
