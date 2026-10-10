"use client";
// Containers for deep, progressive detail:
//   Widget        dashboard card: title · subtitle · quiet actions (filter, settings, ⋮ menu)
//   DetailDrawer  slides in from the right over a dimmed list: prev/next (↑/↓ or K/J), Esc closes,
//                 tabs, header actions — the list stays in place behind it
//   KeyValueGrid  label → value pairs in tidy columns
//   TreeView      expandable hierarchy (→ open · ← close · ↑↓ move · Enter select)
//   EmptyState    illustration + what happened + the one action that fixes it
//   Announcement  dismissible "what's new" card in a corner — remembered once dismissed
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Layer, Menu, type MenuItem } from "./overlay";
import { ArrowDown, ArrowUp, ChevronRight, ExpandIcon, FilterIcon, GearIcon, GripIcon, MinimizeIcon, MoreIcon, ShrinkIcon, XIcon } from "./icons";

const iconBtn = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-3 transition-colors duration-fast hover:bg-surface-2 hover:text-text";

/* ── widget ────────────────────────────────────────────────────────────── */

export function Widget({ title, subtitle, onFilter, onSettings, menu, onMenu, children, className = "", footer }: {
  title: string;
  /** "Past 30 days", "Current open issues". */
  subtitle?: string;
  onFilter?: () => void;
  onSettings?: () => void;
  /** ⋮ menu: e.g. View all · Export CSV · Remove from board. */
  menu?: MenuItem[];
  onMenu?: (id: string) => void;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <section className={`flex flex-col rounded-xl border border-border-subtle bg-surface p-6 shadow-sm ${className}`}>
      <header className="mb-4 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-text">{title}</h3>
          {subtitle && <p className="text-xs text-text-3">{subtitle}</p>}
        </div>
        {/* Actions stay quiet: visible, but they don't compete with the data. */}
        <div className="-mr-2 -mt-1 flex items-center">
          {onSettings && <button type="button" onClick={onSettings} className={iconBtn} title="Widget settings" aria-label="Widget settings"><GearIcon /></button>}
          {onFilter && <button type="button" onClick={onFilter} className={iconBtn} title="Filter" aria-label="Filter"><FilterIcon /></button>}
          {menu && onMenu && (
            <Menu items={menu} onSelect={onMenu} side="bottom-end"
              trigger={(p) => <button {...p} type="button" className={iconBtn} title="More" aria-label="More actions"><MoreIcon /></button>} />
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
      {footer && <footer className="mt-4 border-t border-border-subtle pt-3 text-xs text-text-3">{footer}</footer>}
    </section>
  );
}

/* ── detail drawer: a half-screen sub-window ─────────────────────────────── */

const WIDTH_KEY = "drawer-width";
const clampW = (f: number) => Math.max(0.3, Math.min(0.96, f));

/**
 * Opens beside the list (half the screen by default) so the user never loses the overall flow.
 * Controls: drag the grip (or ←/→ on it) to resize — remembered · ⤢ expand to full width / restore ·
 * – minimise to a chip at the bottom (click to restore) · ✕ close (Esc) · ↑/K ↓/J previous / next.
 */
export function DetailDrawer({ open, onClose, title, subtitle, icon, actions, onPrev, onNext, children, defaultWidth = 0.5 }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Header buttons: Support, Copy link, ⋮ … */
  actions?: ReactNode;
  /** Step to the previous / next item of the list behind (↑/K, ↓/J). */
  onPrev?: () => void;
  onNext?: () => void;
  children: ReactNode;
  /** Share of the window, 0.3–0.96 (0.5 = half screen). The user's own width wins once set. */
  defaultWidth?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [frac, setFrac] = useState(defaultWidth);
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [dragging, setDragging] = useState(false);
  useEffect(() => { try { const v = Number(localStorage.getItem(WIDTH_KEY)); if (v) setFrac(clampW(v)); } catch { /* none */ } }, []);
  const saveFrac = (f: number) => { const c = clampW(f); setFrac(c); try { localStorage.setItem(WIDTH_KEY, String(c)); } catch { /* private mode */ } };
  useEffect(() => {
    if (!open) { setMinimized(false); return; }
    opener.current = document.activeElement;
    requestAnimationFrame(() => panel.current?.focus());
    return () => { (opener.current as HTMLElement | null)?.focus?.(); };
  }, [open]);
  if (!open) return null;
  if (minimized) {
    return (
      <Layer>
        <button type="button" onClick={() => setMinimized(false)}
          className="fixed bottom-4 left-1/2 z-40 inline-flex max-w-md -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2 text-sm text-text shadow-calm hover:border-border-strong">
          <ExpandIcon width={14} height={14} className="text-text-3" />
          <span className="truncate">{title}</span>
          <span className="text-xs text-text-3">Restore</span>
        </button>
      </Layer>
    );
  }
  const width = expanded ? "100vw" : `${Math.round(frac * 100)}vw`;
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) { if (e.key === "Escape") t.blur(); return; }
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if ((e.key === "ArrowUp" || e.key.toLowerCase() === "k") && onPrev && !e.metaKey && !t.dataset.grip) { e.preventDefault(); onPrev(); }
    else if ((e.key === "ArrowDown" || e.key.toLowerCase() === "j") && onNext && !e.metaKey && !t.dataset.grip) { e.preventDefault(); onNext(); }
  };
  const startDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragging(true);
    setExpanded(false);
    const move = (ev: PointerEvent) => saveFrac((window.innerWidth - ev.clientX) / window.innerWidth);
    const up = () => { setDragging(false); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const round = "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-text-2 shadow-calm hover:text-text";
  return (
    <Layer>
      <div className="fixed inset-0 z-40 bg-overlay" onMouseDown={onClose} aria-hidden />
      {!expanded && (
        <div className="fixed top-4 z-50 flex flex-col gap-2" style={{ right: `calc(${width} + 12px)` }}>
          <button type="button" onClick={onClose} className={round} aria-label="Close (Esc)" title="Close (Esc)"><XIcon /></button>
          {onPrev && <button type="button" onClick={onPrev} className={round} aria-label="Previous (↑ or K)" title="Previous (↑ / K)"><ArrowUp /></button>}
          {onNext && <button type="button" onClick={onNext} className={round} aria-label="Next (↓ or J)" title="Next (↓ / J)"><ArrowDown /></button>}
        </div>
      )}
      <div ref={panel} role="dialog" aria-modal="true" tabIndex={-1} onKeyDown={onKey}
        className={`fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-bg shadow-calm outline-none ${dragging ? "select-none" : "transition-[width] duration-normal ease-calm"}`}
        style={{ width, animation: "calm-drawer-in 180ms cubic-bezier(.2,.8,.2,1)" }}>
        <style>{"@keyframes calm-drawer-in{from{transform:translateX(24px)}to{transform:none}}@media (prefers-reduced-motion:reduce){[style*=calm-drawer-in]{animation:none!important}}"}</style>
        {!expanded && (
          <button type="button" data-grip="1" onPointerDown={startDrag} aria-label="Resize panel (← / →)" title="Drag to resize (← / →)"
            onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); saveFrac(frac + (e.key === "ArrowLeft" ? 0.05 : -0.05)); } }}
            className="absolute -left-3 top-1/2 z-10 flex h-12 w-6 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-border bg-surface-2 text-text-3 shadow-calm hover:text-text">
            <GripIcon width={14} height={14} />
          </button>
        )}
        <header className="flex items-start gap-3 border-b border-border-subtle px-6 pb-4 pt-5">
          {icon && <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug text-text">{title}</h2>
            {subtitle && <p className="text-sm text-text-3">{subtitle}</p>}
            {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
          <div className="-mr-2 flex items-center">
            <button type="button" onClick={() => setMinimized(true)} className={iconBtn} title="Minimise — keep it for later" aria-label="Minimise panel"><MinimizeIcon /></button>
            <button type="button" onClick={() => setExpanded((x) => !x)} className={iconBtn} title={expanded ? "Restore size" : "Expand to full width"} aria-label={expanded ? "Restore size" : "Expand panel"}>{expanded ? <ShrinkIcon /> : <ExpandIcon />}</button>
            {expanded && <button type="button" onClick={onClose} className={iconBtn} title="Close (Esc)" aria-label="Close"><XIcon /></button>}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </Layer>
  );
}

