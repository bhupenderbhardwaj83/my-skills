"use client";
// Collapsible sidebar with the app's logo always in view.
//   Expanded (240 px): logo mark + name, icon + label per item.
//   Collapsed (64 px): logo mark stays highlighted at the top; icons with tooltips.
//   ⌘B / Ctrl+B or the panel button toggles; the choice is remembered. ↑/↓ move between items.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { PanelIcon } from "./icons";
import { useShortcut } from "./platform";

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** Small count or dot, e.g. unread items. */
  badge?: ReactNode;
}

const KEY = "sidebar-collapsed";

export function Sidebar({
  logo, appName, items, footerItems = [], active, onSelect, children,
}: {
  /** The logo mark (square, ~24 px) — shown in both states. */
  logo: ReactNode;
  appName: string;
  items: NavItem[];
  /** Pinned to the bottom: settings, help, account. */
  footerItems?: NavItem[];
  active: string;
  onSelect: (id: string) => void;
  /** Extra content under the nav when expanded (e.g. recent projects). Hidden when collapsed. */
  children?: ReactNode;
}) {
  const sc = useShortcut();
  const [chosen, setCollapsed] = useState(false);
  // Narrow windows: the rail collapses on its own so the content keeps its room (logo stays).
  const [narrow, setNarrow] = useState(false);
  const collapsed = chosen || narrow;
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(KEY) === "1"); } catch { /* default: expanded */ }
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      try { localStorage.setItem(KEY, c ? "0" : "1"); } catch { /* private mode */ }
      return !c;
    });
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Arrow keys move between items (roving through the nav buttons).
  const onNavKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = Array.from(navRef.current?.querySelectorAll<HTMLButtonElement>("[data-nav-item]") ?? []);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    buttons[(i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  };

  // A render function, not a nested component (that would remount on every render and drop focus).
  const item = (it: NavItem) => {
    const on = it.id === active;
    return (
      <button key={it.id} type="button" data-nav-item onClick={() => onSelect(it.id)} aria-current={on ? "page" : undefined}
        title={collapsed ? it.label : undefined}
        className={`group relative flex h-9 w-full items-center gap-3 rounded-lg text-sm transition-colors duration-fast ${collapsed ? "justify-center" : "px-3"} ${on ? "bg-surface-2 font-medium text-text" : "text-text-2 hover:bg-surface-2/60 hover:text-text"}`}>
        {on && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" aria-hidden />}
        <span className={`shrink-0 ${on ? "text-accent-text" : ""}`}>{it.icon}</span>
        {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{it.label}</span>}
        {!collapsed && it.badge != null && <span className="text-xs tabular-nums text-text-3">{it.badge}</span>}
      </button>
    );
  };

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-border-subtle bg-sunken transition-[width] duration-normal ease-calm ${collapsed ? "w-16" : "w-60"}`}
      aria-label="Main navigation">
      {/* Logo: always visible, softly highlighted, also the home button. */}
      <div className={`flex h-14 items-center gap-2.5 ${collapsed ? "justify-center" : "px-3"}`}>
        <button type="button" onClick={() => onSelect(items[0]?.id ?? active)} title={appName}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft ring-1 ring-accent-text/25">
          {logo}
        </button>
        {!collapsed && <span className="min-w-0 flex-1 truncate text-base font-semibold text-text">{appName}</span>}
        {!collapsed && !narrow && (
          <button type="button" onClick={toggle} title={`Collapse sidebar (${sc("B")})`} aria-label="Collapse sidebar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-3 hover:bg-surface-2 hover:text-text">
            <PanelIcon />
          </button>
        )}
      </div>

      <nav ref={navRef} onKeyDown={onNavKey} className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
        {items.map(item)}
        {!collapsed && children && <div className="mt-4 border-t border-border-subtle pt-3">{children}</div>}
        <div className="mt-auto flex flex-col gap-0.5 pt-2">
          {footerItems.map(item)}
          {collapsed && !narrow && (
            <button type="button" onClick={toggle} title={`Expand sidebar (${sc("B")})`} aria-label="Expand sidebar"
              className="flex h-9 w-full items-center justify-center rounded-lg text-text-3 hover:bg-surface-2 hover:text-text">
              <PanelIcon />
            </button>
          )}
        </div>
      </nav>
    </aside>
  );
}
