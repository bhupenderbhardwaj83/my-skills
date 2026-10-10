# Console apps — deep navigation, filtering, detail and an AI assistant

For apps with many areas and lots of data: admin consoles, monitoring and security tools, CRMs,
analytics, internal platforms. The goal is the feel of a top-tier console (think Wiz, Linear,
Datadog): dense information that still reads calmly, and depth that is always one step away —
never all on screen at once. Every component below is in `assets/react/` and tested.

## Contents
1. Shell: IconRail + TopBar + ⌘K
2. Filtering: FilterBar
3. Widgets and charts
4. Tables with depth
5. Detail sub-window (half screen)
6. AI assistant
7. Empty states and announcements
8. Graphs, workflows and diagrams
9. Tree-like disclosure: sections, timelines, correlation
10. Learning in place: help tips and short videos
11. Brevity and icons

---

## 1. Shell

**IconRail** (instead of `Sidebar`) when the app has 5+ areas or areas with sub-pages.
- 72 px rail: logo (home, softly highlighted), icon + tiny label per area, utilities pinned at the
  bottom. Badges for counts that need attention.
- Hovering an area with sub-pages slides out a 256 px flyout with **grouped, collapsible
  sections** (uppercase headers, chevron). Fold state is remembered. Hover intent: opens after
  90 ms, closes 220 ms after the pointer leaves — no flicker when crossing the gap.
- **Pin** (panel icon or ⌘B) docks the flyout for the current area so it pushes the content;
  peeking at another area while pinned floats over it. Pin state is remembered.
- Keyboard: ↑↓ along the rail · → or Enter opens the flyout and focuses its first link · ↑↓ in
  it · ← or Esc back to the rail item.
- Under 768 px: no pinning; the rail stays.
- Group sub-pages by the user's question ("Risk issues" / "Posture issues"), 3–10 links each.

**TopBar**: context switchers on the left (workspace / project / environment as `Menu` buttons
with ▾), then a **Search ⌘K** button, quiet icon actions (help, notifications), the theme toggle,
the avatar. **CommandPalette** (`useCommandPalette()` binds ⌘K / Ctrl+K): every page, sub-page
and frequent action as a `Command`; recent choices first when empty.

## 2. Filtering — FilterBar

Use above any large list or dashboard that slices data.
- 2–4 **primary** fields are always visible as chips; every other field sits under **+ More**
  (adding one opens its picker immediately). This is progressive disclosure for filters.
- A chip reads as a sentence — "Status equals **Open** or **In progress**" — and opens a picker
  with search, multi-select with counts, an equals / is-not switch, Clear and Remove filter.
- Time range presets (24h · 7d · 30d · 90d · 12m) as a `Menu`; **Reset** appears only when
  something is filtered; the result count sits on the right ("43 threats"); `end` holds view
  switches (Table / Board), "Save view…", refresh.
- `filterRows(rows, filters, valueOf, search, textOf)` applies it client-side; on a server, send
  the same `{field, not, values}` objects.
- When filters leave nothing: `EmptyState` with **Clear filters** — never a blank table.

## 3. Widgets and charts

`Widget` = card with title, subtitle (time window), and quiet actions: ⚙ settings, filter, ⋮
menu (View all · Export CSV · Remove). Lay widgets in `grid gap-6` rows of 3–4.

| Question | Component |
|---|---|
| How many, of what severity, trending how? | `SeverityList` (lettered dots, counts, ↑/↓ trend badges; click filters) |
| Share of a total | `RingChart` (total in the middle; hover a segment or legend row; click filters) |
| Two flows over time (opened vs resolved, in vs out) | `MultiLineChart` (crosshair, tooltip with all series + change since previous point, legend toggles series) |
| One score against a target | `Gauge` (threshold colour, trend badge) |
| A small trend inside a row or card | `Sparkline` |
| A KPI | `StatCard` · plain trend: `LineChart` · comparison by period: `BarChart` |

Severity always shows its word or letter with the colour (`SeverityBadge`). Trends that are bad
when rising (issues, cost, errors) use `goodWhenUp={false}`. Charts filter the page when clicked
where that makes sense (a ring segment → severity filter).

## 4. Tables with depth

`DataTable` options for consoles:
- `selectable` + `bulkActions` — checkboxes, "N selected" bar with actions and Clear.
- `expandable(row)` — grouped rows (an alert with 51 related events), → / ← or the chevron.
- `rowHint(row)` — full description on hover / focus of the first cell, so rows can stay one line.
- `tableId` — ⚙ column picker for 5+ columns, remembered.
- `Chips` for many values in one cell: first value + "+50" with the rest on hover.
- `hideSearch` when a FilterBar above already searches.

## 5. Detail sub-window (half screen)

Opening a row shows `DetailDrawer` — a sub-window over the right **half** of the screen with the
list still visible (dimmed) on the left, so the user never loses their place in the overall flow.
- **Controls**: close (Esc) · previous / next (↑/K, ↓/J) float on its left edge; header has
  ⤢ expand to almost full width / restore, ▁ minimize to a small "title · Restore" chip at the
  bottom (the list becomes usable again), and a grip on the left edge to **drag the width**
  (or focus it and press ← / →). The chosen width is remembered.
