# Components — the defaults every app gets

Both versions behave identically. React: [../assets/react/](../assets/react/) (TypeScript strict,
Tailwind + preset). Plain HTML: [../assets/vanilla/](../assets/vanilla/) (`calm.js` + `calm.css`).

## Contents
1. Theme toggle
2. Search (the keyboard model)
3. Data table
4. Sidebar
5. Dashboard pieces (see dashboards.md for the rules)
6. App shell example
7. Console components → [console.md](console.md) (IconRail, TopBar, CommandPalette, FilterBar,
   Widget, charts, table depth, DetailDrawer, AiAssistant, EmptyState, Announcement, Menu,
   Tooltip, Tabs, TreeView)

---

## 1. Theme toggle

Every app has one, in the header's right corner. Click cycles **Light → Dark → System** (System
follows the OS and its changes); the choice is remembered; the icon shows the current mode and the
tooltip says what comes next.

```tsx
// app/layout.tsx (Next.js App Router) — import from theme-init directly: it has no "use client",
// so this Server Component gets the string (anything from a "use client" file arrives as a reference).
import { themeInitScript } from "@/components/calm/theme-init";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
// header: <ThemeToggle />
```

Plain HTML — first thing in `<head>`, then a button anywhere:
```html
<script>(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();</script>
<button class="calm-icon-btn" data-theme-toggle></button>
```
`suppressHydrationWarning` is needed because the script sets `data-theme` before React hydrates.

## 2. Search — the keyboard model (all search boxes)

| Key | In the search box | In the result list (Tab from the box) |
|---|---|---|
| `/` | — (anywhere else on the page: focuses the first search box visible on screen) | |
| typing | filters instantly; every word must match, any order, accents ignored | |
| ↑ / ↓ | move the highlight (wraps); typing highlights the first match | same |
| Enter | open the highlighted result (or the first) | same |
| Space | types a space — a query can contain spaces | opens the highlighted result |
| Home / End | move the cursor in the text | first / last result |
| Esc | clears the text; on an empty box, leaves it | same |

Why Space only opens from the list: in the box it must type spaces, or multi-word queries break.

Looks: 36 px tall, `rounded-lg`, sunken background, search icon left, a small `/` key hint while
empty, a clear × and "N found" while searching, accent ring on focus, matches softly highlighted.
Empty result: "Nothing matches “…”. Try fewer or different words." — never a blank list.

```tsx
<SearchList
  items={projects}
  getText={(p) => `${p.name} ${p.client} ${p.tags.join(" ")}`}
  getKey={(p) => p.id}
  onOpen={(p) => router.push(`/projects/${p.id}`)}
  placeholder="Find a project"
  renderItem={(p, q) => (<div className="flex gap-2"><Highlight text={p.name} query={q} /><span className="ml-auto text-text-3">{p.client}</span></div>)}
/>
```
Custom layouts (command palette, filtered grids): use `SearchInput` + `useSearchKeys` +
`useSlashToFocus` directly — spread `inputKeys`, `listProps`, `optionProps(i)`.

Plain HTML:
```html
<div data-search-list>
  <input data-search placeholder="Find a project">
  <ul><li data-option><a href="/p/1">Apollo</a></li> …</ul>
</div>
```
Opening fires `calm:open` on the item and follows a link inside it.

## 3. Data table

Use for any tabular data a person scans or exports: search box (same keys; PageUp/PageDown change
page), click a header to sort ascending → descending → original order (`aria-sort` set), page
sizes 10/25/50/100 with "1–10 of 57", and **CSV** downloading exactly the filtered + sorted rows
(UTF-8 with BOM so Excel reads it). Numbers right-aligned with tabular figures; status as soft
badges; header in small caps; rows highlight on hover and keyboard; Enter or click opens a row.

```tsx
const columns: Column<Order>[] = [
  { key: "id", header: "Order", value: (r) => r.id, className: "w-28 font-mono text-text-2" },
  { key: "customer", header: "Customer", value: (r) => r.customer },
  { key: "date", header: "Date", value: (r) => r.date, render: (r) => fmtDate(r.date) },
  { key: "amount", header: "Amount", value: (r) => r.amount, render: (r) => money(r.amount), align: "right" },
];
<DataTable title="Recent orders" rows={orders} columns={columns} getKey={(r) => r.id}
  filename="orders" onRowOpen={(r) => open(r)} />
```
`value` drives search, sort and CSV (return numbers/Dates for correct sorting); `render` is looks.
Server-side data (thousands of rows): keep the same UI, but fetch per page/sort/query instead of
slicing in memory.

Plain HTML: `<div data-table data-filename="orders" data-page-size="10">` with an
`input[data-search]`, a `button[data-csv]`, a `<table>` whose sortable `<th>` have `data-sort`
(`data-sort="number"` for numeric columns; put the raw value in `td[data-value]` when the cell
shows formatted text) and a `<div data-pager>`.

## 4. Sidebar

For apps with several areas. Expanded 240 px: logo mark + app name + collapse button, then icon +
label items (active item: raised background, accent bar on the left, accent icon), utilities
pinned at the bottom. Collapsed 64 px: the **logo mark stays on top, highlighted** (soft accent
tile) and doubles as the home button; items become icons with tooltips; an expand button sits at
the bottom. ⌘B / Ctrl+B toggles; the choice is remembered; below 768 px it collapses on its own.
↑/↓ move between items.

```tsx
<Sidebar logo={<Logo />} appName="Northwind" active={area} onSelect={setArea}
  items={[{ id: "overview", label: "Overview", icon: <HomeIcon /> }, { id: "orders", label: "Orders", icon: <ListIcon />, badge: 57 }]}
  footerItems={[{ id: "settings", label: "Settings", icon: <GearIcon /> }]} />
```
Plain HTML: `aside[data-sidebar]` > `.calm-brand` (`.calm-logo`, `<strong>`, a
`[data-sidebar-toggle]` button) + `<nav>` of links whose text sits in `.calm-label`, plus a
`.calm-expand` `[data-sidebar-toggle]` button at the end.

## 5. Dashboard pieces

`Card` (label + optional action + content), `StatCard` (overline · hero metric · trend badge or
footer), `LineChart`, `BarChart`. Rules and layouts: [dashboards.md](dashboards.md).

## 6. App shell example

```tsx
<div className="flex h-screen bg-bg text-text">
  <Sidebar … />
  <div className="flex min-w-0 flex-1 flex-col">
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-6">
      <h1 className="text-lg font-semibold">Overview</h1>
      <span className="text-sm text-text-3">September 2026</span>
      <span className="ml-auto" />
      <ThemeToggle />
    </header>
    <main className="flex-1 space-y-6 overflow-y-auto p-6">…</main>
  </div>
</div>
```

## Desktop helpers (Tauri / Electron) — `platform.ts`, `TitleBar.tsx`

- `TitleBar` — integrated title bar: empty areas drag the window (Tauri `data-tauri-drag-region`,
  Electron `-webkit-app-region`), room for macOS traffic lights; a plain header on the web.
- `useShortcut()("B")` → "⌘B" on Mac, "Ctrl+B" elsewhere (hydration-safe). Use it in every
  tooltip and menu hint; never hard-code ⌘.
- `shell()` / `isDesktop()` / `isMac()` — branch only where behaviour must differ.
- `openExternal(url)` — https / mailto only; system browser on desktop, new tab on the web.
- Secure starting configs: `assets/desktop/tauri/` (CSP, minimal capabilities, Overlay title bar)
  and `assets/desktop/electron/` (main + preload). See `references/stacks.md`.
