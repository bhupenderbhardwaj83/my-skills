// Typed client for Python backends (FastAPI first; Flask, Django REST, Litestar work the same).
// No dependencies, no React — usable from components, hooks, workers and tests.
//
//   const api = createApi({ baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "" });
//   const me = await api.get<User>("/api/me");
//   await api.post("/api/threats/bulk-close", { ids });
//   for await (const chunk of api.stream("/api/assistant", { messages })) …   // StreamingResponse
//   const stop = api.subscribe("/api/graph/events", { onEvent: (e) => … });  // Server-Sent Events
//
// Errors are always an ApiError with a message a person can read. FastAPI's shapes are understood:
//   {"detail": "Not found"}                      → message "Not found"
//   {"detail": [{"loc": ["body","email"], …}]}   → fields { email: "…" }, message "Check the highlighted fields."
//
// Security defaults: paths must be relative ("/api/…") so tokens never go to another site; cookies
// only same-origin unless you opt in; a CSRF header is sent from the cookie when one exists;
// bearer tokens come from a callback (keep them in memory, never in localStorage).

import type { Filter, TimeRange } from "./FilterBar";
import type { TableQuery } from "./DataTable";
import type { AskFn } from "./AiAssistant";

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status; 0 = network error or timeout. */
    readonly status: number,
    /** Per-field messages from a 422 (key = field path, "address.city"). */
    readonly fields: Record<string, string> = {},
    /** The raw `detail`, for logging — never show it unfiltered. */
    readonly detail?: unknown,
  ) { super(message); this.name = "ApiError"; }
}

export interface ApiOptions {
  /** "" (same origin, e.g. behind a Next.js rewrite or the same host) or "https://api.example.com". */
  baseUrl?: string;
  /** "same-origin" (default) · "include" for a cookie session on another origin (needs CORS allow_credentials). */
  credentials?: RequestCredentials;
  /** Default 15 s. Streams have no overall timeout (they stop with their signal). */
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Bearer token for each request, e.g. from your auth provider's SDK (kept in memory). */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Double-submit CSRF for cookie sessions: copy this cookie into this header on writes. `false` to turn off. */
  csrf?: { cookie: string; header: string } | false;
  /** Called on 401 (e.g. send the user to sign in). */
  onUnauthorized?: () => void;
}

export type Query = Record<string, string | number | boolean | Date | null | undefined | (string | number)[]>;
interface Req { query?: Query; body?: unknown; signal?: AbortSignal; headers?: Record<string, string>; timeoutMs?: number }

export interface SseEvent { event: string; data: string; id?: string }

