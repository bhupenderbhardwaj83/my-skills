"use client";
// Richer, interactive charts for monitoring dashboards (no chart library):
//   TrendBadge · SeverityBadge · SeverityList   — counts with trend, letter + colour (never colour alone)
//   Sparkline / SparkArea                        — small smooth areas with hover value (in lists and cards)
//   MultiLineChart                               — e.g. Opened vs Resolved: crosshair + tooltip with all
//                                                  series and change vs previous point, legend toggles series
//   RingChart                                    — total in the middle, legend with values, hover/legend focus
//   Gauge                                        — a score (0–100 %) with threshold colour and trend
// All: ←/→ step through points when focused, Esc hides the tooltip, aria-label summary.
import { useId, useMemo, useState, type ReactNode } from "react";
import { fmtDefault, niceRange, smoothPath, useWidth, SERIES } from "./dashboard";

/* ── badges ────────────────────────────────────────────────────────────── */

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];
const SEV_VAR: Record<Severity, string> = {
  critical: "var(--sev-critical)", high: "var(--sev-high)", medium: "var(--sev-medium)", low: "var(--sev-low)", info: "var(--sev-info)",
};
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** ▲ 12% — `goodWhenUp: false` for issues, cost, errors (a rise shows as bad). */
export function TrendBadge({ change, goodWhenUp = true }: { change: number; goodWhenUp?: boolean }) {
  const up = change >= 0;
  const good = goodWhenUp ? up : !up;
  const flat = Math.abs(change) < 0.0005;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${flat ? "bg-surface-2 text-text-3" : good ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
      <span aria-hidden>{flat ? "–" : up ? "↑" : "↓"}</span>
      {Math.abs(change * 100).toFixed(Math.abs(change) < 0.1 ? 1 : 0)}%
      <span className="sr-only">{flat ? "no change" : up ? "up" : "down"}</span>
    </span>
  );
}

/** "Critical" pill, or the compact lettered dot (C / H / M / L / I). */
export function SeverityBadge({ level, compact = false }: { level: Severity; compact?: boolean }) {
  const c = SEV_VAR[level];
  if (compact)
    return (
      <span title={cap(level)} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ color: c, background: `color-mix(in srgb, ${c} 16%, transparent)` }}>
        {level[0].toUpperCase()}<span className="sr-only">{level}</span>
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium" style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}>
      {cap(level)}
    </span>
  );
}

