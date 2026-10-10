"use client";
// Small overlay primitives used by every richer component: a positioned layer, a dropdown Menu
// (keyboard: ↑↓ move · Enter/Space choose · Esc close · type a letter to jump), a Tooltip
// (hover or keyboard focus, after a short delay) and Tabs (←/→ between tabs).
import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type KeyboardEvent, type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";

/* ── positioning ───────────────────────────────────────────────────────── */

type Side = "bottom-start" | "bottom-end" | "right-start" | "top";

/** Fixed position next to *anchor*, kept on screen (flips above / to the left when needed). */
export function useAnchoredPosition(anchor: RefObject<HTMLElement>, layer: RefObject<HTMLElement>, open: boolean, side: Side) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const place = useCallback(() => {
    const a = anchor.current?.getBoundingClientRect();
    const l = layer.current?.getBoundingClientRect();
    if (!a || !l) return;
    const gap = 6, m = 8, vw = window.innerWidth, vh = window.innerHeight;
    let top = 0, left = 0;
    if (side === "right-start") { top = a.top; left = a.right + gap; if (left + l.width > vw - m) left = a.left - l.width - gap; }
    else if (side === "top") { top = a.top - l.height - gap; left = a.left + a.width / 2 - l.width / 2; if (top < m) top = a.bottom + gap; }
    else {
      top = a.bottom + gap;
      left = side === "bottom-end" ? a.right - l.width : a.left;
      if (top + l.height > vh - m && a.top - l.height - gap > m) top = a.top - l.height - gap;
    }
    setPos({ top: Math.max(m, Math.min(top, vh - l.height - m)), left: Math.max(m, Math.min(left, vw - l.width - m)) });
  }, [anchor, layer, side]);
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, place]);
  return pos;
}

/** Close on Esc or a click outside *refs*. */
export function useDismiss(open: boolean, onClose: () => void, refs: RefObject<HTMLElement>[]) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return;
      onClose();
    };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("pointerdown", onDown, true); document.removeEventListener("keydown", onKey, true); };
  }, [open, onClose, refs]);
}

