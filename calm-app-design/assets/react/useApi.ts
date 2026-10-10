"use client";
// React glue for api.ts — loading / error / reload without a data library.
//
//   const { data, error, loading, reload } = useResource((signal) => api.get<Stats>("/api/stats", { signal }), []);
//
//   const t = useServerTable<Threat>(api, "/api/threats", { filters, range });
//   <DataTable rows={t.rows} server={t.server} … />          ← backend searches, sorts and pages
//
//   const [status, setStatus] = useState("…");
//   useLiveEvents(api, "/api/graph/events", (e) => apply(JSON.parse(e.data)), setStatus);
import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { ApiError, downloadFrom, listParams, type Api, type SseEvent } from "./api";
import type { Filter, TimeRange } from "./FilterBar";
import type { ServerTable, TableQuery } from "./DataTable";

/** Loads on mount and when `deps` change; cancels the old request when they change or on unmount. */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<{ data?: T; error?: ApiError; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: undefined }));
    loadRef.current(ctrl.signal).then(
      (data) => { if (!ctrl.signal.aborted) setState({ data, loading: false }); },
      (e: unknown) => {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ ...s, loading: false, error: e instanceof ApiError ? e : new ApiError("Something went wrong.", 0) }));
      },
    );
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: useCallback(() => setTick((t) => t + 1), []) };
}

/** The response a list endpoint returns (see the FastAPI example's `Page[T]`). */
export interface PageOf<T> { items: T[]; total: number }

/** A server-side DataTable: fetches the page the user is looking at, re-fetches when filters change,
 *  ignores out-of-order answers and can download every matching row from `${path}.csv`. */
export function useServerTable<T>(api: Api, path: string, opts: { filters?: Filter[]; range?: TimeRange; csv?: boolean | string } = {}) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const last = useRef<TableQuery>({ page: 0, size: 10 });
  const ctrl = useRef<AbortController | null>(null);
  const filtersKey = JSON.stringify(opts.filters ?? []);

  const fetchPage = useCallback((q: TableQuery) => {
    last.current = q;
    ctrl.current?.abort(); // only the newest request may update the table
    const c = (ctrl.current = new AbortController());
    setLoading(true);
    api.get<PageOf<T>>(path, { query: listParams(q, JSON.parse(filtersKey) as Filter[], opts.range), signal: c.signal }).then(
      (p) => { if (c.signal.aborted) return; setRows(p.items); setTotal(p.total); setError(null); setLoading(false); },
      (e: unknown) => { if (c.signal.aborted) return; setError(e instanceof ApiError ? e.message : "Couldn't load rows."); setLoading(false); },
    );
  }, [api, path, filtersKey, opts.range]);

  // Filters or time range changed → back to the first page.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    fetchPage({ ...last.current, page: 0 });
  }, [fetchPage]);
  useEffect(() => () => ctrl.current?.abort(), []);

  const csvPath = typeof opts.csv === "string" ? opts.csv : `${path}.csv`;
  const server: ServerTable = {
    total, loading, error, onQuery: fetchPage,
    onDownload: opts.csv ? () => { void downloadFrom(api, csvPath, `${path.split("/").pop() || "export"}.csv`, listParams({ ...last.current, page: 0, size: 0 }, JSON.parse(filtersKey) as Filter[], opts.range)); } : undefined,
  };
  return { rows, server, reload: () => fetchPage(last.current) };
}

/** Subscribe to Server-Sent Events while mounted (reconnects by itself). */
export function useLiveEvents(api: Api, path: string | null, onEvent: (e: SseEvent) => void, onStatus?: (s: "live" | "reconnecting" | "stopped") => void) {
  const h = useRef({ onEvent, onStatus });
  h.current = { onEvent, onStatus };
  useEffect(() => {
    if (!path) return;
    return api.subscribe(path, { onEvent: (e) => h.current.onEvent(e), onStatus: (s) => h.current.onStatus?.(s) });
  }, [api, path]);
}