- Focus moves into the panel and returns to the row on close.
- Inside, lead with the answer, then depth: one-line summary → `RelatedBanner` ("part of threat X
  with 50 related detections → View threat") → `KeyValueGrid` of facts → `Tabs` (Overview ·
  Graph · Timeline · History) → `Section`s collapsed with one-line summaries → `TreeView` for
  hierarchies. A `GraphView` fits well in a tab.

## 6. AI assistant

`AiAssistant` gives every console an assistant without making anything depend on it.
- A pill bottom-right ("✨ Ask …", ⌘I) opens a 420 px side panel: greeting, 3–6 **suggested
  questions written for this screen**, streaming answers with simple formatting, Stop, Copy,
  Try again on errors, history (kept only in this browser) and New chat.
- `context` chip ("Using: Threats · past 30 days") tells the user what the AI can see.
- `available={false}` when no provider is configured or the service is offline: the panel says
  so calmly and offers `setupAction`; the rest of the app works the same.
- `onAsk(messages, signal)` returns a string or an `AsyncIterable<string>`. Pass `signal` to fetch
  so Stop cancels. Example with a streaming HTTP endpoint:

```ts
const onAsk: AskFn = async function* (messages, signal) {
  const res = await fetch("/api/assistant", { method: "POST", body: JSON.stringify({ messages }), signal });
  if (!res.ok || !res.body) throw new Error(`The assistant answered ${res.status}`);
  const reader = res.body.getReader(), dec = new TextDecoder();
  for (;;) { const { done, value } = await reader.read(); if (done) return; yield dec.decode(value, { stream: true }); }
};
```
Keep API keys on the server (the endpoint calls the model provider). Never send secrets or
personal data the user didn't put in the chat. Show the "AI answers can be wrong" line.

## 7. Empty states and announcements

- `EmptyState`: illustration, what happened, the one action that fixes it ("No results found ·
  Try relaxing your filters · [Clear filters]").
- `Announcement`: one dismissible "what's new" card in a corner, remembered once dismissed; with
  an IconRail on the left pass `offset={88}`. At most one at a time; never for errors.

## 8. Graphs, workflows and diagrams

`GraphView` for anything with links: attack paths, pipelines and workflows, service maps,
dependencies, org or process trees. Nodes are small cards (icon · label · one-line sublabel ·
tone · count badge); edges can carry a short label ("443") and be `active`.
- Layout is automatic in layers (left→right, or top→down with the layout button); no manual
  positions to maintain.
- **Navigation**: drag to pan, ctrl/⌘ + wheel or + / − to zoom, 0 fits, F full screen. Arrow
  keys walk the graph; Enter selects.
- **Correlation**: selecting a node keeps it and its neighbours bright and dims the rest; the
  details (1–3 lines) show on hover/focus; `onSelect` opens the full item in the sub-window.
- **Progressive**: double-click or C collapses everything downstream ("12 hidden · Expand all") —
  start large graphs collapsed to the first two layers.
- **Real time**: `live` animates active edges; feed it from `useLiveEvents` and pass `status`
  ("Reconnecting…"), `onPausedChange` to stop applying updates while the user studies it.
  Motion stops under reduced-motion settings.
- Charts stay "modern sleek": smooth monotone lines, rings, gauges, sparklines — no 3D, no pie
  explosions, no rainbow palettes; correlate by linking (click a chart → filter the table,
  select a node → highlight its rows).

## 9. Tree-like disclosure

Show the outline first; each level opens one more level, never everything.
- `Section` — a collapsible block whose closed row still says enough: title · count · tags
  (`Tag` "AI powered") · one-line `summary` · "View all ›". Remember open state with `storageKey`.
- `Timeline` — "what happened": time on the left, an icon, a short title and one line; the rest
  opens in place.
- `RelatedBanner` — one sentence connecting this item to the bigger picture, with one action.
- `TreeView` — real hierarchies (process trees, folders, org charts).

## 10. Learning in place

- `HelpTip` at the top of a page the first time: "Learn about Saved reports" — 1–3 sentences,
  Learn more, Done, and "Show help tips on new pages" (one global switch). Done is remembered.
- `VideoTip` — a 240 px poster with ▶ for a short training clip on exactly this topic (≤ 2 min).
  Nothing loads until played; files play with captions, YouTube links become
  youtube-nocookie, other hosts must be allow-listed. Put one in a HelpTip, an empty state or
  a sub-window tab ("Watch: reading an attack path").

## 11. Brevity and icons

- Every subject gets a **title of 1–4 words and at most one line** of explanation; more lives
  behind "Learn more", a tooltip, a Section or the sub-window.
- Numbers before words: "12 critical" beats "There are twelve critical issues".
- Every navigation item, node type and section gets a **suitable icon** from `icons.tsx` (same
  stroke, 16–20 px), always with its label — never an icon alone without a tooltip/aria-label.
- One icon per meaning across the app (shield = security, bug = vulnerability, key = secret,
  container, server, database, globe = internet, user, cloud, bolt = event, link = related).

