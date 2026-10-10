"use client";
// Filter bar — deep filtering that stays calm: the few filters that matter are chips that read
// like a sentence ("Status equals Open or In Progress"); everything else is one click away
// under "+ More". A chip opens a searchable multi-select (type · ↑↓ · Enter toggles · Esc closes)
// with an equals / not-equals switch. Time range presets, Reset, result count, view controls.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Layer, Menu, useAnchoredPosition, useDismiss } from "./overlay";
import { Highlight, SearchInput, matches, useSearchKeys, useSlashToFocus } from "./search";
import { ChevronDown, PlusIcon, XIcon } from "./icons";

export interface FilterOption { value: string; label: string; count?: number; icon?: ReactNode }
export interface FilterField { id: string; label: string; options: FilterOption[]; icon?: ReactNode }
export interface Filter { field: string; not?: boolean; values: string[] }

export const TIME_RANGES = [
  { id: "24h", label: "Past 24 hours", short: "24h" },
  { id: "7d", label: "Past 7 days", short: "7d" },
  { id: "30d", label: "Past 30 days", short: "30d" },
  { id: "90d", label: "Past 90 days", short: "90d" },
  { id: "12m", label: "Past 12 months", short: "12m" },
] as const;
export type TimeRange = (typeof TIME_RANGES)[number]["id"];

/** "Open or In Progress" — the chip's sentence. */
function describe(field: FilterField, f: Filter): ReactNode {
  const labels = f.values.map((v) => field.options.find((o) => o.value === v)?.label ?? v);
  if (!labels.length) return <span className="text-text-3">{field.label}</span>;
  const shown = labels.length > 2 ? [labels[0], `${labels.length - 1} more`] : labels;
  return (
    <>
      <span className="text-text-2">{field.label} {f.not ? "is not" : "equals"} </span>
      {shown.map((l, i) => (
        <span key={i}>{i > 0 && <span className="text-text-2"> or </span>}<b className="font-semibold text-accent-text">{l}</b></span>
      ))}
    </>
  );
}

