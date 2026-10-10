"use client";
// Interactive graph / workflow / diagram (no library): attack paths, pipelines, process flows,
// dependencies, org or network maps. Auto-layout in layers (left→right or top→down).
//   Pan: drag · Zoom: pinch / ctrl+wheel, + / − · Fit: 0 · Full screen: F · Layout switch
//   Select a node (click / Enter): it and its neighbours stay bright, the rest dims — correlation
//   at a glance. Double-click (or C) collapses / expands everything downstream of a node.
//   Keys: → next step · ← previous · ↑↓ siblings · Esc clear. Live graphs: animated active edges
//   with a pause control; updates arrive through props.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useWidth } from "./dashboard";
import { ExpandIcon, FitIcon, LayoutIcon, PauseIcon, PlayIcon, ShrinkIcon, ZoomInIcon, ZoomOutIcon } from "./icons";

export type Tone = "default" | "accent" | "critical" | "high" | "medium" | "low" | "ok" | "muted";
export interface GraphNode {
  id: string;
  label: string;
  /** Second line: type or one fact ("Kubernetes container"). Keep it short. */
  sublabel?: string;
  icon?: ReactNode;
  tone?: Tone;
  /** Small count bubble (related items). */
  badge?: number;
  /** Shown on hover / focus — 1–3 short lines. */
  details?: string[];
}
export interface GraphEdge { from: string; to: string; label?: string; active?: boolean; tone?: Tone }

const TONE: Record<Tone, string> = {
  default: "var(--border-strong)", accent: "var(--accent-text)", critical: "var(--sev-critical)", high: "var(--sev-high)",
  medium: "var(--sev-medium)", low: "var(--sev-low)", ok: "var(--success)", muted: "var(--text-disabled)",
};
const R = 26;            // node radius
const GAP_LAYER = 210;   // distance between steps
const GAP_ROW = 110;     // distance between nodes of one step

/** Longest-path layers + one barycentre pass (fewer crossings). Cycles are tolerated. */
function layout(nodes: GraphNode[], edges: GraphEdge[], dir: "LR" | "TB") {
  const ids = nodes.map((n) => n.id);
  const parents = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const e of edges) if (parents.has(e.to) && parents.has(e.from)) parents.get(e.to)!.push(e.from);
  const layer = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (id: string): number => {
    if (layer.has(id)) return layer.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const d = Math.max(-1, ...(parents.get(id) ?? []).map(depth)) + 1;
    visiting.delete(id);
    layer.set(id, d);
    return d;
  };
  ids.forEach(depth);
  const layers: string[][] = [];
  ids.forEach((id) => (layers[layer.get(id)!] ??= []).push(id));
  const row = new Map<string, number>();
  layers.forEach((L, li) => {
    if (li > 0) {
      const bary = (id: string) => { const ps = parents.get(id)!.filter((p) => row.has(p)); return ps.length ? ps.reduce((s, p) => s + row.get(p)!, 0) / ps.length : 0; };
      L.sort((a, b) => bary(a) - bary(b));
    }
    L.forEach((id, i) => row.set(id, i - (L.length - 1) / 2));
  });
  const pos = new Map<string, { x: number; y: number }>();
  ids.forEach((id) => {
    const a = (layer.get(id) ?? 0) * GAP_LAYER, b = (row.get(id) ?? 0) * GAP_ROW;
    pos.set(id, dir === "LR" ? { x: a, y: b } : { x: b, y: a });
  });
  return { pos, layer, layers };
}

const ctl = "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-2 shadow-sm hover:text-text";

