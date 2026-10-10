"use client";
// A calm data table: quick search (same keys as every search box), click-to-sort columns,
// pagination with page size, and "Download CSV" of exactly what's filtered and sorted.
//   ↑ / ↓ move the highlighted row · Enter opens it · Esc clears the search · / focuses search
//   PageUp / PageDown change page
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { DownloadIcon, ChevronLeft, ChevronRight, GearIcon, SortIcon } from "./icons";
import { Menu, Tooltip } from "./overlay";
import { SearchInput, matches, useSearchKeys, useSlashToFocus } from "./search";

export interface Column<T> {
  key: string;
  header: string;
  /** The raw value — used for search, sorting and the CSV. */
  value: (row: T) => string | number | Date | null | undefined;
  /** How the cell looks (defaults to the value). */
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
  sortable?: boolean;
  /** Narrow columns: e.g. "w-28". */
  className?: string;
}

type Dir = "asc" | "desc";

/** What a server-side table asks the backend for (see api.ts `listParams` and the FastAPI example). */
export interface TableQuery { page: number; size: number; sort?: string; order?: Dir; q?: string }

/** Server mode: the backend searches, sorts and pages; `rows` is just the current page. */
export interface ServerTable {
  total: number;
  loading?: boolean;
  error?: string | null;
  /** Called (search debounced 250 ms) whenever page, size, sort or search change — fetch that page. */
  onQuery: (q: TableQuery) => void;
  /** Download every matching row (e.g. a CSV endpoint). Without it, CSV saves the current page. */
  onDownload?: () => void;
}

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;   // empty values last, whatever the direction
  if (b == null) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const cell = (v: unknown) => {
    let s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
    // Formula injection: a text cell starting with = + - @ (or tab / CR) would run as a formula in
    // Excel / Sheets. Prefix it with ' so it stays text. Real numbers (-5, 3.2) are left alone.
    if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => cell(c.header)).join(","), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(","))].join("\r\n");
}

/** "app  +50" — the first values, then a count of the rest (full list on hover). */
export function Chips({ items, max = 2, render = (s) => s }: { items: string[]; max?: number; render?: (s: string) => ReactNode }) {
  const rest = items.length - max;
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      {items.slice(0, max).map((it) => <span key={it} className="truncate">{render(it)}</span>)}
      {rest > 0 && <Tooltip content={items.slice(max).join(", ")}><span tabIndex={0} className="shrink-0 rounded-md bg-surface-2 px-1.5 text-xs tabular-nums text-text-3">+{rest}</span></Tooltip>}
    </span>
  );
}

