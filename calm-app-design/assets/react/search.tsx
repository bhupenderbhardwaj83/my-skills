"use client";
// Every search box behaves the same way:
//   /        focus the search from anywhere (not while typing in another field)
//   type     filters instantly; every word must match, in any order
//   ↑ / ↓    move the highlight through the results (wraps)
//   Enter    open the highlighted result (the first one if none is highlighted)
//   Space    types a space while the cursor is in the box; once focus is in the result list
//            (Tab from the box), Space opens the highlighted result like Enter
//   Esc      clears the text; Esc on an empty box leaves it
import {
  useCallback, useEffect, useId, useMemo, useRef, useState,
  type KeyboardEvent, type ReactNode, type RefObject,
} from "react";
import { SearchIcon, XIcon } from "./icons";

/** True when every word of *query* appears in *text* (case- and accent-insensitive). */
export function matches(text: string, query: string): boolean {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const hay = norm(text);
  return norm(query).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

// One "/" listener for the whole page. With several search boxes, "/" goes to the first one
// visible on screen (reading order) — the search the user is looking at.
const slashTargets = new Set<RefObject<HTMLInputElement>>();
let slashListening = false;

function onSlash(e: globalThis.KeyboardEvent) {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  const inputs = [...slashTargets].map((r) => r.current).filter((el): el is HTMLInputElement => Boolean(el && !el.disabled));
  if (!inputs.length) return;
  inputs.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const onScreen = inputs.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
  });
  const target = onScreen ?? inputs[0];
  e.preventDefault();
  target.focus();
  target.select();
}

/** Let "/" focus this search box (outside editable fields). */
export function useSlashToFocus(ref: RefObject<HTMLInputElement>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    slashTargets.add(ref);
    if (!slashListening) {
      window.addEventListener("keydown", onSlash);
      slashListening = true;
    }
    return () => {
      slashTargets.delete(ref);
      if (!slashTargets.size) {
        window.removeEventListener("keydown", onSlash);
        slashListening = false;
      }
    };
  }, [ref, enabled]);
}

/** The sleek search field: icon, "/" hint while empty, clear ×, result count. */
export function SearchInput({
  value, onChange, onKeyDown, inputRef, placeholder = "Search", count, listId, activeId, className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  inputRef: RefObject<HTMLInputElement>;
  placeholder?: string;
  /** Results shown — read out to screen readers and shown while searching. */
  count?: number;
  listId?: string;
  activeId?: string;
  className?: string;
}) {
  return (
    <div className={`group relative flex h-9 items-center rounded-lg border border-border bg-sunken transition-colors duration-fast focus-within:border-accent-text/60 focus-within:ring-2 focus-within:ring-accent-soft ${className}`}>
      <SearchIcon className="pointer-events-none ml-3 shrink-0 text-text-3" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={Boolean(listId)}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        spellCheck={false}
        className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-text outline-none placeholder:text-text-3"
      />
      {value ? (
        <>
          {count !== undefined && <span className="mr-1 text-xs tabular-nums text-text-3" aria-live="polite">{count} found</span>}
          <button type="button" onClick={() => { onChange(""); inputRef.current?.focus(); }}
            aria-label="Clear search (Esc)" title="Clear (Esc)"
            className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-text-3 hover:bg-surface-2 hover:text-text">
            <XIcon width={14} height={14} />
          </button>
        </>
      ) : (
        <kbd className="mr-2.5 rounded border border-border px-1.5 font-mono text-xs text-text-3 group-focus-within:hidden">/</kbd>
      )}
    </div>
  );
}

/**
 * Keyboard state for a search box + result list. Spread `inputKeys` on the input and
 * `listProps` / `optionProps(i)` on the list; call `open` from clicks.
 */
export function useSearchKeys<T>({ results, onOpen, onClear, query }: {
  results: T[];
  onOpen: (item: T) => void;
  onClear: () => void;
  query: string;
}) {
  const [active, setActive] = useState(-1);
  const listId = useId();
  const optionRefs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => setActive(query ? 0 : -1), [query]); // typing highlights the best match
  useEffect(() => {
    if (active >= 0) optionRefs.current[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const move = (d: number) =>
    setActive((a) => (results.length ? (a < 0 ? (d > 0 ? 0 : results.length - 1) : (a + d + results.length) % results.length) : -1));
  const openActive = () => {
    const item = results[active >= 0 ? active : 0];
    if (item !== undefined) onOpen(item);
  };

  const handle = (e: KeyboardEvent<HTMLElement>, inList: boolean) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" || (inList && e.key === " ")) { e.preventDefault(); openActive(); }
    else if (inList && e.key === "Home") { e.preventDefault(); setActive(results.length ? 0 : -1); }
    else if (inList && e.key === "End") { e.preventDefault(); setActive(results.length - 1); }
    else if (e.key === "Escape") {
      e.preventDefault();
      if (query) onClear();
      else (e.currentTarget as HTMLElement).blur();
    }
  };

  return {
    active,
    setActive,
    listId,
    activeId: active >= 0 ? `${listId}-${active}` : undefined,
    inputKeys: (e: KeyboardEvent<HTMLInputElement>) => handle(e, false),
    listProps: { id: listId, role: "listbox", tabIndex: 0, onKeyDown: (e: KeyboardEvent<HTMLElement>) => handle(e, true) },
    optionProps: (i: number) => ({
      id: `${listId}-${i}`,
      role: "option" as const,
      "aria-selected": i === active,
      ref: (el: HTMLElement | null) => { optionRefs.current[i] = el; },
      onMouseMove: () => setActive(i),
      onClick: () => { setActive(i); const item = results[i]; if (item !== undefined) onOpen(item); },
    }),
  };
}

/** Matched words, softly marked. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i} className="rounded-sm bg-accent-soft text-text">{p}</mark> : p))}</>;
}

/** A searchable list, ready to drop in: search field + filtered results + empty state. */
export function SearchList<T>({
  items, getText, renderItem, onOpen, placeholder = "Search", emptyHint, getKey, maxHeight = 320,
}: {
  items: T[];
  getText: (item: T) => string;
  renderItem: (item: T, query: string, active: boolean) => ReactNode;
  onOpen: (item: T) => void;
  placeholder?: string;
  /** What to do when nothing matches, e.g. "Check the spelling, or clear the filters". */
  emptyHint?: string;
  getKey?: (item: T, i: number) => string | number;
  maxHeight?: number;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useSlashToFocus(inputRef);
  const results = useMemo(() => (query.trim() ? items.filter((it) => matches(getText(it), query)) : items), [items, query, getText]);
  const clear = useCallback(() => setQuery(""), []);
  const keys = useSearchKeys({ results, onOpen, onClear: clear, query });
  return (
    <div className="flex flex-col gap-2">
      <SearchInput value={query} onChange={setQuery} onKeyDown={keys.inputKeys} inputRef={inputRef}
        placeholder={placeholder} count={query ? results.length : undefined}
        listId={keys.listId} activeId={keys.activeId} />
      <div {...keys.listProps} className="overflow-y-auto rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus" style={{ maxHeight }}>
        {results.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-text-3">
            {query ? <>Nothing matches “{query}”. {emptyHint ?? "Try fewer or different words."}</> : "Nothing here yet."}
          </p>
        ) : (
          results.map((it, i) => (
            <div key={getKey ? getKey(it, i) : i} {...keys.optionProps(i)}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${i === keys.active ? "bg-accent-soft text-text" : "text-text-2 hover:bg-surface-2"}`}>
              {renderItem(it, query, i === keys.active)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
