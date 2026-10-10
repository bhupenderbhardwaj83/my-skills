---
name: calm-app-design
description: House style and stack guide for every app the user builds — desktop apps (Tauri 2 by default, Electron when Node is needed, Python FastAPI sidecars) and web apps (Next.js by default, Vite + React SPA, plain HTML) — picking the right stack for the target and keeping one calm look everywhere: sleek, minimal, highly readable, light + dark themes, deep tree-like progressive disclosure, brief text with fitting icons, keyboard-first, secure by default. Ready-made, tested components: theme toggle, keyboard search, ⌘K command palette, data tables (sort, pages, CSV, selection, expandable rows, server-side mode), sidebar or icon rail with hover flyouts, filter chips, half-screen detail sub-window, interactive real-time graphs / workflows, sleek charts, timelines, help tips with short training videos, AI assistant that works without AI, desktop title bar and platform helpers, secure Tauri / Electron templates, a typed FastAPI client with a tested example backend, plus stack-detection and security-check scripts. Use it whenever building, scaffolding, restyling or reviewing any desktop or web app, screen, page, component, admin console, dashboard, table, graph, workflow, settings, chatbot UI, or the front end of a FastAPI / Python service — even if the user doesn't mention design or names only the platform ("a Mac app", "a web portal").
---

# Calm app design

The user's apps should all feel the same: quiet, clear and quick — only what is needed now,
text that is easy on the eyes, sober colour used for meaning, every action reachable by keyboard.
Mizu Video Studio is the reference product. These are defaults, not decoration: the user expects
them in every new app without having to ask again.

## First: desktop or web?

The look is the same everywhere; the stack and a few conventions differ. Before writing code:

1. **Existing project** → run `python3 scripts/detect_stack.py <project>` and keep that stack
   (never migrate frameworks to apply the style). It says where the components go.
2. **New project** → pick from the target the user describes:

| Target | Default stack | Instead, when… |
|---|---|---|
| **Desktop** (installable, offline, local files/devices, menu bar) | **Tauri 2 + Vite + React + TS + Tailwind**; heavy Python work in a **FastAPI sidecar** | **Electron** when Node-only libraries (serial ports, native addons) or one Chromium everywhere is required |
| **Web** (shared data, login, links, deploy) | **Next.js App Router + TS + Tailwind**, FastAPI behind an `/api` rewrite | **Vite + React SPA** for internal tools without SEO/SSR; **plain HTML** + `calm.js` for tiny pages |

   Unclear target → ask one question; if you can't, shared/multi-user → web, personal tool on
   local files → desktop. State the choice and the reason in one line so the user can redirect.
3. **Read [references/stacks.md](references/stacks.md)** for the chosen stack: project layout,
   the desktop-vs-web UI differences (title bar, no page scroll, native menus and dialogs,
   context menus, ⌘/Ctrl labels, offline vs URL state, responsive web), and how Python plugs in.
   Desktop apps start from [assets/desktop/](assets/desktop/) — secure Tauri config + minimal
   capabilities, or Electron main + preload — and use `TitleBar`, `useShortcut`, `openExternal`.

## Every app gets these by default

| Default | What it means | Ready-made |
|---|---|---|
| **Theme toggle** | A quiet icon button in the header cycling Light → Dark → System, remembered, no flash on load | `ThemeToggle` + `themeInitScript` / `[data-theme-toggle]` |
| **Keyboard search** on anything searchable | `/` focuses it · typing filters instantly · ↑↓ highlight · Enter opens · Esc clears, Esc again leaves | `SearchList`, `SearchInput` + `useSearchKeys` / `[data-search-list]` |
| **Rich tables** for tabular data | search + click-to-sort columns + pagination with page size + Download CSV of what's shown | `DataTable` / `[data-table]` |
| **Collapsible sidebar** for multi-area apps | 240 px with labels ↔ 64 px icon rail; logo always visible and highlighted; ⌘B / Ctrl+B; remembered; auto-collapses on narrow windows | `Sidebar` / `[data-sidebar]` |
| **Dashboards** for metrics | stat cards with three text tiers, smooth line charts, rounded bar charts, faint gridlines | `StatCard`, `Card`, `LineChart`, `BarChart` |
| **⌘K command palette** in any app with 5+ pages or many actions | jump anywhere / run anything from the keyboard, recent first | `CommandPalette` + `useCommandPalette` |
| **AI assistant** when the app has an AI backend (or will) | "✨ Ask …" pill → side panel with suggestions, streaming, history; calm "not set up" state without AI | `AiAssistant` |
| **Detail sub-window** for any item opened from a list | half screen, list still visible; close · prev/next · expand · minimize · drag width | `DetailDrawer` |
| **Graph** for anything linked (paths, workflows, dependencies) | auto-layout, pan/zoom/fit, select → neighbours highlighted, collapse downstream, live flow + pause | `GraphView` |
| **Tree-like depth** for long content | collapsed `Section`s with one-line summaries, `Timeline`, `RelatedBanner`, `TreeView` | `disclosure.tsx` |
| **Help in place** on new or complex pages | brief `HelpTip` (Done remembered) with an optional small `VideoTip` training clip | `HelpTip`, `VideoTip` |
| **Python backend** (FastAPI) | one typed client: readable errors, 422 field messages, timeouts, streams, live events, server-side tables | `createApi`, `useServerTable`, `useResource`, `useLiveEvents` |