export function DataTable<T>({
  rows, columns, getKey, onRowOpen, title, filename = "table", pageSizes = [10, 25, 50, 100], emptyHint,
  selectable = false, bulkActions, expandable, rowHint, tableId, hideSearch = false, toolbarEnd, server, onExport, onRowContextMenu,
}: {
  rows: T[];
  columns: Column<T>[];
  getKey: (row: T) => string | number;
  onRowOpen?: (row: T) => void;
  title?: string;
  filename?: string;
  pageSizes?: number[];
  emptyHint?: string;
  /** Checkbox per row + "select all on this page"; `bulkActions` renders for the selection. */
  selectable?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  /** Rows that open in place (grouped events, children, details): return null when a row has none. */
  expandable?: (row: T) => ReactNode | null;
  /** Hover / focus detail for a row (shown on its first column). */
  rowHint?: (row: T) => ReactNode;
  /** Set to remember hidden columns (⚙ column picker appears for 5+ columns). */
  tableId?: string;
  /** When a FilterBar above already searches. */
  hideSearch?: boolean;
  toolbarEnd?: ReactNode;
  /** Large data: let the backend search / sort / page (see ServerTable). */
  server?: ServerTable;
  /** Save the CSV yourself — desktop apps use the native Save dialog here. Default: browser download. */
  onExport?: (csv: string, filename: string) => void;
  /** Right-click on a row (desktop apps: show a context Menu). */
  onRowContextMenu?: (row: T, event: ReactMouseEvent) => void;
}) {
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  useEffect(() => {
    if (!tableId) return;
    try { setHiddenCols(JSON.parse(localStorage.getItem(`table-cols-${tableId}`) || "[]")); } catch { /* none */ }
  }, [tableId]);
  const toggleCol = (key: string) => setHiddenCols((h) => {
    const next = h.includes(key) ? h.filter((k) => k !== key) : h.length < columns.length - 1 ? [...h, key] : h;
    if (tableId) try { localStorage.setItem(`table-cols-${tableId}`, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });
  const cols = columns.filter((c) => !hiddenCols.includes(c.key));
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const toggleExpand = (k: string | number) => setExpanded((e) => { const n = new Set(e); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: Dir } | null>(null);
  const [pageSize, setPageSize] = useState(pageSizes[0]);
  const [page, setPage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useSlashToFocus(inputRef);

  const filtered = useMemo(() => {
    if (server) return rows; // the backend already searched and sorted
    const q = query.trim();
    const out = q ? rows.filter((r) => matches(columns.map((c) => String(c.value(r) ?? "")).join(" "), q)) : rows.slice();
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col && sort) out.sort((a, b) => { const r = cmp(col.value(a), col.value(b)); return sort.dir === "asc" ? r : -r; });
    return out;
  }, [rows, columns, query, sort, server]);

  const count = server ? server.total : filtered.length;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  useEffect(() => setPage(0), [query, sort, pageSize]);
  const shown = server ? rows : filtered.slice(page * pageSize, page * pageSize + pageSize);

  // Server mode: ask for the page the user is looking at (typing is debounced).
  const onQueryRef = useRef(server?.onQuery);
  onQueryRef.current = server?.onQuery;
  const serverMode = Boolean(server);
  useEffect(() => {
    if (!serverMode) return;
    const t = setTimeout(() => onQueryRef.current?.({ page, size: pageSize, sort: sort?.key, order: sort?.dir, q: query.trim() || undefined }), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [serverMode, page, pageSize, sort, query]);
  const clear = useCallback(() => setQuery(""), []);
  const keys = useSearchKeys({ results: shown, onOpen: (r) => onRowOpen?.(r), onClear: clear, query });
  const pageKeys = shown.map(getKey);
  const allOnPage = pageKeys.length > 0 && pageKeys.every((k) => selected.has(k));
  const selectedRows = rows.filter((r) => selected.has(getKey(r)));
  const clearSelection = () => setSelected(new Set());
  const extraCols = (selectable ? 1 : 0) + (expandable ? 1 : 0);

  const toggleSort = (key: string) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  const download = () => {
    if (server?.onDownload) return server.onDownload();
    if (onExport) return onExport("\ufeff" + toCsv(filtered, cols), `${filename}.csv`); // BOM: Excel reads UTF-8
    const blob = new Blob(["﻿" + toCsv(filtered, cols)], { type: "text/csv;charset=utf-8" }); // BOM: Excel reads UTF-8
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${filename}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const from = count ? page * pageSize + 1 : 0;
  const to = Math.min(count, page * pageSize + shown.length);

  return (
    <section className="rounded-xl border border-border-subtle bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-3 p-4">
        {title && <h2 className="mr-auto text-base font-semibold text-text">{title}</h2>}
        {!title && <span className="mr-auto" />}
        {!hideSearch && <SearchInput value={query} onChange={setQuery} inputRef={inputRef} placeholder="Search rows"
          count={query ? count : undefined} listId={keys.listId} activeId={keys.activeId}
          onKeyDown={(e) => {
            if (e.key === "PageDown") { e.preventDefault(); setPage((p) => Math.min(pages - 1, p + 1)); }
            else if (e.key === "PageUp") { e.preventDefault(); setPage((p) => Math.max(0, p - 1)); }
            else keys.inputKeys(e);
          }}
          className="w-full sm:w-72" />}
        {toolbarEnd}
        {tableId && columns.length >= 5 && (
          <Menu label="Columns" keepOpen side="bottom-end" onSelect={toggleCol}
            items={columns.map((c) => ({ id: c.key, label: c.header, checked: !hiddenCols.includes(c.key) }))}
            trigger={(p) => <button {...p} type="button" title="Choose columns" aria-label="Choose columns" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-3 ring-1 ring-border hover:bg-surface-2 hover:text-text"><GearIcon /></button>} />
        )}
        <button type="button" onClick={download} disabled={!count}
          title={`Download ${server && !server.onDownload ? shown.length : count} row${count === 1 ? "" : "s"} as CSV`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-text-2 ring-1 ring-border hover:bg-surface-2 hover:text-text disabled:opacity-40">
          <DownloadIcon /> CSV
        </button>
      </div>

      {selectable && selected.size > 0 && (
        <div className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-text">
          <b className="font-medium">{selected.size} selected</b>
          {bulkActions?.(selectedRows, clearSelection)}
          <button type="button" onClick={clearSelection} className="ml-auto text-text-2 hover:text-text">Clear</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-border-subtle">
              {selectable && (
                <th className="w-10 px-4 py-2.5">
                  <input type="checkbox" checked={allOnPage} aria-label="Select all rows on this page" className="accent-[var(--accent)]"
                    onChange={() => setSelected((s) => { const n = new Set(s); pageKeys.forEach((k) => (allOnPage ? n.delete(k) : n.add(k))); return n; })} />
                </th>
              )}
              {expandable && <th className="w-8" aria-label="Expand" />}
              {cols.map((c) => {
                const dir = sort?.key === c.key ? sort.dir : null;
                const sortable = c.sortable !== false;
                return (
                  <th key={c.key} scope="col"
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                    className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-3 ${c.align === "right" ? "text-right" : "text-left"} ${c.className ?? ""}`}>
                    {sortable ? (
                      <button type="button" onClick={() => toggleSort(c.key)}
                        className={`inline-flex items-center gap-1 rounded uppercase tracking-wider hover:text-text ${dir ? "text-text" : ""} ${c.align === "right" ? "flex-row-reverse" : ""}`}>
                        {c.header} <SortIcon dir={dir} />
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody {...keys.listProps} aria-busy={server?.loading || undefined} className={`outline-none transition-opacity duration-fast ${server?.loading ? "opacity-60" : ""}`}>
            {server?.error ? (
              <tr>
                <td colSpan={cols.length + extraCols} className="px-4 py-10 text-center text-sm text-text-2">
                  {server.error} <button type="button" onClick={() => server.onQuery({ page, size: pageSize, sort: sort?.key, order: sort?.dir, q: query.trim() || undefined })} className="ml-2 text-accent-text hover:underline">Try again</button>
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={cols.length + extraCols} className="px-4 py-10 text-center text-sm text-text-3">
                  {server?.loading ? "Loading…" : query ? <>No rows match “{query}”. {emptyHint ?? "Try fewer words, or clear the search (Esc)."}</> : "No rows yet."}
                </td>
              </tr>
            ) : (
              shown.map((r, i) => {
                const { ref, ...opt } = keys.optionProps(i);
                const k = getKey(r);
                const detail = expandable?.(r) ?? null;
                const isOpen = expanded.has(k);
                const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
                return (
                  <Fragment key={k}>
                    <tr ref={ref} {...opt} onContextMenu={onRowContextMenu ? (e) => { e.preventDefault(); onRowContextMenu(r, e); } : undefined}
                      onKeyDown={(e) => { if (detail && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { e.preventDefault(); if ((e.key === "ArrowRight") !== isOpen) toggleExpand(k); } }}
                      className={`border-b border-border-subtle last:border-0 ${onRowOpen ? "cursor-pointer" : ""} ${i === keys.active ? "bg-accent-soft" : selected.has(k) ? "bg-surface-2" : "hover:bg-surface-2"}`}>
                      {selectable && (
                        <td className="w-10 px-4" onClick={stop}>
                          <input type="checkbox" checked={selected.has(k)} aria-label="Select row" className="accent-[var(--accent)]"
                            onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })} />
                        </td>
                      )}
                      {expandable && (
                        <td className="w-8 pl-2" onClick={stop}>
                          {detail && (
                            <button type="button" onClick={() => toggleExpand(k)} aria-expanded={isOpen} aria-label={isOpen ? "Collapse row (←)" : "Expand row (→)"}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-3 hover:bg-surface-2 hover:text-text">
                              <ChevronRight width={14} height={14} className={`transition-transform duration-fast ${isOpen ? "rotate-90" : ""}`} />
                            </button>
                          )}
                        </td>
                      )}
                      {cols.map((c, ci) => {
                        const content = c.render ? c.render(r) : String(c.value(r) ?? "—");
                        return (
                          <td key={c.key} className={`px-4 py-2.5 text-text ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className ?? ""}`}>
                            {ci === 0 && rowHint ? <Tooltip content={rowHint(r)} wide side="bottom-start"><span className="truncate">{content}</span></Tooltip> : content}
                          </td>
                        );
                      })}
                    </tr>
                    {detail && isOpen && (
                      <tr className="border-b border-border-subtle bg-sunken/50">
                        <td colSpan={cols.length + extraCols} className="px-4 py-3 pl-14">{detail}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-text-3">
        <span className="tabular-nums">{from}–{to} of {count}{!server && query && rows.length !== filtered.length ? ` (from ${rows.length})` : ""}</span>
        <label className="ml-auto inline-flex items-center gap-1.5">
          Rows
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-sunken px-1.5 text-text">
            {pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className="inline-flex items-center gap-1">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            aria-label="Previous page (PageUp)" className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-2 hover:text-text disabled:opacity-30">
            <ChevronLeft />
          </button>
          <span className="min-w-[4.5rem] text-center tabular-nums">Page {page + 1} / {pages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}
            aria-label="Next page (PageDown)" className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-2 hover:text-text disabled:opacity-30">
            <ChevronRight />
          </button>
        </span>
      </div>
    </section>
  );
}
