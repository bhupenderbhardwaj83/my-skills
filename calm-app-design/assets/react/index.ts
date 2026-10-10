// Calm app design — drop-in React + TypeScript components (Tailwind + the calm preset + tokens.css).
// Copy this folder into the app (e.g. src/components/calm/) and import from it.
// Next.js layout: import { themeInitScript } from "./theme-init" (no "use client" there).
export { ThemeToggle, useTheme, type ThemeChoice } from "./theme";
export { themeInitScript } from "./theme-init";
export { SearchInput, SearchList, Highlight, matches, useSearchKeys, useSlashToFocus } from "./search";
export { DataTable, Chips, toCsv, type Column, type TableQuery, type ServerTable } from "./DataTable";
export { Sidebar, type NavItem } from "./Sidebar";
export { IconRail, type RailItem, type RailSection, type RailLink } from "./IconRail";
export { TopBar, CommandPalette, useCommandPalette, type Command } from "./CommandPalette";
export { FilterBar, filterRows, TIME_RANGES, type Filter, type FilterField, type FilterOption, type TimeRange } from "./FilterBar";
export { Menu, Tooltip, Tabs, Layer, type MenuItem } from "./overlay";
export { Widget, DetailDrawer, KeyValueGrid, TreeView, EmptyState, EmptyIllustration, Announcement, type TreeNode } from "./panels";
export { AiAssistant, type AskFn, type ChatMessage } from "./AiAssistant";
export { Card, StatCard, LineChart, BarChart } from "./dashboard";
export { TrendBadge, SeverityBadge, SeverityList, Sparkline, MultiLineChart, RingChart, Gauge, severitySegments, SEVERITIES, type Severity } from "./charts";
export * from "./icons";
export { GraphView, type GraphNode, type GraphEdge, type Tone } from "./GraphView";
export { Section, Tag, Timeline, RelatedBanner, HelpTip, VideoTip, useHelpTips, safeVideoSource, type TimelineEvent } from "./disclosure";
export { createApi, ApiError, toQuery, listParams, downloadFrom, type Api, type ApiOptions, type Query, type SseEvent } from "./api";
export { useResource, useServerTable, useLiveEvents, type PageOf } from "./useApi";
export { shell, isDesktop, isMac, shortcutLabel, useShortcut, openExternal, type Shell } from "./platform";
export { TitleBar } from "./TitleBar";
