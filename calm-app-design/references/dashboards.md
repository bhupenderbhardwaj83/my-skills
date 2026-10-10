# Dashboards — data-driven, minimal, desktop-first

A dashboard answers "how are we doing?" in one glance, then lets the reader dig in. Every number
earns its place; decoration never does.

## Layout

- Order: KPI row (3–4 `StatCard`s) → 1–2 trend charts → the detail table → secondary panels.
- Grid on the 8 px system: `grid gap-6` with `sm:grid-cols-2 xl:grid-cols-4` for KPIs and
  `lg:grid-cols-2` for charts. Page padding `p-6`.
- Cards: `rounded-xl border border-border-subtle bg-surface p-6 shadow-sm` (the `Card` component).
  Subtle border + soft shadow — never thick or high-contrast outlines.
- Desktop-first, but nothing breaks at 375 px: grids fall to one column, tables scroll inside
  their card, the sidebar collapses.
- Header shows the period ("September 2026") and, when it applies, a period picker as a
  segmented control (7d · 30d · 90d · 12m) — the one filter most dashboards need.

## Card text: three tiers (always this order)

1. **Overline** — what is measured: `text-xs font-semibold uppercase tracking-wider text-text-3`
2. **Hero metric** — the value, already formatted ("$48.2k", "1,284", "2.4%"):
   `text-3xl font-bold tracking-tight text-text tabular-nums`
3. **Context footer** — comparison window, trend badge or freshness: `text-xs text-text-3`,
   trend as a soft badge (▲ success / ▼ danger; for "lower is better" metrics like churn, cost,
   errors, a rise is shown as bad — `goodWhenUp: false`).

Use the token colours (`text-text-3`, `text-text`), not raw Tailwind greys: they stay readable in
both themes (raw `slate-400` on white is 2.6:1 — too faint for small text).

## Charts (built into LineChart / BarChart)

- **Line:** smooth monotone curves (Fritsch–Carlson — smooth like a Bezier but never overshooting
  the data, so a curve never dips below zero or invents a peak). No point dots until hover/keyboard
  focus. A vertical gradient under the line, starting at ≤ 5 % opacity and fading to 0.
- **Bar:** 4 px rounded top corners, square bottoms. One colour per series; a comparison period
  is the **same colour at 30 % opacity**, drawn beside the current period, with a small legend.
- **Gridlines:** horizontal only, at ~6 % opacity (`--chart-grid`); no vertical lines, no chart
  border. 4–5 round tick values (0, 100, 200, 300).
- **Colours:** `--chart-1…4` (muted, readable in both themes). One series → `chart-1`. Never
  rainbow categories; more than 4 series → small multiples or a table.
- **Interaction:** hover or ←/→ (chart focused) shows a tooltip with the label and exact values;
  Esc hides it. Charts have an `aria-label`; the detail table carries the exact numbers.
- **Formatting:** abbreviate axis values ("$40k"), show exact values in tooltips, keep units.
- No 3D, no pie charts for more than 3 parts (use a bar), no dual y-axes.

## Example

```tsx
<div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
  <StatCard label="Revenue" value="$48.2k" trend={{ change: 0.124, window: "last month" }} />
  <StatCard label="Active users" value="1,284" trend={{ change: 0.031, window: "last month" }} />
  <StatCard label="Churn" value="2.4%" trend={{ change: 0.08, window: "last month", goodWhenUp: false }} />
  <StatCard label="Open tickets" value="17" footer="Updated 5 min ago" />
</div>
<div className="grid gap-6 lg:grid-cols-2">
  <Card label="Revenue trend">
    <LineChart labels={months} series={[{ name: "Revenue", values: revenue }]} format={(n) => `$${n / 1000}k`} />
  </Card>
  <Card label="Signups by month">
    <BarChart labels={months} current={{ name: "2026", values: thisYear }} previous={{ name: "2025", values: lastYear }} />
  </Card>
</div>
<DataTable title="Recent orders" rows={orders} columns={columns} getKey={(r) => r.id} filename="orders" />
```

Plain HTML: `.calm-card` with `.calm-overline`, `.calm-metric`, `.calm-footer` (+ `.calm-badge.up` /
`.down`) inside `.calm-grid`. For charts without React, port `smoothPath` / `barPath` from
`assets/react/dashboard.tsx` (pure functions) or use a library configured to the rules above.