export function Layer({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

const panel = "rounded-xl border border-border bg-surface-2 shadow-calm";

/* ── menu ──────────────────────────────────────────────────────────────── */

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Right-aligned hint: a shortcut ("⌘S") or a count. */
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Draw a divider above this item. */
  divider?: boolean;
  /** For choice menus: show a check. */
  checked?: boolean;
}

/**
 * A dropdown menu on any trigger. `trigger` receives the props to spread on your button.
 * Used for ⋮ menus, context switchers ("All projects ▾"), "Save as…", column pickers.
 */
export function Menu({ trigger, items, onSelect, side = "bottom-start", label, keepOpen = false, width = 220 }: {
  trigger: (p: { ref: RefObject<HTMLButtonElement>; onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => ReactNode;
  items: MenuItem[];
  onSelect: (id: string) => void;
  side?: Side;
  /** Small heading inside the menu. */
  label?: string;
  /** Multi-choice menus stay open after a choice. */
  keepOpen?: boolean;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPosition(btn, layer, open, side);
  const close = useCallback(() => { setOpen(false); btn.current?.focus(); }, []);
  useDismiss(open, close, [btn, layer]);
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  useEffect(() => { if (open) { setActive(enabled[0] ?? 0); requestAnimationFrame(() => layer.current?.focus()); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (it: MenuItem) => { if (it.disabled) return; onSelect(it.id); if (!keepOpen) close(); };
  const onKey = (e: KeyboardEvent) => {
    const at = enabled.indexOf(active);
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(enabled[(at + 1) % enabled.length]); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(enabled[(at - 1 + enabled.length) % enabled.length]); }
    else if (e.key === "Home") { e.preventDefault(); setActive(enabled[0]); }
    else if (e.key === "End") { e.preventDefault(); setActive(enabled[enabled.length - 1]); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const it = items[active]; if (it) choose(it); }
    else if (e.key === "Tab") close();
    else if (e.key.length === 1) {   // type-ahead: jump to the next item starting with that letter
      const k = e.key.toLowerCase();
      const next = enabled.find((i) => i > active && items[i].label.toLowerCase().startsWith(k)) ?? enabled.find((i) => items[i].label.toLowerCase().startsWith(k));
      if (next != null) setActive(next);
    }
  };
  const id = useId();
  return (
    <>
      {trigger({ ref: btn, onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu" })}
      {open && (
        <Layer>
          <div ref={layer} role="menu" id={id} tabIndex={-1} onKeyDown={onKey} aria-activedescendant={`${id}-${active}`}
            className={`fixed z-50 p-1 outline-none ${panel}`} style={{ width, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}>
            {label && <p className="px-2.5 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wider text-text-3">{label}</p>}
            {items.map((it, i) => (
              <div key={it.id}>
                {it.divider && <div className="my-1 border-t border-border-subtle" />}
                <div id={`${id}-${i}`} role={it.checked != null ? "menuitemcheckbox" : "menuitem"} aria-checked={it.checked} aria-disabled={it.disabled}
                  onMouseMove={() => !it.disabled && setActive(i)} onClick={() => choose(it)}
                  className={`flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm ${it.disabled ? "cursor-default opacity-40" : ""} ${i === active && !it.disabled ? "bg-surface text-text" : it.danger ? "text-danger" : "text-text-2"}`}>
                  {it.checked != null && <span className={`flex h-4 w-4 items-center justify-center rounded border ${it.checked ? "border-accent bg-accent text-accent-on" : "border-border-strong"}`}>{it.checked ? "✓" : ""}</span>}
                  {it.icon && <span className="shrink-0 text-text-3">{it.icon}</span>}
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.hint && <span className="text-xs tabular-nums text-text-3">{it.hint}</span>}
                </div>
              </div>
            ))}
          </div>
        </Layer>
      )}
    </>
  );
}

/* ── tooltip ───────────────────────────────────────────────────────────── */

/** Shows *content* on hover or keyboard focus after 400 ms; for icon-only buttons, truncated text,
 *  row details. Wrap one focusable element. */
export function Tooltip({ content, children, side = "top", wide = false }: {
  content: ReactNode; children: ReactNode; side?: Side; wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const pos = useAnchoredPosition(wrap, layer, open, side);
  const show = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(true), 400); };
  const hide = () => { window.clearTimeout(timer.current); setOpen(false); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <span ref={wrap} className="inline-flex max-w-full" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
      onKeyDown={(e) => { if (e.key === "Escape") hide(); }}>
      {children}
      {open && (
        <Layer>
          <div ref={layer} role="tooltip" className={`pointer-events-none fixed z-[60] px-3 py-2 text-xs leading-relaxed text-text ${panel} ${wide ? "max-w-md" : "max-w-xs"}`}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}>
            {content}
          </div>
        </Layer>
      )}
    </span>
  );
}

/* ── tabs ──────────────────────────────────────────────────────────────── */

export function Tabs({ tabs, value, onChange }: {
  tabs: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const i = tabs.findIndex((t) => t.id === value);
  const go = (n: number) => { const t = tabs[(n + tabs.length) % tabs.length]; onChange(t.id); refs.current[(n + tabs.length) % tabs.length]?.focus(); };
  return (
    <div role="tablist" className="flex gap-5 border-b border-border-subtle"
      onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); } }}>
      {tabs.map((t, n) => (
        <button key={t.id} ref={(el) => { refs.current[n] = el; }} type="button" role="tab" aria-selected={t.id === value} tabIndex={t.id === value ? 0 : -1}
          onClick={() => onChange(t.id)}
          className={`relative -mb-px inline-flex h-10 items-center gap-1.5 border-b-2 text-sm transition-colors duration-fast ${t.id === value ? "border-accent font-medium text-text" : "border-transparent text-text-3 hover:text-text"}`}>
          {t.label}
          {t.count != null && <span className="rounded-md bg-surface-2 px-1.5 text-xs tabular-nums text-text-3">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
