"use client";
// Where the UI runs — web browser, Tauri or Electron; macOS, Windows or Linux — so shortcuts read
// right ("⌘B" on Mac, "Ctrl+B" elsewhere) and desktop-only actions have a safe web fallback.
// No dependencies; nothing here imports Tauri or Electron packages.
import { useEffect, useState } from "react";

export type Shell = "web" | "tauri" | "electron";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    /** Exposed by the Electron preload in assets/desktop/electron (contextBridge) — a tiny allow-listed API. */
    calmDesktop?: { platform: string; openExternal: (url: string) => Promise<void> };
  }
}

export function shell(): Shell {
  if (typeof window === "undefined") return "web";
  if (window.__TAURI_INTERNALS__) return "tauri";
  if (window.calmDesktop || /Electron\//.test(navigator.userAgent)) return "electron";
  return "web";
}

export const isDesktop = () => shell() !== "web";
export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** "⌘B" / "Ctrl+B". Pass "shift+K" for "⇧⌘K" / "Ctrl+Shift+K". */
export function shortcutLabel(key: string, mac = isMac()): string {
  const parts = key.split("+");
  const k = parts.pop()!.toUpperCase();
  const shift = parts.some((p) => p.toLowerCase() === "shift");
  return mac ? `${shift ? "⇧" : ""}⌘${k}` : `Ctrl+${shift ? "Shift+" : ""}${k}`;
}

/** Hydration-safe: renders the Mac form on the server and first paint, then the real one. */
export function useShortcut() {
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(isMac()), []);
  return (key: string) => shortcutLabel(key, mac);
}

/** Open a link in the user's browser — only https / mailto. In a desktop app this leaves the app
 *  window untouched (Tauri: opener plugin; Electron: preload bridge); on the web a new tab. */
export async function openExternal(url: string): Promise<void> {
  let u: URL;
  try { u = new URL(url); } catch { return; }
  if (u.protocol !== "https:" && u.protocol !== "mailto:") return;
  const s = shell();
  if (s === "tauri") {
    // Same call `@tauri-apps/plugin-opener`'s openUrl makes; needs the opener plugin and the
    // "opener:allow-open-url" permission (see assets/desktop/tauri). No package import needed here.
    const t = window.__TAURI_INTERNALS__ as { invoke: (cmd: string, args: unknown) => Promise<void> };
    return t.invoke("plugin:opener|open_url", { url: u.toString() });
  }
  if (s === "electron" && window.calmDesktop) return window.calmDesktop.openExternal(u.toString());
  window.open(u.toString(), "_blank", "noopener,noreferrer");
}
