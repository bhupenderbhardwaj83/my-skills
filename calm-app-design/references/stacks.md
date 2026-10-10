# Choosing the stack — desktop or web

The look and the components are the same everywhere; the **shell around them** changes. Decide
the target first, because it changes the project layout, security model, data access and a few
UI conventions.

## Contents
1. Detect what already exists
2. New project: pick by target
3. What changes between desktop and web (UI)
4. Desktop stacks: Tauri (default) and Electron
5. Web stacks: Next.js (default), Vite SPA, plain HTML
6. Python backends in each stack

## 1. Detect what already exists

Run `python3 scripts/detect_stack.py <project-folder>`. It reads `src-tauri/`, `package.json`,
`pyproject.toml` / `requirements*.txt` and prints the stack, where the components go and which
reference to read. **An existing project keeps its stack** — never migrate an app to another
framework to apply the house style; restyle in place.

Signals it uses: `src-tauri/tauri.conf.json` → Tauri · `electron` dependency → Electron ·
`next` → Next.js · `vite` + `react` → Vite SPA · only `.html` files → plain HTML ·
`fastapi` / `flask` / `django` → Python backend · `pywebview` → Python desktop window.
Vue / Svelte / Angular apps: use `tokens.css` + the patterns and port behaviour; the React
components don't drop in.

## 2. New project: pick by target

Read the request for the target. Words like *desktop app, Mac app, Windows app, offline, menu bar,
local files, native, installer, DMG, tray* → **desktop**. *Website, web app, portal, SaaS,
dashboard for my team, share a link, login, deploy, mobile browser* → **web**. If it is truly
unclear, ask one question ("Desktop app you install, or a web app in the browser?"); if the user
can't be asked, choose web for multi-user / shared data and desktop for personal tools working
on local files or devices.

| Target | Default stack | Choose instead when… |
|---|---|---|
| **Desktop** | **Tauri 2 + Vite + React + TypeScript + Tailwind** (Rust core; small, fast, secure; the MVS stack) | **Electron + Vite + React + TS** when the app needs Node-only libraries (serialport, native Node addons), identical Chromium rendering on every OS, or an existing Electron codebase |
| Desktop with heavy Python (AI, media, data) | Tauri + **FastAPI sidecar** on 127.0.0.1 (like MVS) | `pywebview` + FastAPI only for a tiny personal tool with no installer needs |
| **Web** | **Next.js (App Router) + TypeScript + Tailwind**, FastAPI backend behind a `/api` rewrite | **Vite + React SPA** for an internal tool behind login with no SEO/SSR needs, or when FastAPI serves the built files itself |
| Tiny page / no build | plain HTML + `calm.js` / `calm.css` | — |