function ValuePicker({ field, filter, anchor, onChange, onClose, onRemove }: {
  field: FilterField; filter: Filter; anchor: RefObject<HTMLElement>;
  onChange: (f: Filter) => void; onClose: () => void; onRemove: () => void;
}) {
  const [query, setQuery] = useState("");
  const layer = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pos = useAnchoredPosition(anchor, layer, true, "bottom-start");
  useDismiss(true, onClose, [anchor, layer]);
  useEffect(() => { requestAnimationFrame(() => inputRef.current?.focus()); }, []);
  const results = useMemo(() => field.options.filter((o) => matches(o.label, query)), [field, query]);
  const toggle = (o: FilterOption) =>
    onChange({ ...filter, values: filter.values.includes(o.value) ? filter.values.filter((v) => v !== o.value) : [...filter.values, o.value] });
  const keys = useSearchKeys({ results, onOpen: toggle, onClear: () => setQuery(""), query });
  return (
    <Layer>
      <div ref={layer} className="fixed z-50 w-72 rounded-xl border border-border bg-surface-2 p-2 shadow-calm"
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
        onKeyDown={(e) => { if (e.key === "Escape" && !query) { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-3">{field.label}</span>
          <span className="ml-auto inline-flex rounded-md bg-surface p-0.5 text-xs">
            {[false, true].map((not) => (
              <button key={String(not)} type="button" onClick={() => onChange({ ...filter, not })}
                className={`rounded px-2 py-0.5 ${Boolean(filter.not) === not ? "bg-accent-soft text-text" : "text-text-3 hover:text-text"}`}>
                {not ? "is not" : "equals"}
              </button>
            ))}
          </span>
        </div>
        <SearchInput value={query} onChange={setQuery} inputRef={inputRef} placeholder={`Find ${field.label.toLowerCase()}`}
          onKeyDown={keys.inputKeys} listId={keys.listId} activeId={keys.activeId} />
        <div {...keys.listProps} role="listbox" aria-multiselectable="true" className="mt-1 max-h-64 overflow-y-auto outline-none">
          {results.length === 0 && <p className="px-2 py-4 text-center text-sm text-text-3">No {field.label.toLowerCase()} matches “{query}”.</p>}
          {results.map((o, i) => {
            const on = filter.values.includes(o.value);
            return (
              <div key={o.value} {...keys.optionProps(i)} aria-selected={on}
                className={`flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm ${i === keys.active ? "bg-surface text-text" : "text-text-2"}`}>
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${on ? "border-accent bg-accent text-accent-on" : "border-border-strong"}`}>{on ? "✓" : ""}</span>
                {o.icon}
                <span className="min-w-0 flex-1 truncate"><Highlight text={o.label} query={query} /></span>
                {o.count != null && <span className="text-xs tabular-nums text-text-3">{o.count}</span>}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex items-center border-t border-border-subtle px-1 pt-2 text-xs">
          <button type="button" onClick={() => onChange({ ...filter, values: [] })} className="text-text-3 hover:text-text">Clear</button>
          <button type="button" onClick={onRemove} className="ml-auto text-danger hover:underline">Remove filter</button>
        </div>
      </div>
    </Layer>
  );
}

function Chip({ field, filter, onChange, onRemove, startOpen }: {
  field: FilterField; filter: Filter; onChange: (f: Filter) => void; onRemove: () => void; startOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(startOpen));
  const ref = useRef<HTMLButtonElement>(null);
  const active = filter.values.length > 0;
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <span className={`inline-flex h-8 items-center rounded-lg text-sm ring-1 transition-colors duration-fast ${active ? "bg-accent-soft ring-accent-text/40" : "ring-border hover:ring-border-strong"}`}>
        <button ref={ref} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="inline-flex h-full items-center gap-1 whitespace-nowrap pl-2.5 pr-1.5">
          {describe(field, filter)}
          <ChevronDown width={14} height={14} className="text-text-3" />
        </button>
        {active && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${field.label} filter`} className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-text-3 hover:text-text">
            <XIcon width={12} height={12} />
          </button>
        )}
      </span>
      {open && <ValuePicker field={field} filter={filter} anchor={ref} onChange={onChange} onClose={close} onRemove={() => { close(); onRemove(); }} />}
    </>
  );
}

export function FilterBar({
  fields, filters, onChange, primary, search, onSearch, range, onRange, resultLabel, end,
}: {
  fields: FilterField[];
  filters: Filter[];
  onChange: (next: Filter[]) => void;
  /** Field ids always shown as chips (the 2–4 that matter most). The rest live under "+ More". */
  primary: string[];
  search?: string;
  onSearch?: (q: string) => void;
  range?: TimeRange;
  onRange?: (r: TimeRange) => void;
  /** "1 threat", "248 issues". */
  resultLabel?: string;
  /** Right side: view toggle, Save view…, refresh. */
  end?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useSlashToFocus(inputRef, Boolean(onSearch));
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const shownIds = Array.from(new Set([...primary, ...filters.map((f) => f.field)]));
  const get = (id: string) => filters.find((f) => f.field === id) ?? { field: id, values: [] };
  const set = (f: Filter) => onChange([...filters.filter((x) => x.field !== f.field), f]);
  const remove = (id: string) => onChange(filters.filter((x) => x.field !== id));
  const extra = fields.filter((f) => !shownIds.includes(f.id));
  const anyActive = filters.some((f) => f.values.length) || Boolean(search);
  const r = TIME_RANGES.find((t) => t.id === range);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearch && (
        <SearchInput value={search ?? ""} onChange={onSearch} inputRef={inputRef} placeholder="Search"
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); if (search) onSearch(""); else e.currentTarget.blur(); } }}
          className="w-52" />
      )}
      {onRange && (
        <Menu label="Time range" items={TIME_RANGES.map((t) => ({ id: t.id, label: t.label, hint: t.short, checked: t.id === range }))}
          onSelect={(id) => onRange(id as TimeRange)}
          trigger={(p) => (
            <button {...p} type="button" className="inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm text-text ring-1 ring-border hover:ring-border-strong">
              <span className="rounded bg-accent-soft px-1.5 font-mono text-xs text-accent-text">{r?.short ?? "All"}</span>
              {r?.label ?? "Any time"}
              <ChevronDown width={14} height={14} className="text-text-3" />
            </button>
          )} />
      )}
      {shownIds.map((id) => {
        const field = fields.find((f) => f.id === id);
        return field ? <Chip key={id} field={field} filter={get(id)} onChange={set} onRemove={() => remove(id)} startOpen={justAdded === id} /> : null;
      })}
      {extra.length > 0 && (
        <Menu label="Add filter" items={extra.map((f) => ({ id: f.id, label: f.label, icon: f.icon }))}
          onSelect={(id) => { setJustAdded(id); onChange([...filters, { field: id, values: [] }]); }}
          trigger={(p) => (
            <button {...p} type="button" className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm text-text-2 ring-1 ring-border hover:text-text hover:ring-border-strong">
              <PlusIcon width={14} height={14} /> More
            </button>
          )} />
      )}
      {anyActive && (
        <button type="button" onClick={() => { onChange([]); onSearch?.(""); }} className="h-8 rounded-lg px-2 text-sm text-text-3 hover:text-text">Reset</button>
      )}
      <span className="ml-auto" />
      {resultLabel && <span className="text-sm tabular-nums text-text-3">{resultLabel}</span>}
      {end}
    </div>
  );
}

/** Applies filters + search to rows: `filterRows(rows, filters, (row, field) => row[field], search, rowText)`. */
export function filterRows<T>(rows: T[], filters: Filter[], valueOf: (row: T, field: string) => string, search = "", textOf?: (row: T) => string): T[] {
  return rows.filter((row) =>
    filters.every((f) => !f.values.length || (f.values.includes(valueOf(row, f.field)) !== Boolean(f.not))) &&
    (!search.trim() || matches(textOf ? textOf(row) : JSON.stringify(row), search)));
}