**Console apps** — many areas, lots of data (admin, monitoring, security, CRM, analytics): use the
console set instead of the simple shell. Read [references/console.md](references/console.md):
icon rail with hover flyouts and pinning, top bar with context switchers, filter chips that read
as sentences, widgets with interactive charts (severity lists, ring, gauge, crosshair lines,
sparklines), tables with selection / expandable rows / column picker, a detail drawer with
prev/next (a half-screen sub-window), graphs and workflows, sections / timelines / help tips with
short videos, empty states and announcements. Depth is always one step away, never all on screen.

**Brevity.** Every subject gets a 1–4 word title, a fitting icon and at most one line of text;
everything else sits one click deeper (tooltip, Section, sub-window, Learn more). Users scan.

**Backend.** Apps with a Python API (the user mostly uses FastAPI) — read
[references/backend-fastapi.md](references/backend-fastapi.md): make every call through
`assets/react/api.ts` + `useApi.ts`, and start the server from
[assets/fastapi/app.py](assets/fastapi/app.py) (a tested contract for lists, CSV, bulk actions,
streaming AI, Server-Sent Events, CSRF, CORS, security headers).

**Security.** The components never render data as HTML, guard CSV against formulas, sandbox
embeds and keep tokens out of storage. Keep it that way: follow
[references/security.md](references/security.md) and run
`python3 scripts/security_check.py <app-folder>` before finishing — fix every HIGH.

Use the components instead of writing new ones (all live in `assets/react/`, exported from `index.ts`): they are type-checked, keyboard-tested and
already follow every rule below, so a new app starts consistent and correct. Adapt their looks
or props freely; keep their behaviour.

- **React — Next.js, Vite, Tauri, Electron:** copy [assets/react/](assets/react/) into the app
  (e.g. `src/components/calm/`) and import from `index.ts`. Files start with `"use client"` for
  the Next.js App Router (harmless elsewhere). Needs Tailwind with the preset (below).
- **Vue / Svelte / Angular:** use the tokens, preset and patterns; port behaviour from the React
  components rather than mixing frameworks.
- **Plain HTML/CSS/JS:** copy [assets/vanilla/calm.js](assets/vanilla/calm.js) and
  [calm.css](assets/vanilla/calm.css) and use the `data-*` markup documented at the top of
  `calm.js` — no build step, no dependencies.

Details and examples: [references/components.md](references/components.md).

## Setup (once per app)

1. **Tokens.** Copy [assets/tokens.css](assets/tokens.css) into the global stylesheet. With
   Tailwind add [assets/tailwind.preset.js](assets/tailwind.preset.js) to `presets` so classes like
   `bg-surface text-text-2 border-border-subtle` work in both themes. Components never use raw hex.
2. **No theme flash.** Put `themeInitScript` (React) or the same one-line script (see
   components.md) in `<head>` before styles load.
3. **Accent.** Default is Orchid (the MVS look); Teal, Indigo and Amber are ready in
   [references/tokens.md](references/tokens.md). Charts use their own muted series colours.

## Non-negotiables

1. **Minimal.** Remove before you add. One primary action per view. One accent hue per screen.
2. **Progressive disclosure.** Simple path first; advanced options on demand (collapsible
   sections with a one-line summary, "More…", selection, hover trays). Galleries start with None.
3. **Readable, never glaring or faded.** Body 14 px (13 px in dense desktop tools); nothing a user
   must read below 11 px. Only token text colours — they meet WCAG AA in both themes. Any new
   colour gets checked with `python3 scripts/contrast.py "#fg" "#bg"`.
4. **Two themes from the start**, from one set of semantic tokens.
5. **Keyboard-first.** Arrows move, Enter/Space choose, Esc closes or steps back, `/` searches,
   ⌘/Ctrl+Z undoes, focus always visible, shortcut hints shown where they apply.
6. **Direct manipulation over forms** — handles on timelines, drag plus ‹ › buttons, live previews.
7. **Searchable and helpful.** Lists that can grow get search + filters; empty states say what to
   do next; errors say how to fix it.
8. **Uniform.** The same kind of thing works the same way everywhere — that is why the components
   exist.

## Layout and spacing

8 px grid. Cards: 12 px radius (`rounded-xl`), 24 px padding (`p-6`), 24 px gaps between cards
(`gap-6`), a barely-visible border (`border-border-subtle`) and a soft shadow (`shadow-sm`) instead
of strong outlines. App shell: sidebar, 56 px header (title · context · theme toggle), content that
scrolls on its own. Wide tables scroll inside their card, never the page. Full patterns:
[references/patterns.md](references/patterns.md).

## Dashboards

Read [references/dashboards.md](references/dashboards.md) before building any metrics view: card
text tiers (overline → hero metric → context), chart rules (smooth monotone lines, no dots until
hover, faint gradient fill, 4 px rounded bar tops, comparison periods at 30 % opacity, no vertical
gridlines) and grid layouts.

## Finish

Run the [review checklist](references/checklist.md) and `scripts/security_check.py`, and fix what fails. When writing code for the
user, deliver complete files — no "rest of the code here" placeholders — so they drop in and run.

## Writing in the UI

Short, plain, friendly. Labels are nouns or verbs ("Cut…", "Download CSV"); hints are one line
saying what happens. Destructive actions say what happens and whether it can be undone.