Say the choice and the one-line reason in the reply ("Desktop → Tauri 2: small installer,
offline, native file access"), so the user can redirect early.

## 3. What changes between desktop and web (UI)

Same tokens, components, keyboard model, themes and checklist. These differ:

| | Desktop app | Web app |
|---|---|---|
| Frame | Full-window app shell; **no page scroll** — panes scroll. Integrated title bar (`TitleBar`, drag region, room for the macOS traffic lights) | Normal document; header + content; page may scroll on marketing / public pages |
| Density | 13 px body allowed, 28–32 px controls, more on screen | 14 px body, 36–40 px controls; responsive down to 360 px |
| Navigation | Sidebar / IconRail + ⌘K; **native menu bar** mirrors the palette (File, Edit, View, Window, Help) with the same accelerators; ⌘, opens Settings; ⌘W closes the window | Real URLs for every view; filters, tab and selected item **in the query string** so links are shareable and Back works |
| Shortcut labels | `useShortcut()` → ⌘ on macOS, Ctrl on Windows/Linux | same (browsers reserve some keys: avoid ⌘W, ⌘T, ⌘N) |
| Files | Native open/save dialogs (Tauri `plugin-dialog`, Electron `dialog`), drag & drop onto the window, recent files | `<input type="file">` + drop zone; downloads via Blob |
| Right-click | Context menus on rows, nodes and canvases (`Menu`) — users expect them | Optional |
| Links out | `openExternal()` → system browser; the app window never navigates away | `<a target="_blank" rel="noopener noreferrer">` |
| Data | Local first: works offline; local DB / files; sidecar on 127.0.0.1 | Server is the source of truth; loading skeletons; optimistic updates |
| State | Remember window size/position (Tauri `plugin-window-state`), last view, panel widths | Remember per user on the server when it must follow them across devices |
| Long work | Background (Rust task / sidecar job) with progress events and a cancel; GPU first with CPU fallback; never block the UI thread | Background job + polling or SSE; never a request that waits minutes |
| Updates | Signed auto-update with a quiet "Restart to update" | Deploys are instant; show "New version — reload" only for long-lived tabs |
| Errors | "The engine isn't running — Restart services" with a button | "Can't reach the server" + Try again |
| Not used | 404 pages, cookie banners, SEO meta, "open in new tab" | Native menus, title bar, window controls |

## 4. Desktop stacks

### Tauri 2 (default)
```
app/
  src/                 React UI (copy assets/react → src/components/calm)
  src/main.tsx         themeInitScript inline in index.html <head>
  index.html
  src-tauri/
    tauri.conf.json    from assets/desktop/tauri/tauri.conf.json
    capabilities/default.json   from assets/desktop/tauri/capabilities.default.json
    src/main.rs        commands; spawn the sidecar; pass it a random token
  sidecar/ (optional)  FastAPI engine, bundled as externalBin
```
- Scaffold: `pnpm create tauri-app` (React + TypeScript + Vite), then add Tailwind + the preset.
- Plugins as needed: `opener` (links), `dialog` (files), `window-state`, `updater`, `fs`
  (scoped to app folders), `shell` only for the sidecar.
- Window: `titleBarStyle: "Overlay"` + `hiddenTitle` on macOS, `minWidth` 900 × `minHeight` 600;
  put `<TitleBar>` at the top of the app shell.
- **Security**: strict `app.security.csp` (in the template); capabilities list only what the
  window needs — never `fs:default` on `$HOME`, never `shell:allow-execute` for arbitrary
  commands; validate every `#[tauri::command]` argument in Rust; keep secrets in the OS keychain
  (keyring crate), not in the frontend.
- Heavy work: Rust `tauri::async_runtime::spawn` or the Python sidecar; report progress with
  events; the UI shows it with a progress bar and Cancel.

### Electron (when Node is needed)
```
app/
  electron/main.ts     from assets/desktop/electron/main.ts
  electron/preload.ts  from assets/desktop/electron/preload.ts
  src/                 React UI (Vite) — same as web
```
- Scaffold with `electron-vite` (React + TS). Copy the two templates — they set
  `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, block navigation and new
  windows, deny permission requests, set a CSP and expose a tiny allow-listed `calmDesktop` API.
- Node work (serial ports, native addons) happens in **main** behind `ipcMain.handle` channels
  that validate input; the renderer never gets `require`, `fs` or raw `ipcRenderer`.
- Sign and notarise builds; enable `electron-updater` with signed releases; turn on Electron
  fuses (`runAsNode: false`, `enableNodeOptionsEnvironmentVariable: false`).

## 5. Web stacks

### Next.js (default)
- `create-next-app` (TypeScript, Tailwind, App Router, `src/`). Components in
  `src/components/calm`; `themeInitScript` in `app/layout.tsx` `<head>`; `suppressHydrationWarning`
  on `<html>`.
- Pages are Server Components; interactive parts import the calm components (they are
  `"use client"`). Keep data fetching on the server where possible; client fetches go through
  `createApi()`.
- `next.config` → `rewrites` `/api/:path*` to FastAPI (same origin, no CORS) + security headers
  and CSP (security.md). Route `loading.tsx` shows skeletons; `error.tsx` shows the calm error.
- Shareable state: put filters / tab / selected id into `useSearchParams`.

### Vite + React SPA
- `pnpm create vite` (react-ts) + Tailwind. `server.proxy` `/api` → FastAPI in dev; in production
  FastAPI (or the proxy) serves `dist/` and `/api` from one origin. Use a router (React Router)
  with real URLs. CSP via the server's headers.

### Plain HTML
- `calm.css` + `calm.js` + `data-*` markup; fetch from `/api` with `textContent` rendering.

## 6. Python backends in each stack

Same contract everywhere (`backend-fastapi.md`), different wiring:

| Stack | How the UI reaches FastAPI |
|---|---|
| Next.js | `rewrites` → `http://127.0.0.1:8000`; `createApi()` with no base URL |
| Vite SPA | dev `server.proxy`; prod same origin |
| Tauri | sidecar on `127.0.0.1:<random port>`; Rust passes port + token to the UI (`invoke("engine_info")`); `createApi({ baseUrl, headers: { "X-App-Token": token } })`; FastAPI started with `APP_TOKEN` and `ALLOWED_ORIGINS=tauri://localhost,http://tauri.localhost`; `connect-src` in the CSP lists `http://127.0.0.1:*` |
| Electron | same as Tauri; main process starts the sidecar and hands port + token over the preload bridge |
| pywebview | FastAPI serves the UI and API on 127.0.0.1 with the token in the page context |

Restarting a sidecar is a user action ("Restart services" button in the app), never a shell step
from an agent.
