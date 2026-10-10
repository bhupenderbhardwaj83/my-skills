"use client";
// ⌘K / Ctrl+K command palette: one box to jump anywhere or run any action. Same keys as every
// search (type · ↑↓ · Enter · Esc). Recent choices come first when the box is empty.
// TopBar: context switchers on the left, "Search ⌘K" + actions + theme toggle on the right.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Layer } from "./overlay";
import { Highlight, SearchInput, matches, useSearchKeys } from "./search";
import { ThemeToggle } from "./theme";
import { SearchIcon } from "./icons";

export interface Command {
  id: string;
  label: string;
  /** Group heading: "Pages", "Actions", "Recent projects"… */
  group: string;
  icon?: ReactNode;
  /** Shortcut or context shown on the right. */
  hint?: string;
  /** Extra words that should find it ("dark mode" → Theme). */
  keywords?: string;
  run: () => void;
}

const RECENT_KEY = "palette-recent";
const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export function CommandPalette({ open, onClose, commands, placeholder = "Search pages and actions" }: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    setQuery("");
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")); } catch { setRecent([]); }
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);
  const results = useMemo(() => {
    if (query.trim()) return commands.filter((c) => matches(`${c.label} ${c.group} ${c.keywords ?? ""}`, query));
    const rec = recent.map((id) => commands.find((c) => c.id === id)).filter((c): c is Command => Boolean(c)).map((c) => ({ ...c, group: "Recent" }));
    return [...rec, ...commands.filter((c) => !recent.includes(c.id))];
  }, [commands, query, recent]);
  const run = (c: Command) => {
    const next = [c.id, ...recent.filter((r) => r !== c.id)].slice(0, 5);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    onClose();
    c.run();
  };
  const keys = useSearchKeys({
    results, onOpen: run, query,
    onClear: () => { if (query) setQuery(""); else onClose(); },
  });
  if (!open) return null;
  let lastGroup = "";
  return (
    <Layer>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-overlay px-4 pt-[14vh] backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div role="dialog" aria-label="Command palette" className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-calm"
          onKeyDown={(e) => { if (e.key === "Escape" && !query) { e.preventDefault(); onClose(); } }}>
          <div className="border-b border-border-subtle p-3">
            <SearchInput value={query} onChange={setQuery} inputRef={inputRef} placeholder={placeholder}
              onKeyDown={keys.inputKeys} listId={keys.listId} activeId={keys.activeId} count={query ? results.length : undefined} />
          </div>
          <div {...keys.listProps} className="max-h-[50vh] overflow-y-auto p-2 outline-none">
            {results.length === 0 && <p className="px-3 py-8 text-center text-sm text-text-3">Nothing matches “{query}”. Try another word.</p>}
            {results.map((c, i) => {
              const head = c.group !== lastGroup ? c.group : null;
              lastGroup = c.group;
              return (
                <div key={`${c.group}-${c.id}`}>
                  {head && <p className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-text-3">{head}</p>}
                  <div {...keys.optionProps(i)} className={`flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm ${i === keys.active ? "bg-accent-soft text-text" : "text-text-2"}`}>
                    <span className="shrink-0 text-text-3">{c.icon ?? <SearchIcon width={14} height={14} />}</span>
                    <span className="min-w-0 flex-1 truncate"><Highlight text={c.label} query={query} /></span>
                    {c.hint && <span className="text-xs text-text-3">{c.hint}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="flex gap-3 border-t border-border-subtle px-4 py-2 text-xs text-text-3">
            <span>↑↓ move</span><span>↵ open</span><span>Esc close</span>
          </p>
        </div>
      </div>
    </Layer>
  );
}

/** Slim top bar: switchers left, search + actions + theme toggle right. */
export function TopBar({ left, actions, onSearch, avatar }: {
  /** Context switchers, breadcrumbs: e.g. <Menu> buttons ("All projects ▾"). */
  left?: ReactNode;
  /** Icon buttons (help, notifications…). */
  actions?: ReactNode;
  /** Opens the command palette. */
  onSearch?: () => void;
  avatar?: ReactNode;
}) {
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(isMac()), []);
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border-subtle bg-bg px-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{left}</div>
      {onSearch && (
        <button type="button" onClick={onSearch}
          className="inline-flex h-8 w-56 items-center gap-2 rounded-lg border border-border bg-sunken px-2.5 text-sm text-text-3 hover:border-border-strong hover:text-text-2">
          <SearchIcon width={14} height={14} />
          <span className="flex-1 text-left">Search</span>
          <kbd className="font-mono text-xs">{mac ? "⌘K" : "Ctrl K"}</kbd>
        </button>
      )}
      {actions}
      <ThemeToggle />
      {avatar}
    </header>
  );
}
