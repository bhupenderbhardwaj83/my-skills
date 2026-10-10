"use client";
// Dashboard building blocks: Card, StatCard, LineChart, BarChart — no chart library needed.
// Card: 12 px radius, 24 px padding, subtle border + soft shadow; grids use gap-6 (24 px).
// Card text follows three tiers: OVERLINE label → hero metric → context footer.
// Charts: smooth monotone curves (never overshoot the data), no dots until hover, a faint
// gradient under lines, bars with 4 px rounded tops, one colour per series (comparison periods
// at 30 % opacity), no vertical gridlines, horizontal ones barely visible. ←/→ step through points.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

/* ── cards ─────────────────────────────────────────────────────────────── */

export function Card({ label, action, children, className = "" }: {
  label?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border-subtle bg-surface p-6 shadow-sm ${className}`}>
      {(label || action) && (
        <div className="mb-4 flex items-center gap-3">
          {label && <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">{label}</h3>}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, trend, footer }: {
  /** Overline: what is measured. */
  label: string;
  /** Hero metric, already formatted ("$48.2k", "1,284"). */
  value: string;
  /** Change vs a comparison window: 0.12 = +12 %. `goodWhenUp: false` for churn, errors, cost. */
  trend?: { change: number; window: string; goodWhenUp?: boolean };
  /** Context footer when there's no trend: "Updated 5 min ago". */
  footer?: ReactNode;
}) {
  const up = (trend?.change ?? 0) >= 0;
  const good = trend ? (trend.goodWhenUp === false ? !up : up) : true;
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-3">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-text tabular-nums">{value}</p>
      <div className="mt-3 flex items-center gap-2 text-xs text-text-3">
        {trend && (
          <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium ${good ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
            <span aria-hidden>{up ? "▲" : "▼"}</span>
            {Math.abs(trend.change * 100).toFixed(Math.abs(trend.change) < 0.1 ? 1 : 0)}%
            <span className="sr-only">{up ? "up" : "down"}</span>
          </span>
        )}
        {trend ? <span>vs {trend.window}</span> : footer}
      </div>
    </Card>
  );
}

/* ── chart helpers ─────────────────────────────────────────────────────── */

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** A round axis maximum: 0–4 gridlines at 1, 2, 2.5 or 5 × 10ⁿ steps. */
export function niceScale(max: number, ticks = 4) {
  if (!(max > 0)) return { top: 1, step: 0.25 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  return { top: step * Math.ceil(max / step), step };
}

/** Axis range. "zero" starts at 0 (counts, money); "auto" fits the data (temperatures, pressure,
 *  prices) so small changes on a large value stay visible. */
export function niceRange(values: number[], domain: "zero" | "auto" = "zero", ticks = 4) {
  if (domain === "zero" || values.length === 0) return { bottom: 0, ...niceScale(Math.max(0, ...values), ticks) };
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi === lo) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / ticks, mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const bottom = Math.floor(lo / step) * step;
  return { bottom, top: Math.max(bottom + step, Math.ceil(hi / step) * step), step };
}

/** Monotone cubic (Fritsch–Carlson) through the points: smooth, and never bulges past the data. */
export function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
  t.push(m[n - 2]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + h * t[i]} ${pts[i + 1][0] - h},${pts[i + 1][1] - h * t[i + 1]} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

const PAD = { top: 12, right: 12, bottom: 26, left: 44 };
export const fmtDefault = (n: number) => (Math.abs(n) >= 1000 ? `${+(n / 1000).toFixed(1)}k` : `${+n.toFixed(2)}`);
export const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function Axes({ w, h, top, step, format, labels, xAt, bottom = 0 }: {
  w: number; h: number; top: number; step: number; format: (n: number) => string; bottom?: number;
  labels: string[]; xAt: (i: number) => number;
}) {
  const ys: number[] = [];
  for (let v = bottom; v <= top + 1e-9; v += step) ys.push(Number(v.toPrecision(12)));
  const every = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor((w - PAD.left) / 64))));
  const y = (v: number) => PAD.top + (h - PAD.top - PAD.bottom) * (1 - (v - bottom) / (top - bottom));
  return (
    <g fontSize={11} fill="var(--text-3)">
      {ys.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" />
          <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end">{format(v)}</text>
        </g>
      ))}
      {labels.map((l, i) => (i % every === 0 ? <text key={i} x={xAt(i)} y={h - 8} textAnchor="middle">{l}</text> : null))}
    </g>
  );
}

function Tooltip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 70), w - 70);
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text shadow-calm"
      style={{ left, top: y - 10 }}>
      {children}
    </div>
  );
}

/* ── line chart ────────────────────────────────────────────────────────── */

export function LineChart({ labels, series, height = 240, format = fmtDefault, fillOpacity = 0.05, title, domain = "zero" }: {
  labels: string[];
  series: { name: string; values: number[]; color?: string }[];
  height?: number;
  format?: (n: number) => string;
  /** Strength of the gradient under each line (its top edge); it fades to 0. */
  fillOpacity?: number;
  /** Read out to screen readers. */
  title?: string;
  /** "auto" fits the axis to the data (sensor values, prices); default starts at 0. */
  domain?: "zero" | "auto";
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  const { bottom, top, step } = useMemo(() => niceRange(series.flatMap((s) => s.values), domain), [series, domain]);
  const n = labels.length;
  const xAt = (i: number) => PAD.left + (n <= 1 ? 0 : (i * (w - PAD.left - PAD.right)) / (n - 1));
  const yAt = (v: number) => PAD.top + (height - PAD.top - PAD.bottom) * (1 - (v - bottom) / (top - bottom));
  const pick = (clientX: number, el: Element) => {
    const x = clientX - el.getBoundingClientRect().left;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((x - PAD.left) / Math.max(1, w - PAD.left - PAD.right)) * (n - 1)))));
  };
  return (
    <div ref={ref} className="relative outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg" tabIndex={0}
      role="img" aria-label={title ?? `Line chart: ${series.map((s) => s.name).join(", ")}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
        else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
        else if (e.key === "Escape") setHover(null);
      }}
      onBlur={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} onMouseMove={(e) => pick(e.clientX, e.currentTarget)} onMouseLeave={() => setHover(null)}>
          <defs>
            {series.map((s, si) => (
              <linearGradient key={si} id={`${gid}-f${si}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? SERIES[si % 4]} stopOpacity={fillOpacity} />
                <stop offset="100%" stopColor={s.color ?? SERIES[si % 4]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <Axes w={w} h={height} bottom={bottom} top={top} step={step} format={format} labels={labels} xAt={xAt} />
          {series.map((s, si) => {
            const pts = s.values.map((v, i) => [xAt(i), yAt(v)] as [number, number]);
            const line = smoothPath(pts);
            const base = yAt(bottom);
            return (
              <g key={si}>
                <path d={`${line} L${pts[pts.length - 1]?.[0] ?? 0},${base} L${pts[0]?.[0] ?? 0},${base} Z`} fill={`url(#${gid}-f${si})`} />
                <path d={line} fill="none" stroke={s.color ?? SERIES[si % 4]} strokeWidth={2} strokeLinecap="round" />
                {hover != null && s.values[hover] != null && (
                  <circle cx={xAt(hover)} cy={yAt(s.values[hover])} r={4} fill="var(--surface)" stroke={s.color ?? SERIES[si % 4]} strokeWidth={2} />
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && w > 0 && (
        <Tooltip x={xAt(hover)} y={Math.min(...series.map((s) => yAt(s.values[hover] ?? 0)))} w={w}>
          <div className="mb-0.5 text-text-3">{labels[hover]}</div>
          {series.map((s, si) => (
            <div key={si} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color ?? SERIES[si % 4] }} />
              {series.length > 1 && <span className="text-text-2">{s.name}</span>}
              <span className="ml-auto font-medium tabular-nums">{format(s.values[hover] ?? 0)}</span>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  );
}

/* ── bar chart ─────────────────────────────────────────────────────────── */

/** A bar with rounded top corners only (radius r). */
export function barPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export function BarChart({ labels, current, previous, height = 240, format = fmtDefault, color = "var(--chart-1)", title }: {
  labels: string[];
  /** This period — full colour. */
  current: { name: string; values: number[] };
  /** Comparison period — same colour at 30 % opacity. */
  previous?: { name: string; values: number[] };
  height?: number;
  format?: (n: number) => string;
  color?: string;
  title?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const { top, step } = useMemo(
    () => niceScale(Math.max(0, ...current.values, ...(previous?.values ?? []))), [current, previous]);
  const plotW = Math.max(1, w - PAD.left - PAD.right);
  const slot = plotW / Math.max(1, n);
  const groupW = Math.min(slot * 0.62, previous ? 44 : 28);
  const barW = previous ? (groupW - 3) / 2 : groupW;
  const xAt = (i: number) => PAD.left + slot * i + slot / 2;
  const yAt = (v: number) => PAD.top + (height - PAD.top - PAD.bottom) * (1 - v / top);
  const base = yAt(0);
  return (
    <div className="space-y-3">
      <div ref={ref} className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus" tabIndex={0}
        role="img" aria-label={title ?? `Bar chart: ${current.name}${previous ? ` compared with ${previous.name}` : ""}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
          else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
          else if (e.key === "Escape") setHover(null);
        }}
        onBlur={() => setHover(null)}>
        {w > 0 && (
          <svg width={w} height={height} onMouseLeave={() => setHover(null)}>
            <Axes w={w} h={height} top={top} step={step} format={format} labels={labels} xAt={xAt} />
            {labels.map((_, i) => {
              const cx = xAt(i);
              const cur = current.values[i] ?? 0;
              const prev = previous?.values[i];
              const dim = hover != null && hover !== i;
              return (
                <g key={i} onMouseEnter={() => setHover(i)} opacity={dim ? 0.55 : 1}>
                  <rect x={cx - slot / 2} y={PAD.top} width={slot} height={base - PAD.top} fill="transparent" />
                  {previous && prev != null && (
                    <path d={barPath(cx - groupW / 2, yAt(prev), barW, base - yAt(prev))} fill={color} fillOpacity={0.3} />
                  )}
                  <path d={barPath(previous ? cx + 1.5 : cx - barW / 2, yAt(cur), barW, base - yAt(cur))} fill={color} />
                </g>
              );
            })}
          </svg>
        )}
        {hover != null && w > 0 && (
          <Tooltip x={xAt(hover)} y={yAt(Math.max(current.values[hover] ?? 0, previous?.values[hover] ?? 0))} w={w}>
            <div className="mb-0.5 text-text-3">{labels[hover]}</div>
            <div className="flex gap-3"><span className="text-text-2">{current.name}</span><span className="ml-auto font-medium tabular-nums">{format(current.values[hover] ?? 0)}</span></div>
            {previous && <div className="flex gap-3"><span className="text-text-2">{previous.name}</span><span className="ml-auto tabular-nums">{format(previous.values[hover] ?? 0)}</span></div>}
          </Tooltip>
        )}
      </div>
      {previous && (
        <div className="flex gap-4 text-xs text-text-3">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{current.name}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color, opacity: 0.3 }} />{previous.name}</span>
        </div>
      )}
    </div>
  );
}