/* ── key / value ───────────────────────────────────────────────────────── */

export function KeyValueGrid({ items, columns = 4 }: { items: { label: string; value: ReactNode }[]; columns?: 2 | 3 | 4 }) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <dl className={`grid gap-x-6 gap-y-4 ${cols}`}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs text-text-3">{it.label}</dt>
          <dd className="mt-1 truncate text-sm text-text">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── tree ──────────────────────────────────────────────────────────────── */

export interface TreeNode { id: string; label: ReactNode; icon?: ReactNode; meta?: ReactNode; children?: TreeNode[] }

export function TreeView({ nodes, defaultOpen = [], onSelect }: { nodes: TreeNode[]; defaultOpen?: string[]; onSelect?: (id: string) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set(defaultOpen));
  const root = useRef<HTMLUListElement>(null);
  const toggle = (id: string, to?: boolean) => setOpen((o) => { const n = new Set(o); if (to ?? !n.has(id)) n.add(id); else n.delete(id); return n; });
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>("[role=treeitem] > div[tabindex]") ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const el = items[i], id = el.dataset.id!, hasKids = el.dataset.kids === "1";
    if (e.key === "ArrowDown") { e.preventDefault(); items[i + 1]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[i - 1]?.focus(); }
    else if (e.key === "ArrowRight" && hasKids) { e.preventDefault(); toggle(id, true); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); if (hasKids && open.has(id)) toggle(id, false); else (el.closest("ul")?.closest("li")?.querySelector(":scope > div[tabindex]") as HTMLElement | null)?.focus(); }
    else if (e.key === "Enter") { e.preventDefault(); onSelect?.(id); }
  };
  const render = (list: TreeNode[]): ReactNode => list.map((n) => {
    const kids = Boolean(n.children?.length), isOpen = open.has(n.id);
    return (
      <li key={n.id} role="treeitem" aria-expanded={kids ? isOpen : undefined}>
        <div tabIndex={0} data-id={n.id} data-kids={kids ? "1" : "0"} onClick={() => { if (kids) toggle(n.id); onSelect?.(n.id); }}
          className="group flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-surface px-2 text-sm outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus">
          <ChevronRight width={14} height={14} className={`shrink-0 text-text-3 transition-transform duration-fast ${kids ? "" : "invisible"} ${isOpen ? "rotate-90" : ""}`} />
          {n.icon && <span className="shrink-0 text-text-3">{n.icon}</span>}
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-text">{n.label}</span>
          {n.meta}
        </div>
        {/* Indent with padding (not margin) so deep levels narrow instead of overflowing. */}
        {kids && isOpen && <ul role="group" className="mt-1.5 space-y-1.5 pl-5">{render(n.children!)}</ul>}
      </li>
    );
  });
  return <ul ref={root} role="tree" onKeyDown={onKey} className="space-y-1.5">{render(nodes)}</ul>;
}