/** Open issues by severity: lettered dot · count · label · trend. Click a row to filter by it. */
export function SeverityList({ rows, onSelect }: {
  rows: { level: Severity; count: number; change?: number; label?: string }[];
  onSelect?: (level: Severity) => void;
}) {
  return (
    <ul className="divide-y divide-border-subtle">
      {rows.map((r) => {
        const inner = (
          <>
            <SeverityBadge level={r.level} compact />
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-xl font-semibold tabular-nums text-text">{r.count.toLocaleString()}</span>
              <span className="block text-xs text-text-3">{r.label ?? `${cap(r.level)} issues`}</span>
            </span>
            {r.change != null && <TrendBadge change={r.change} goodWhenUp={false} />}
          </>
        );
        return (
          <li key={r.level}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(r.level)} className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 hover:bg-surface-2">{inner}</button>
            ) : <div className="flex items-center gap-3 px-1 py-2.5">{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/* ── sparkline ─────────────────────────────────────────────────────────── */

/** A small smooth area (no axes) with the value of the hovered point; `color` any CSS colour/var. */
export function Sparkline({ values, labels, color = "var(--chart-1)", height = 48, format = fmtDefault, label }: {
  values: number[]; labels?: string[]; color?: string; height?: number; format?: (n: number) => string; label?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  const max = Math.max(1, ...values), min = Math.min(0, ...values);
  const x = (i: number) => (values.length <= 1 ? 0 : (i * (w - 4)) / (values.length - 1) + 2);
  const y = (v: number) => 3 + (height - 6) * (1 - (v - min) / (max - min || 1));
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smoothPath(pts);
  return (
    <div ref={ref} className="relative" role="img" aria-label={label ?? `Trend, latest ${format(values[values.length - 1] ?? 0)}`}>
      {w > 0 && (
        <svg width={w} height={height} onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(((e.clientX - r.left - 2) / Math.max(1, w - 4)) * (values.length - 1))); }}>
          <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.22} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <path d={`${line} L${pts[pts.length - 1]?.[0] ?? 0},${height} L${pts[0]?.[0] ?? 0},${height} Z`} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
          {hover != null && values[hover] != null && <circle cx={x(hover)} cy={y(values[hover])} r={3.5} fill="var(--surface)" stroke={color} strokeWidth={2} />}
        </svg>
      )}
      {hover != null && values[hover] != null && (
        <div className="pointer-events-none absolute -top-7 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs text-text shadow-calm"
          style={{ left: Math.min(Math.max(x(hover), 40), w - 40) }}>
          {labels?.[hover] && <span className="text-text-3">{labels[hover]} · </span>}<b className="tabular-nums">{format(values[hover])}</b>
        </div>
      )}
    </div>
  );
}

/* ── multi-line with crosshair ─────────────────────────────────────────── */

const PAD = { top: 12, right: 12, bottom: 26, left: 40 };

export function MultiLineChart({ labels, series, height = 240, format = fmtDefault, title, showChange = true, domain = "zero" }: {
  labels: string[];
  series: { name: string; values: number[]; color?: string }[];
  height?: number;
  format?: (n: number) => string;
  title?: string;
  /** Tooltip shows "+3" change since the previous point. */
  showChange?: boolean;
  /** "auto" fits the axis to the data (sensor values, prices); default starts at 0. */
  domain?: "zero" | "auto";
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const gid = useId().replace(/:/g, "");
  const visible = series.map((s, i) => ({ ...s, i, color: s.color ?? SERIES[i % 4] })).filter((s) => !hidden.has(s.i));
  const { bottom, top, step } = useMemo(() => niceRange(visible.flatMap((s) => s.values), domain), [visible, domain]);
  const n = labels.length;
  const xAt = (i: number) => PAD.left + (n <= 1 ? 0 : (i * (w - PAD.left - PAD.right)) / (n - 1));
  const yAt = (v: number) => PAD.top + (height - PAD.top - PAD.bottom) * (1 - (v - bottom) / (top - bottom));
  const ticks: number[] = [];
  for (let v = bottom; v <= top + 1e-9; v += step) ticks.push(Number(v.toPrecision(12)));
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((w - PAD.left) / 70))));
  const toggle = (i: number) => setHidden((h) => { const s = new Set(h); if (s.has(i)) s.delete(i); else if (s.size < series.length - 1) s.add(i); return s; });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-3 text-xs">
        {series.map((s, i) => (
          <button key={i} type="button" onClick={() => toggle(i)} aria-pressed={!hidden.has(i)} title={hidden.has(i) ? `Show ${s.name}` : `Hide ${s.name}`}
            className={`inline-flex items-center gap-1.5 ${hidden.has(i) ? "text-text-disabled line-through" : "text-text-2 hover:text-text"}`}>
            <span className="h-0.5 w-3 rounded-full" style={{ background: s.color ?? SERIES[i % 4] }} />{s.name}
          </button>
        ))}
      </div>
      <div ref={ref} tabIndex={0} role="img" aria-label={title ?? `Line chart: ${series.map((s) => s.name).join(" and ")}`}
        className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
          else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
          else if (e.key === "Escape") setHover(null);
        }} onBlur={() => setHover(null)}>
        {w > 0 && (
          <svg width={w} height={height} onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - PAD.left) / Math.max(1, w - PAD.left - PAD.right)) * (n - 1))))); }}>
            <defs>
              {visible.map((s) => (
                <linearGradient key={s.i} id={`${gid}-${s.i}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.05} /><stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <g fontSize={11} fill="var(--text-3)">
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={w - PAD.right} y1={yAt(v)} y2={yAt(v)} stroke="var(--chart-grid)" strokeDasharray={v === bottom ? undefined : "3 4"} />
                  <text x={PAD.left - 8} y={yAt(v)} dy="0.32em" textAnchor="end">{format(v)}</text>
                </g>
              ))}
              {labels.map((l, i) => (i % every === 0 ? <text key={i} x={xAt(i)} y={height - 8} textAnchor="middle">{l}</text> : null))}
            </g>
            {hover != null && <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={height - PAD.bottom} stroke="var(--border-strong)" strokeDasharray="2 3" />}
            {visible.map((s) => {
              const pts = s.values.map((v, i) => [xAt(i), yAt(v)] as [number, number]);
              const line = smoothPath(pts);
              return (
                <g key={s.i}>
                  <path d={`${line} L${pts[pts.length - 1]?.[0] ?? 0},${yAt(bottom)} L${pts[0]?.[0] ?? 0},${yAt(bottom)} Z`} fill={`url(#${gid}-${s.i})`} />
                  <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" />
                  {hover != null && s.values[hover] != null && <circle cx={xAt(hover)} cy={yAt(s.values[hover])} r={4} fill="var(--surface)" stroke={s.color} strokeWidth={2} />}
                </g>
              );
            })}
          </svg>
        )}
        {hover != null && w > 0 && (
          <div className="pointer-events-none absolute top-2 z-10 min-w-[180px] rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text shadow-calm"
            style={xAt(hover) > w / 2 ? { right: w - xAt(hover) + 12 } : { left: xAt(hover) + 12 }}>
            <div className="mb-1 font-semibold">{labels[hover]}</div>
            {visible.map((s) => {
              const v = s.values[hover] ?? 0, prev = hover > 0 ? s.values[hover - 1] ?? 0 : null, d = prev == null ? null : v - prev;
              return (
                <div key={s.i} className="flex items-center gap-2 py-0.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-text-2">{s.name}</span>
                  <span className="ml-auto font-medium tabular-nums">{format(v)}</span>
                  {showChange && d != null && <span className="w-9 text-right tabular-nums text-text-3">{d > 0 ? "+" : ""}{format(d)}</span>}
                </div>
              );
            })}
            {showChange && hover > 0 && <div className="mt-1 text-text-3">± change since previous point</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ring (donut) ──────────────────────────────────────────────────────── */

export function RingChart({ segments, centerLabel = "Total", size = 140, onSelect }: {
  segments: { label: string; value: number; color: string }[];
  centerLabel?: string;
  size?: number;
  /** Click a legend row / segment → filter by it. */
  onSelect?: (label: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = size / 2 - 10, c = 2 * Math.PI * r, gap = total > 0 && segments.filter((s) => s.value).length > 1 ? 3 : 0;
  let acc = 0;
  const shown = hover != null ? segments[hover] : null;
  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel}: ${total}. ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={10} />
        {total > 0 && segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = s.value > 0 && (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={hover === i ? 13 : 10}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-acc} strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`} opacity={hover != null && hover !== i ? 0.35 : 1}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(s.label)}
              style={{ transition: "opacity 120ms, stroke-width 120ms", cursor: onSelect ? "pointer" : undefined }} />
          );
          acc += len;
          return el;
        })}
        <text x="50%" y="47%" textAnchor="middle" fill="var(--text)" fontSize={size * 0.2} fontWeight={700} className="tabular-nums">{shown ? shown.value : total}</text>
        <text x="50%" y="62%" textAnchor="middle" fill="var(--text-3)" fontSize={11}>{shown ? shown.label : centerLabel}</text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {segments.map((s, i) => (
          <li key={s.label}>
            <button type="button" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              onClick={() => onSelect?.(s.label)}
              className={`flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-sm ${hover === i ? "bg-surface-2" : ""}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 text-left text-text-2">{s.label}</span>
              <span className="tabular-nums text-text">{s.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ring segments for severities, in order, with the severity colours. */
export const severitySegments = (counts: Partial<Record<Severity, number>>) =>
  SEVERITIES.map((l) => ({ label: cap(l), value: counts[l] ?? 0, color: SEV_VAR[l] }));

/* ── gauge ─────────────────────────────────────────────────────────────── */

/** A score on a 240° arc; colour follows thresholds (good ≥ 80, fair ≥ 60, else poor). */
export function Gauge({ value, change, label, size = 180, thresholds = [60, 80] }: {
  /** 0–100 */
  value: number;
  change?: number;
  label?: ReactNode;
  size?: number;
  thresholds?: [number, number];
}) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= thresholds[1] ? "var(--success)" : v >= thresholds[0] ? "var(--warning)" : "var(--danger)";
  const r = size / 2 - 12, cx = size / 2, cy = size / 2;
  const arc = (from: number, to: number) => {
    const a = (d: number) => ((d - 90) * Math.PI) / 180;
    const [x1, y1, x2, y2] = [cx + r * Math.cos(a(from)), cy + r * Math.sin(a(from)), cx + r * Math.cos(a(to)), cy + r * Math.sin(a(to))];
    return `M${x1},${y1} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2},${y2}`;
  };
  const start = -120, end = 120;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`} role="img" aria-label={`Score ${Math.round(v)} percent`}>
        <path d={arc(start, end)} fill="none" stroke="var(--surface-2)" strokeWidth={10} strokeLinecap="round" />
        {v > 0 && <path d={arc(start, start + (end - start) * (v / 100))} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />}
        <text x="50%" y={cy + 4} textAnchor="middle" fill="var(--text)" fontSize={size * 0.24} fontWeight={300} className="tabular-nums">
          {Math.round(v)}<tspan fontSize={size * 0.1}>%</tspan>
        </text>
      </svg>
      <div className="-mt-3 mb-3 flex items-center gap-2 text-xs text-text-3">
        {change != null && <TrendBadge change={change} />}
        {label}
      </div>
    </div>
  );
}
