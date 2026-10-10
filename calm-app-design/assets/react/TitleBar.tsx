"use client";
// Desktop title bar for Tauri / Electron windows with a hidden native title bar.
// The empty parts drag the window; buttons and inputs inside stay clickable. On macOS it leaves
// room for the traffic lights; on the web it renders as a plain 56 px header.
//   <TitleBar title="Library" center={<SearchButton/>} end={<ThemeToggle/>} />
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { isMac, shell, type Shell } from "./platform";

export function TitleBar({ title, center, end }: { title?: ReactNode; center?: ReactNode; end?: ReactNode }) {
  const [env, setEnv] = useState<{ shell: Shell; mac: boolean }>({ shell: "web", mac: false });
  useEffect(() => setEnv({ shell: shell(), mac: isMac() }), []);
  const desktop = env.shell !== "web";
  // Tauri: data-tauri-drag-region (needs core:window:allow-start-dragging). Electron: CSS app-region.
  const drag = desktop ? { "data-tauri-drag-region": true, style: { WebkitAppRegion: "drag" } as CSSProperties } : {};
  const noDrag = desktop ? { style: { WebkitAppRegion: "no-drag" } as CSSProperties } : {};
  return (
    <header {...drag}
      className={`flex shrink-0 select-none items-center gap-3 border-b border-border-subtle bg-bg px-4 ${desktop ? "h-11" : "h-14"} ${desktop && env.mac ? "pl-20" : ""}`}>
      {title && <div data-tauri-drag-region={desktop || undefined} className="min-w-0 truncate text-sm font-medium text-text-2">{title}</div>}
      <div data-tauri-drag-region={desktop || undefined} className="flex min-w-0 flex-1 justify-center">
        {center && <div {...noDrag}>{center}</div>}
      </div>
      {end && <div {...noDrag} className="flex items-center gap-1">{end}</div>}
    </header>
  );
}