/* ── empty state ───────────────────────────────────────────────────────── */

/** A calm line illustration (magnifier over a cloud), in the accent colour — no external art needed. */
export function EmptyIllustration({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 160 120" fill="none" aria-hidden>
      <path d="M30 92h104a18 18 0 0 0-4-35.6A26 26 0 0 0 82 46a22 22 0 0 0-40 8 19 19 0 0 0-12 38Z" stroke="var(--border-strong)" strokeWidth="2" />
      <circle cx="80" cy="50" r="24" fill="var(--bg)" stroke="var(--accent-text)" strokeWidth="2.5" />
      <path d="m97 67 18 18" stroke="var(--accent-text)" strokeWidth="5" strokeLinecap="round" />
      <path d="m71 41 18 18m0-18-18 18" stroke="var(--accent-text)" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

export function EmptyState({ title, hint, action, illustration = true }: {
  title: string;
  /** What to try next — never just "nothing here". */
  hint?: string;
  action?: { label: string; onClick: () => void };
  illustration?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {illustration && <EmptyIllustration />}
      <h3 className="mt-4 text-lg font-semibold text-text">{title}</h3>
      {hint && <p className="mt-1 max-w-sm text-sm text-text-3">{hint}</p>}
      {action && <button type="button" onClick={action.onClick} className="mt-5 h-9 rounded-lg px-4 text-sm font-medium text-text ring-1 ring-border-strong hover:bg-surface-2">{action.label}</button>}
    </div>
  );
}

/* ── announcement ──────────────────────────────────────────────────────── */

export function Announcement({ id, title, body, art, action, corner = "bottom-left", offset = 16 }: {
  /** Stable id: once dismissed, it doesn't come back. */
  id: string;
  title: string;
  body?: string;
  art?: ReactNode;
  action?: { label: string; onClick: () => void };
  corner?: "bottom-left" | "bottom-right";
  /** Distance from the side, px — with an IconRail on the left use 88 so the rail stays usable. */
  offset?: number;
}) {
  const key = `announce-${id}`;
  const [shown, setShown] = useState(false);
  useEffect(() => { try { setShown(localStorage.getItem(key) !== "1"); } catch { setShown(true); } }, [key]);
  if (!shown) return null;
  const dismiss = () => { setShown(false); try { localStorage.setItem(key, "1"); } catch { /* private mode */ } };
  return (
    <aside role="status" className="fixed bottom-4 z-30 flex w-80 max-w-[calc(100vw-2rem)] gap-3 rounded-xl border border-border bg-surface-2 p-4 shadow-calm"
      style={corner === "bottom-left" ? { left: offset } : { right: offset }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text">{title}</p>
        {body && <p className="mt-1 text-xs text-text-3">{body}</p>}
        {action && <button type="button" onClick={() => { action.onClick(); dismiss(); }} className="mt-2 text-xs font-medium text-accent-text hover:underline">{action.label}</button>}
      </div>
      {art}
      <button type="button" onClick={dismiss} className="-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-3 hover:text-text" aria-label="Dismiss"><XIcon width={14} height={14} /></button>
    </aside>
  );
}