export function GraphView({ nodes, edges, height = 360, selected: selectedProp, onSelect, live = false, status = "live", onPausedChange, title, defaultDirection = "LR", emptyText = "Nothing to show yet." }: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  height?: number;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  /** Real-time graph: shows a Live dot and a pause control; active edges flow. */
  live?: boolean;
  /** Connection state from useLiveEvents: "reconnecting" shows an amber dot. */
  status?: "live" | "reconnecting" | "stopped";
  /** Pause / resume: stop applying (or subscribing to) updates while paused. */
  onPausedChange?: (paused: boolean) => void;
  title?: string;
  defaultDirection?: "LR" | "TB";
  emptyText?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [dir, setDir] = useState<"LR" | "TB">(defaultDirection);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [own, setOwn] = useState<string | null>(null);
  const selected = selectedProp !== undefined ? selectedProp : own;
  const select = useCallback((id: string | null) => { setOwn(id); onSelect?.(id); }, [onSelect]);
  const [hover, setHover] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const [full, setFull] = useState(false);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  // Hide everything reachable only through a collapsed node.
  const visible = useMemo(() => {
    const kids = new Map<string, string[]>();
    edges.forEach((e) => (kids.get(e.from) ?? kids.set(e.from, []).get(e.from)!).push(e.to));
    const hidden = new Set<string>();
    const hide = (id: string) => (kids.get(id) ?? []).forEach((c) => {
      const otherParents = edges.filter((e) => e.to === c && e.from !== id && !hidden.has(e.from) && !collapsed.has(e.from));
      if (!otherParents.length && !hidden.has(c)) { hidden.add(c); hide(c); }
    });
    collapsed.forEach(hide);
    return { nodes: nodes.filter((n) => !hidden.has(n.id)), edges: edges.filter((e) => !hidden.has(e.from) && !hidden.has(e.to)), hiddenCount: hidden.size };
  }, [nodes, edges, collapsed]);
  const { pos, layer, layers } = useMemo(() => layout(visible.nodes, visible.edges, dir), [visible, dir]);
  const childCount = useMemo(() => { const m = new Map<string, number>(); edges.forEach((e) => m.set(e.from, (m.get(e.from) ?? 0) + 1)); return m; }, [edges]);

  const h = full ? window.innerHeight - 32 : height;
  const fit = useCallback(() => {
    if (!w || !pos.size) return;
    const xs = [...pos.values()].map((p) => p.x), ys = [...pos.values()].map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs) - 90, Math.max(...xs) + 90, Math.min(...ys) - 60, Math.max(...ys) + 70];
    const k = Math.max(0.3, Math.min(1, Math.min(w / (x1 - x0), h / (y1 - y0)))); // never enlarge: small graphs stay crisp, centred
    setView({ k, x: w / 2 - ((x0 + x1) / 2) * k, y: h / 2 - ((y0 + y1) / 2) * k });
  }, [w, h, pos]);
  // Re-fit only when the set of nodes, the layout, the size or full screen changes — live value
  // updates keep the user's pan and zoom.
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const idsKey = visible.nodes.map((n) => n.id).join("|");
  useEffect(() => { fitRef.current(); }, [idsKey, dir, w, full]);
  const zoom = (f: number, cx = w / 2, cy = h / 2) => setView((v) => {
    const k = Math.max(0.25, Math.min(3, v.k * f));
    return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
  });

  const neighbours = useMemo(() => {
    if (!selected) return null;
    const s = new Set([selected]);
    visible.edges.forEach((e) => { if (e.from === selected) s.add(e.to); if (e.to === selected) s.add(e.from); });
    return s;
  }, [selected, visible.edges]);
  const toggleCollapse = (id: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === "+" || k === "=") { e.preventDefault(); zoom(1.2); return; }
    if (k === "-") { e.preventDefault(); zoom(1 / 1.2); return; }
    if (k === "0") { e.preventDefault(); fit(); return; }
    if (k.toLowerCase() === "f") { e.preventDefault(); setFull((f) => !f); return; }
    if (k === "Escape") { if (full) setFull(false); else select(null); return; }
    const cur = selected ?? visible.nodes[0]?.id;
    if (!cur) return;
    const out = visible.edges.filter((x) => x.from === cur).map((x) => x.to);
    const inc = visible.edges.filter((x) => x.to === cur).map((x) => x.from);
    const L = layers[layer.get(cur) ?? 0] ?? [];
    const i = L.indexOf(cur);
    const next =
      k === (dir === "LR" ? "ArrowRight" : "ArrowDown") ? out[0] :
      k === (dir === "LR" ? "ArrowLeft" : "ArrowUp") ? inc[0] :
      k === (dir === "LR" ? "ArrowDown" : "ArrowRight") ? L[i + 1] :
      k === (dir === "LR" ? "ArrowUp" : "ArrowLeft") ? L[i - 1] : undefined;
    if (k.startsWith("Arrow")) { e.preventDefault(); select(next ?? cur); }
    else if (k === "Enter" && !selected) { e.preventDefault(); select(cur); }
    else if ((k === "Enter" || k.toLowerCase() === "c") && selected && childCount.get(selected)) { e.preventDefault(); toggleCollapse(selected); }
  };
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest("[data-node]")) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) d.moved = true;
    setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
  };
  const onUp = () => { if (drag.current && !drag.current.moved) select(null); drag.current = null; };

  const edgePath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    if (dir === "LR") { const mx = (a.x + b.x) / 2; return `M${a.x + R},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x - R},${b.y}`; }
    const my = (a.y + b.y) / 2; return `M${a.x},${a.y + R} C${a.x},${my} ${b.x},${my} ${b.x},${b.y - R}`;
  };
  const hov = hover ? visible.nodes.find((n) => n.id === hover) : null;
  const hp = hover ? pos.get(hover) : null;

  return (
    <div className={full ? "fixed inset-4 z-50 rounded-2xl border border-border bg-bg shadow-calm" : "relative"}>
      <style>{"@keyframes calm-flow{to{stroke-dashoffset:-20}}.calm-flow{stroke-dasharray:6 4;animation:calm-flow .8s linear infinite}.calm-flow.paused{animation-play-state:paused}@media (prefers-reduced-motion:reduce){.calm-flow{animation:none}}"}</style>
      <div ref={ref} tabIndex={0} role="application" aria-label={`${title ?? "Graph"}: ${visible.nodes.length} nodes. Arrow keys move between nodes, + and − zoom, 0 fits.`}
        onKeyDown={onKey}
        onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top); } }}
        className="relative overflow-hidden rounded-xl bg-sunken outline-none focus-visible:ring-2 focus-visible:ring-focus"
        style={{ height: h, backgroundImage: "radial-gradient(var(--chart-grid) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        {visible.nodes.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-text-3">{emptyText}</p>}
        {w > 0 && (
          <svg width={w} height={h} className="cursor-grab touch-none active:cursor-grabbing" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
              {visible.edges.map((e, i) => {
                const a = pos.get(e.from), b = pos.get(e.to);
                if (!a || !b) return null;
                const on = !neighbours || (neighbours.has(e.from) && neighbours.has(e.to) && (e.from === selected || e.to === selected));
                const stroke = TONE[e.tone ?? (e.active ? "accent" : "default")];
                return (
                  <g key={i} opacity={on ? 1 : 0.15}>
                    <path d={edgePath(a, b)} fill="none" stroke={stroke} strokeWidth={1.75} className={e.active && live ? `calm-flow ${paused ? "paused" : ""}` : undefined} />
                    {e.label && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} textAnchor="middle" fontSize={11} fill="var(--text-3)">{e.label}</text>}
                  </g>
                );
              })}
              {visible.nodes.map((n) => {
                const p = pos.get(n.id)!;
                const on = !neighbours || neighbours.has(n.id);
                const isSel = n.id === selected;
                const ring = TONE[n.tone ?? "default"];
                const folded = collapsed.has(n.id);
                return (
                  <g key={n.id} data-node transform={`translate(${p.x},${p.y})`} opacity={on ? 1 : 0.25} className="cursor-pointer"
                    onClick={() => select(isSel ? null : n.id)} onDoubleClick={() => childCount.get(n.id) && toggleCollapse(n.id)}
                    onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} style={{ transition: "opacity 160ms" }}>
                    {isSel && <circle r={R + 7} fill="none" stroke="var(--accent-text)" strokeOpacity={0.5} strokeWidth={2} />}
                    <circle r={R} fill="var(--surface)" stroke={ring} strokeWidth={2} strokeDasharray={folded ? "4 3" : undefined} />
                    <foreignObject x={-12} y={-12} width={24} height={24} style={{ color: ring === TONE.default ? "var(--text-2)" : ring, pointerEvents: "none" }}>
                      <div className="flex h-6 w-6 items-center justify-center">{n.icon}</div>
                    </foreignObject>
                    {(n.badge ?? (folded ? childCount.get(n.id) : 0)) ? (
                      <g transform={`translate(${R * 0.72},${-R * 0.72})`}>
                        <circle r={9} fill="var(--accent)" />
                        <text textAnchor="middle" dy="0.35em" fontSize={10} fontWeight={600} fill="var(--on-accent)">{folded ? `+${childCount.get(n.id)}` : n.badge}</text>
                      </g>
                    ) : null}
                    <text y={R + 16} textAnchor="middle" fontSize={12.5} fontWeight={500} fill="var(--text)">{n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label}</text>
                    {n.sublabel && <text y={R + 31} textAnchor="middle" fontSize={11} fill="var(--text-3)">{n.sublabel}</text>}
                  </g>
                );
              })}
            </g>
          </svg>
        )}
        {hov && hp && (hov.details?.length || hov.label.length > 26) && (
          <div className="pointer-events-none absolute z-10 max-w-xs -translate-x-1/2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text shadow-calm"
            style={{ left: hp.x * view.k + view.x, top: hp.y * view.k + view.y + (R + 40) * view.k }}>
            <b className="block font-semibold">{hov.label}</b>
            {hov.details?.map((d, i) => <span key={i} className="block text-text-2">{d}</span>)}
          </div>
        )}
        {/* Controls: a quiet column on the left edge, like most diagram tools. */}
        <div className="absolute left-3 top-1/2 flex -translate-y-1/2 flex-col gap-2">
          <button type="button" className={ctl} onClick={() => setDir((d) => (d === "LR" ? "TB" : "LR"))} title={`Layout: ${dir === "LR" ? "left → right" : "top → down"}`} aria-label="Switch layout"><LayoutIcon className={dir === "TB" ? "rotate-90" : ""} /></button>
          <button type="button" className={ctl} onClick={fit} title="Fit to screen (0)" aria-label="Fit to screen"><FitIcon /></button>
          <button type="button" className={ctl} onClick={() => zoom(1.2)} title="Zoom in (+)" aria-label="Zoom in"><ZoomInIcon /></button>
          <button type="button" className={ctl} onClick={() => zoom(1 / 1.2)} title="Zoom out (−)" aria-label="Zoom out"><ZoomOutIcon /></button>
          <button type="button" className={ctl} onClick={() => setFull((f) => !f)} title={full ? "Exit full screen (F / Esc)" : "Full screen (F)"} aria-label="Full screen">{full ? <ShrinkIcon /> : <ExpandIcon />}</button>
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-2 text-xs text-text-3">
          {visible.hiddenCount > 0 && <button type="button" onClick={() => setCollapsed(new Set())} className="rounded-md bg-surface-2 px-2 py-1 hover:text-text">{visible.hiddenCount} hidden · Expand all</button>}
          {live && (
            <button type="button" onClick={() => { const next = !paused; setPaused(next); onPausedChange?.(next); }} aria-pressed={paused}
              title={paused ? "Resume live updates" : "Pause live updates"} className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 hover:text-text">
              <span className={`h-2 w-2 rounded-full ${paused || status === "stopped" ? "bg-text-3" : status === "reconnecting" ? "bg-warning" : "animate-pulse bg-success"}`} />
              <span aria-live="polite">{paused ? "Paused" : status === "reconnecting" ? "Reconnecting…" : status === "stopped" ? "Offline" : "Live"}</span>
              {paused ? <PlayIcon width={12} height={12} /> : <PauseIcon width={12} height={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
