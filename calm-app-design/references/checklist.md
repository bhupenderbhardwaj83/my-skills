# Review checklist — run before calling a UI done

Fix every "no". Say in the summary what was checked and what wasn't.

## Platform (stacks.md)
- [ ] Stack matches the target (or the existing project) and the choice was stated with a reason.
- [ ] Desktop: integrated `TitleBar` with drag region; window min size; panes scroll, not the
      window; native menu / ⌘, Settings / context menus; native file dialogs; links open in the
      system browser; shortcut labels via `useShortcut` (⌘ on Mac, Ctrl elsewhere); works offline.
- [ ] Desktop security: Tauri CSP set + minimal capabilities, or Electron contextIsolation +
      sandbox + no nodeIntegration + tiny preload; sidecar on 127.0.0.1 with `APP_TOKEN`.
- [ ] Web: real URLs with filters / tab / selection in the query string; responsive to 360 px;
      loading and error routes; CSP + security headers from the server.

## Defaults present
- [ ] Theme toggle in the header (Light → Dark → System), remembered, no flash on load.
- [ ] Every search: `/` focuses · ↑↓ highlight · Enter opens · Esc clears then leaves · empty state.
- [ ] Every data table: search, sortable columns (`aria-sort`), pagination with page size, CSV of
      what's shown, numbers right-aligned.
- [ ] Multi-area apps: collapsible sidebar, logo visible in both states, ⌘B, auto-collapse < 768 px.
- [ ] Dashboards follow dashboards.md (three-tier cards, chart rules, gap-6 grid).
- [ ] Console apps (console.md): icon rail with flyouts, ⌘K palette, filter chips with Reset and
      count, widgets with quiet actions, detail drawer instead of page jumps, empty state with
      Clear filters.
- [ ] Detail opens in the half-screen sub-window (close · prev/next · expand · minimize · drag
      width) — the list stays visible behind it.
- [ ] Linked data (paths, workflows, dependencies) uses `GraphView`: fit, zoom, select →
      neighbours highlighted, collapse downstream; live graphs show Live / Reconnecting… and pause.
- [ ] Deep content is a tree: `Section`s with one-line summaries, `Timeline`, `RelatedBanner`.
- [ ] New or complex pages have a `HelpTip` (≤ 3 sentences, Done remembered, global switch);
      training clips use `VideoTip`.
- [ ] AI assistant (if any): screen-specific suggestions, streaming + Stop, context chip, keys on
      the server, and a calm "not set up" state — nothing else depends on it.
- [ ] Code is complete — no placeholder comments; it type-checks / runs as delivered.

## Look
- [ ] Only tokens — no raw hex / rgb in components (`grep -rnE "#[0-9a-fA-F]{3,6}\b" src` finds none
      outside the tokens file).
- [ ] One accent hue on the screen; status colours only where they mean something, never alone
      (paired with icon or word).
- [ ] Body text ≥ 14 px (13 px dense tools); nothing the user must read below 11 px.
- [ ] `python3 scripts/contrast.py` passes for any colour added or changed.
- [ ] Consistent radius per component kind; spacing on the 8 px grid; aligned edges.
- [ ] Looks right in **both themes** (toggle `data-theme`) and at narrow and wide widths.

## Simplicity
- [ ] One primary action per view; the simple path needs no setting changes.
- [ ] Advanced options are behind a section, "More…", or selection — not all visible at once.
- [ ] Every gallery of styles has a None / Plain choice first.
- [ ] Labels are short verbs/nouns; hints are one line; no jargon.
- [ ] Brevity: each subject has a 1–4 word title and at most one line of text; the rest is one
      click away. Every nav item / node type / section has a fitting icon with its label.

## Use
- [ ] Every action works by keyboard; focus ring visible; Tab order = reading order; Esc closes.
- [ ] Lists that can grow have search (`/`) + filters + a helpful empty state.
- [ ] Media/positions are edited by direct manipulation (handles, drag + ‹ › buttons, previews).
- [ ] Long work shows progress and can be stopped; the UI never freezes.
- [ ] Destructive actions confirm with what will happen, risk level and whether it can be undone.
- [ ] Errors explain the fix in plain words.

## Robustness
- [ ] Loading, empty, error and "lots of data" states all designed.
- [ ] `prefers-reduced-motion` respected; animations 120–200 ms.
- [ ] Hit targets ≥ 32 px desktop / 44 px touch; works with zoom at 200 %.
- [ ] Images have alt text; icon-only buttons have `aria-label`; dialogs trap focus.

## Backend (when the app has one — see backend-fastapi.md)
- [ ] All calls go through one `createApi()` instance; errors show `error.message`, form fields
      show `error.fields`; loading / error / retry exist for every fetched view.
- [ ] Large or private lists use server mode (`useServerTable`) with the `Page[T]` contract.
- [ ] Streams (AI, SSE) stop on Stop / unmount; live views reconnect and show their status.
- [ ] The UI works with the backend down: a calm "can't reach the server" state, nothing blank.

## Security (see security.md)
- [ ] `python3 scripts/security_check.py <app>` — no HIGH findings; MEDIUMs reviewed.
- [ ] No user / server / AI content rendered as HTML; URLs from data limited to https / same-site.
- [ ] No secrets in the bundle or `NEXT_PUBLIC_*`; no tokens in localStorage.
- [ ] Backend: exact CORS origins, Pydantic limits and allow-lists, bound SQL params, CSRF on
      cookie writes, ownership checks, generic 500s, rate limits on costly endpoints.
- [ ] CSP set for the site (theme script hash or nonce; `frame-src` only for the video hosts used).
