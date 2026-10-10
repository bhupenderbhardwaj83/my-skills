// Small inline icons (1.75 px strokes, currentColor) so the components need no icon package.
// Swap for lucide-react if the project already uses it.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const SearchIcon = (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const XIcon = (p: P) => <svg {...base(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>;
export const SunIcon = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
export const MoonIcon = (p: P) => <svg {...base(p)}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>;
export const MonitorIcon = (p: P) => <svg {...base(p)}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>;
export const ChevronLeft = (p: P) => <svg {...base(p)}><path d="m15 18-6-6 6-6" /></svg>;
export const ChevronRight = (p: P) => <svg {...base(p)}><path d="m9 18 6-6-6-6" /></svg>;
export const SortIcon = ({ dir, ...p }: P & { dir: "asc" | "desc" | null }) => (
  <svg {...base(p)} width={12} height={12}>
    <path d="m7 10 5-5 5 5" opacity={dir === "asc" ? 1 : 0.3} />
    <path d="m7 14 5 5 5-5" opacity={dir === "desc" ? 1 : 0.3} />
  </svg>
);
export const DownloadIcon = (p: P) => <svg {...base(p)}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>;
export const PanelIcon = (p: P) => <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>;
export const ChevronDown = (p: P) => <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>;
export const PlusIcon = (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const MoreIcon = (p: P) => <svg {...base(p)}><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>;
export const FilterIcon = (p: P) => <svg {...base(p)}><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" /></svg>;
export const GearIcon = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>;
export const SparkleIcon = (p: P) => <svg {...base(p)}><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></svg>;
export const HistoryIcon = (p: P) => <svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>;
export const SendIcon = (p: P) => <svg {...base(p)}><path d="m5 12 14-7-5 14-2-6-7-1Z" /></svg>;
export const StopIcon = (p: P) => <svg {...base(p)}><rect x="7" y="7" width="10" height="10" rx="2" /></svg>;
export const ArrowUp = (p: P) => <svg {...base(p)}><path d="m6 11 6-6 6 6M12 5v14" /></svg>;
export const ArrowDown = (p: P) => <svg {...base(p)}><path d="m18 13-6 6-6-6M12 19V5" /></svg>;
export const CopyIcon = (p: P) => <svg {...base(p)}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>;
// Domain + control icons (graphs, workflows, panels, media). One set, one stroke width.
export const GlobeIcon = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
export const ServerIcon = (p: P) => <svg {...base(p)}><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></svg>;
export const ContainerIcon = (p: P) => <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9v6M10 9v6M13 9v6M16 9v6" /></svg>;
export const DatabaseIcon = (p: P) => <svg {...base(p)}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>;
export const ShieldIcon = (p: P) => <svg {...base(p)}><path d="M12 3 4 6v6c0 5 3.4 8.2 8 9 4.6-.8 8-4 8-9V6l-8-3Z" /></svg>;
export const BugIcon = (p: P) => <svg {...base(p)}><rect x="8" y="7" width="8" height="12" rx="4" /><path d="M12 7V5M9 4l1.5 2M15 4l-1.5 2M4 12h4M16 12h4M5 18l3-2M19 18l-3-2M5 7l3 2M19 7l-3 2" /></svg>;
export const UserIcon = (p: P) => <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
export const KeyIcon = (p: P) => <svg {...base(p)}><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M14 9l2 2" /></svg>;
export const CloudIcon = (p: P) => <svg {...base(p)}><path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9Z" /></svg>;
export const BoltIcon = (p: P) => <svg {...base(p)}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>;
export const PlayIcon = (p: P) => <svg {...base(p)}><path d="M7 4v16l13-8L7 4Z" /></svg>;
export const PauseIcon = (p: P) => <svg {...base(p)}><path d="M8 5v14M16 5v14" /></svg>;
export const ZoomInIcon = (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6M11 8v6" /></svg>;
export const ZoomOutIcon = (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6" /></svg>;
export const FitIcon = (p: P) => <svg {...base(p)}><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" /><rect x="8" y="8" width="8" height="8" rx="1" /></svg>;
export const ExpandIcon = (p: P) => <svg {...base(p)}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>;
export const ShrinkIcon = (p: P) => <svg {...base(p)}><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg>;
export const MinimizeIcon = (p: P) => <svg {...base(p)}><path d="M5 19h14" /></svg>;
export const LayoutIcon = (p: P) => <svg {...base(p)}><circle cx="5" cy="12" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 12h5m0 0 5-5m-5 5 5 5" /></svg>;
export const LinkIcon = (p: P) => <svg {...base(p)}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>;
export const InfoIcon = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" /></svg>;
export const GripIcon = (p: P) => <svg {...base(p)}><path d="M10 6h.01M14 6h.01M10 12h.01M14 12h.01M10 18h.01M14 18h.01" /></svg>;
