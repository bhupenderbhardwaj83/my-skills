"use client";
// Icon rail navigation with hover flyouts — the deep, progressive navigation of large apps.
//   Rail (72 px): logo on top, icon + tiny label per area, utilities at the bottom.
//   Hover (or focus + →/Enter) an area with sub-pages → a flyout slides out with grouped,
//   collapsible sections. Leaving both closes it after a short grace period (no flicker).
//   Pin (or ⌘B / Ctrl+B) docks the flyout as a sidebar for the current area — remembered.
//   Keyboard: ↑↓ rail items · →/Enter open flyout · ↑↓ inside · ←/Esc back to the rail.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronRight, PanelIcon } from "./icons";
import { useShortcut } from "./platform";

export interface RailLink { id: string; label: string; icon?: ReactNode; badge?: ReactNode }
export interface RailSection { title: string; items: RailLink[] }
export interface RailItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** Sub-pages, grouped. Items without sections navigate directly. */
  sections?: RailSection[];
  badge?: ReactNode;
}

const PIN_KEY = "rail-pinned";
const FOLD_KEY = "rail-folded";

function readJson<T>(k: string, d: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
}
function writeJson(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ }
}

export function IconRail({ logo, appName, items, footerItems = [], active, activeSub, onSelect }: {
  logo: ReactNode;
  appName: string;
  items: RailItem[];
  footerItems?: RailItem[];
  /** Current area id and (optional) sub-page id. */
  active: string;
  activeSub?: string;
  onSelect: (areaId: string, subId?: string) => void;
}) {
  const sc = useShortcut();
  const all = [...items, ...footerItems];
  const [open, setOpen] = useState<string | null>(null);       // flyout shown for this area
  const [pinned, setPinned] = useState(false);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [narrow, setNarrow] = useState(false);
  const closeTimer = useRef<number>();
  const openTimer = useRef<number>();
  const railRef = useRef<HTMLElement>(null);
  const flyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPinned(readJson(PIN_KEY, false)); setFolded(readJson(FOLD_KEY, {})); }, []);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setNarrow(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const docked = pinned && !narrow;
  const togglePin = useCallback(() => setPinned((p) => { writeJson(PIN_KEY, !p); return !p; }), []);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); togglePin(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePin]);

  // Hover intent: open after 90 ms, close 220 ms after leaving rail + flyout.
  const hoverOpen = (id: string) => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setOpen(all.find((i) => i.id === id)?.sections ? id : null), open ? 0 : 90);
  };
  const hoverClose = () => {
    window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 220);
  };
  useEffect(() => () => { window.clearTimeout(closeTimer.current); window.clearTimeout(openTimer.current); }, []);

  const shownId = open ?? (docked ? active : null);
  const shown = all.find((i) => i.id === shownId && i.sections?.length);
  // Docked = part of the layout (pushes content). A peek at another area floats over the content.
  const floating = !docked || (open !== null && open !== active);

  const focusRail = (id: string) => railRef.current?.querySelector<HTMLButtonElement>(`[data-rail="${id}"]`)?.focus();
  const onRailKey = (e: KeyboardEvent<HTMLButtonElement>, it: RailItem, idx: number) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      focusRail(all[(idx + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length].id);
    } else if ((e.key === "ArrowRight" || e.key === "Enter") && it.sections?.length) {
      e.preventDefault();
      setOpen(it.id);
      requestAnimationFrame(() => flyRef.current?.querySelector<HTMLButtonElement>("[data-fly]")?.focus());
    } else if (e.key === "Escape") setOpen(null);
  };
  const onFlyKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const links = Array.from(flyRef.current?.querySelectorAll<HTMLButtonElement>("[data-fly]") ?? []);
    const i = links.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      links[(i + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "Escape") {
      e.preventDefault();
      const back = shown?.id;
      if (!docked) setOpen(null);
      if (back) focusRail(back);
    }
  };
  const toggleFold = (title: string) => setFolded((f) => { const n = { ...f, [title]: !f[title] }; writeJson(FOLD_KEY, n); return n; });

  // A render function, not a component: a component defined in here would be re-created on every
  // render, so React would replace the buttons and keyboard focus would be lost.
  const railButton = (it: RailItem, idx: number) => {
    const on = it.id === active;
    return (
      <button key={it.id} type="button" data-rail={it.id} onClick={() => onSelect(it.id)} onMouseEnter={() => hoverOpen(it.id)}
        onFocus={() => { if (open && it.sections) setOpen(it.id); }} onKeyDown={(e) => onRailKey(e, it, idx)}
        aria-current={on ? "page" : undefined} aria-haspopup={it.sections ? "true" : undefined} aria-expanded={it.sections ? shown?.id === it.id : undefined}
        className={`group flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10.5px] leading-tight transition-colors duration-fast ${on ? "text-accent-text" : "text-text-3 hover:text-text"}`}>
        <span className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-fast ${on ? "bg-accent-soft" : shown?.id === it.id ? "bg-surface-2" : "group-hover:bg-surface-2"}`}>
          {it.icon}
          {it.badge != null && <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-accent px-1 text-center text-[10px] font-medium leading-4 text-accent-on">{it.badge}</span>}
        </span>
        <span className="max-w-full truncate">{it.label}</span>
      </button>
    );
  };

  return (
    <div className="relative flex h-full shrink-0" onMouseLeave={hoverClose} onMouseEnter={() => window.clearTimeout(closeTimer.current)}>
      <nav ref={railRef} aria-label="Main navigation" className="z-30 flex h-full w-[72px] flex-col items-center border-r border-border-subtle bg-sunken px-1.5 py-3">
        <button type="button" onClick={() => onSelect(items[0]?.id ?? active)} title={appName}
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft ring-1 ring-accent-text/25">{logo}</button>
        <div className="flex w-full flex-1 flex-col gap-0.5 overflow-y-auto">
          {items.map((it, i) => railButton(it, i))}
        </div>
        <div className="flex w-full flex-col gap-0.5 pt-2">
          {footerItems.map((it, i) => railButton(it, items.length + i))}
        </div>
      </nav>

      {shown && (
        <div ref={flyRef} onKeyDown={onFlyKey} onMouseEnter={() => window.clearTimeout(closeTimer.current)}
          className={`z-20 flex h-full w-64 flex-col border-r border-border-subtle bg-surface ${floating ? "absolute left-[72px] top-0 shadow-calm" : ""}`}
          style={{ animation: "calm-fly-in 140ms cubic-bezier(.2,.8,.2,1)" }}>
          <style>{"@keyframes calm-fly-in{from{transform:translateX(-6px)}to{transform:none}}@media (prefers-reduced-motion:reduce){[style*=calm-fly-in]{animation:none!important}}"}</style>
          <div className="flex h-14 shrink-0 items-center gap-2 px-4">
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-text">{shown.label}</h2>
            {!narrow && (
              <button type="button" onClick={togglePin} aria-pressed={pinned}
                title={pinned ? `Unpin — show on hover only (${sc("B")})` : `Pin open (${sc("B")})`} aria-label={pinned ? "Unpin panel" : "Pin panel open"}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-2 ${pinned ? "text-accent-text" : "text-text-3 hover:text-text"}`}>
                <PanelIcon />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {shown.sections!.map((sec) => {
              const isFolded = Boolean(folded[`${shown.id}/${sec.title}`]);
              return (
                <div key={sec.title} className="mb-2">
                  <button type="button" onClick={() => toggleFold(`${shown.id}/${sec.title}`)} aria-expanded={!isFolded}
                    className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-xs font-semibold uppercase tracking-wider text-text-3 hover:text-text">
                    <span className="flex-1 text-left">{sec.title}</span>
                    <ChevronRight width={14} height={14} className={`transition-transform duration-fast ${isFolded ? "" : "rotate-90"}`} />
                  </button>
                  {!isFolded && sec.items.map((link) => {
                    const on = shown.id === active && link.id === activeSub;
                    return (
                      <button key={link.id} type="button" data-fly onClick={() => { onSelect(shown.id, link.id); if (!docked) setOpen(null); }}
                        aria-current={on ? "page" : undefined}
                        className={`flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-sm outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-focus ${on ? "bg-accent-soft font-medium text-text" : "text-text-2 hover:bg-surface-2 hover:text-text"}`}>
                        {link.icon && <span className={`shrink-0 ${on ? "text-accent-text" : "text-text-3"}`}>{link.icon}</span>}
                        <span className="min-w-0 flex-1 truncate text-left">{link.label}</span>
                        {link.badge != null && <span className="text-xs tabular-nums text-text-3">{link.badge}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
