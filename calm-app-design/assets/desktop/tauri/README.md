# Tauri 2 starter files (calm-app-design)

1. `pnpm create tauri-app` → React + TypeScript (Vite). Add Tailwind 3 with the calm preset.
2. Copy `tauri.conf.json` over `src-tauri/tauri.conf.json` (keep your productName / identifier)
   and `capabilities.default.json` to `src-tauri/capabilities/default.json`.
3. Plugins used by the template: `pnpm tauri add opener`, `pnpm tauri add dialog`,
   `pnpm tauri add window-state`. Remove a permission line if you drop a plugin.
4. Copy `assets/react` to `src/components/calm`. In `index.html` `<head>` add the theme script
   (`themeInitScript` text) inline — Tauri hashes inline scripts into the CSP at build time.
5. App shell: `<TitleBar>` on top, then `Sidebar`/`IconRail` + content; `html, body, #root { height: 100% }`
   and `overflow: hidden` on body — panes scroll, the window doesn't.
6. Python engine (optional): bundle as `bundle.externalBin`, start it from Rust with a random
   `APP_TOKEN` and port, pass both to the UI through a command, and call it with
   `createApi({ baseUrl: \`http://127.0.0.1:${port}\`, headers: { "X-App-Token": token } })`.
   Add `http://127.0.0.1:*` to `connect-src` (already in the template).