/** `?a=1&tag=x&tag=y` — arrays repeat the key (FastAPI `list[str] = Query()`); empty values are skipped. */
export function toQuery(q: Query = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
    else p.append(k, v instanceof Date ? v.toISOString() : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Query for a server-side list: page / size / sort / order / q / range / filters (JSON). */
export function listParams(t: TableQuery, filters: Filter[] = [], range?: TimeRange): Query {
  return {
    page: t.page, size: t.size, sort: t.sort, order: t.order, q: t.q, range,
    filters: filters.length ? JSON.stringify(filters.map(({ field, not, values }) => ({ field, not: Boolean(not), values }))) : undefined,
  };
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** FastAPI / Starlette / DRF error bodies → one readable message + per-field messages. */
async function toError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try { body = (res.headers.get("content-type") ?? "").includes("json") ? await res.json() : await res.text(); } catch { /* empty */ }
  const detail = body && typeof body === "object" && "detail" in body ? (body as { detail: unknown }).detail : body;
  const fields: Record<string, string> = {};
  if (Array.isArray(detail)) {
    for (const d of detail) {
      if (d && typeof d === "object" && "msg" in d) {
        const loc = Array.isArray((d as { loc?: unknown[] }).loc) ? (d as { loc: unknown[] }).loc : [];
        const key = loc.filter((x) => !["body", "query", "path", "header", "cookie"].includes(String(x))).join(".") || "_";
        fields[key] = String((d as { msg: unknown }).msg).replace(/^Value error, /, "");
      }
    }
  }
  const plain = typeof detail === "string" && detail.length < 300 ? detail : null;
  const fallback: Record<number, string> = {
    400: "The request wasn't accepted.", 401: "Please sign in again.", 403: "You don't have access to this.",
    404: "That item doesn't exist (any more).", 409: "Someone changed this meanwhile — reload and try again.",
    413: "That's too large to upload.", 422: "Check the highlighted fields.", 429: "Too many requests — wait a moment and try again.",
  };
  const message = Object.keys(fields).length ? fallback[422] : plain ?? fallback[res.status] ?? (res.status >= 500 ? "The server had a problem. Try again in a moment." : `Request failed (${res.status}).`);
  return new ApiError(message, res.status, fields, detail);
}

export function createApi(opts: ApiOptions = {}) {
  const { baseUrl = "", credentials = "same-origin", timeoutMs = 15_000, csrf = { cookie: "csrftoken", header: "X-CSRF-Token" } } = opts;

  function url(path: string, query?: Query) {
    // Relative paths only: a full URL here could send the user's token or cookies to another site.
    if (!path.startsWith("/") || path.startsWith("//")) throw new ApiError("Use a path that starts with /.", 0);
    return `${baseUrl.replace(/\/$/, "")}${path}${toQuery(query)}`;
  }

  /** Sends the request and hands the response to `use` while the timeout and the caller's signal
   *  still apply — so a stalled body times out and Stop closes a stream mid-way. */
  async function send<R>(method: string, path: string, r: Req, use: (res: Response) => Promise<R>, stream = false): Promise<R> {
    const headers: Record<string, string> = { Accept: stream ? "text/event-stream, text/plain, */*" : "application/json", ...opts.headers, ...r.headers };
    let body: BodyInit | undefined;
    if (r.body instanceof FormData || r.body instanceof Blob) body = r.body; // uploads: the browser sets the boundary
    else if (r.body !== undefined) { body = JSON.stringify(r.body); headers["Content-Type"] = "application/json"; }
    const token = await opts.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (csrf && method !== "GET" && method !== "HEAD") { const v = readCookie(csrf.cookie); if (v) headers[csrf.header] = v; }

    // Timeout and the caller's signal both abort the request.
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort(r.signal?.reason);
    r.signal?.addEventListener("abort", onAbort, { once: true });
    const limit = stream ? 0 : r.timeoutMs ?? timeoutMs;
    let timedOut = false;
    const timer = limit ? setTimeout(() => { timedOut = true; ctrl.abort(); }, limit) : undefined;
    try {
      const res = await fetch(url(path, r.query), { method, headers, body, credentials, signal: ctrl.signal });
      if (!res.ok) {
        if (res.status === 401) opts.onUnauthorized?.();
        throw await toError(res);
      }
      return await use(res);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (r.signal?.aborted) throw e; // the caller stopped it — let them see the AbortError
      throw new ApiError(timedOut ? "The server took too long to answer. Try again." : "Can't reach the server. Check your connection and that the service is running.", 0);
    } finally {
      clearTimeout(timer);
      r.signal?.removeEventListener("abort", onAbort);
    }
  }

  function json<T>(method: string, path: string, r: Req = {}): Promise<T> {
    return send(method, path, r, async (res) => {
      if (res.status === 204) return undefined as T;
      const type = res.headers.get("content-type") ?? "";
      return (await (type.includes("json") ? res.json() : res.text())) as T;
    });
  }

  /** Runs `each` for every chunk of a streamed body; ends when the body ends or the signal aborts. */
  function pump(method: string, path: string, r: Req, each: (text: string) => void | Promise<void>) {
    return send(method, path, r, async (res) => {
      if (!res.body) return;
      const reader = res.body.getReader(), dec = new TextDecoder();
      try {
        for (;;) { const { done, value } = await reader.read(); if (done) return; await each(dec.decode(value, { stream: true })); }
      } finally { reader.cancel().catch(() => {}); } // closes the connection if we stopped early
    }, true);
  }

  /** Turns push-style chunks into an async generator (so `for await` and AiAssistant can use it). */
  async function* chunks<T>(start: (push: (v: T) => void, signal: AbortSignal) => Promise<void>, signal?: AbortSignal): AsyncGenerator<T> {
    const ctrl = new AbortController();
    const stop = () => ctrl.abort(signal?.reason);
    signal?.addEventListener("abort", stop, { once: true });
    const queue: T[] = [];
    let wake: (() => void) | null = null, finished = false, failure: unknown = null;
    const push = (v: T) => { queue.push(v); wake?.(); };
    start(push, ctrl.signal).then(() => { finished = true; wake?.(); }, (e) => { failure = e; finished = true; wake?.(); });
    try {
      for (;;) {
        if (queue.length) { yield queue.shift() as T; continue; }
        if (finished) { if (failure) throw failure; return; }
        await new Promise<void>((res) => (wake = res));
        wake = null;
      }
    } finally {
      // The consumer stopped (break / return / Stop): abort the request so the connection closes.
      if (!finished) ctrl.abort();
      signal?.removeEventListener("abort", stop);
    }
  }

  /** Text chunks as they arrive (FastAPI `StreamingResponse(gen(), media_type="text/plain")`). */
  function stream(path: string, body?: unknown, signal?: AbortSignal): AsyncGenerator<string> {
    return chunks<string>((push, sig) => pump(body === undefined ? "GET" : "POST", path, { body, signal: sig }, push), signal);
  }

  /** Server-Sent Events over fetch (so auth headers work), parsed per the spec. */
  function events(path: string, r: { query?: Query; body?: unknown; signal?: AbortSignal; lastEventId?: string } = {}): AsyncGenerator<SseEvent> {
    const headers = r.lastEventId ? { "Last-Event-ID": r.lastEventId } : undefined;
    return chunks<SseEvent>((push, sig) => {
      let buf = "", ev: SseEvent = { event: "message", data: "" }, hasData = false;
      return pump(r.body === undefined ? "GET" : "POST", path, { query: r.query, body: r.body, signal: sig, headers }, (text) => {
        buf += text;
        let nl: number;
        while ((nl = buf.search(/\r\n|\r|\n/)) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + (buf.startsWith("\r\n", nl) ? 2 : 1));
          if (line === "") { if (hasData) push({ ...ev, data: ev.data.replace(/\n$/, "") }); ev = { event: "message", data: "", id: ev.id }; hasData = false; continue; }
          if (line.startsWith(":")) continue; // comment / keep-alive
          const i = line.indexOf(":");
          const field = i < 0 ? line : line.slice(0, i);
          const val = i < 0 ? "" : line.slice(i + 1).replace(/^ /, "");
          if (field === "data") { ev.data += `${val}\n`; hasData = true; }
          else if (field === "event") ev.event = val || "message";
          else if (field === "id") ev.id = val;
        }
      });
    }, r.signal);
  }

  /** Live updates that survive network blips: reconnects with back-off (1 s → 30 s) and resumes
   *  from the last event id. Returns stop(). `onStatus` drives a "Live / Reconnecting…" badge. */
  function subscribe(path: string, h: { onEvent: (e: SseEvent) => void; onStatus?: (s: "live" | "reconnecting" | "stopped") => void; query?: Query }) {
    const ctrl = new AbortController();
    let lastId: string | undefined, delay = 1000;
    (async () => {
      while (!ctrl.signal.aborted) {
        try {
          let first = true;
          for await (const e of events(path, { query: h.query, signal: ctrl.signal, lastEventId: lastId })) {
            if (first) { h.onStatus?.("live"); delay = 1000; first = false; }
            if (e.id) lastId = e.id;
            h.onEvent(e);
          }
        } catch (e) {
          if (ctrl.signal.aborted) break;
          if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.status === 404)) { h.onStatus?.("stopped"); return; }
        }
        if (ctrl.signal.aborted) break;
        h.onStatus?.("reconnecting");
        await new Promise((r) => setTimeout(r, delay + Math.random() * 300));
        delay = Math.min(delay * 2, 30_000);
      }
      h.onStatus?.("stopped");
    })();
    return () => ctrl.abort();
  }

  /** An `onAsk` for <AiAssistant> backed by a streaming endpoint that takes `{ messages }`. */
  const assistant = (path = "/api/assistant"): AskFn => (messages, signal) =>
    stream(path, { messages: messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content })) }, signal);

  return {
    get: <T>(path: string, r?: Omit<Req, "body">) => json<T>("GET", path, r),
    post: <T>(path: string, body?: unknown, r?: Req) => json<T>("POST", path, { ...r, body }),
    put: <T>(path: string, body?: unknown, r?: Req) => json<T>("PUT", path, { ...r, body }),
    patch: <T>(path: string, body?: unknown, r?: Req) => json<T>("PATCH", path, { ...r, body }),
    del: <T = void>(path: string, r?: Req) => json<T>("DELETE", path, r),
    /** A Response for files (CSV, images) — use `downloadFrom` for a save dialog. */
    raw: (path: string, r?: Req) => send("GET", path, r ?? {}, async (res) => new Response(await res.blob(), { status: res.status, headers: res.headers })),
    stream, events, subscribe, assistant, url,
  };
}

export type Api = ReturnType<typeof createApi>;

/** Save a file the server makes (e.g. a CSV of every matching row) without opening a new tab. */
export async function downloadFrom(api: Api, path: string, filename: string, query?: Query) {
  const res = await api.raw(path, { query, timeoutMs: 120_000 });
  const blob = await res.blob();
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename.replace(/[\\/:*?"<>|]/g, "_") });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
