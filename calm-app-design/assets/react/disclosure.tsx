"use client";
// Tree-like progressive disclosure and in-context learning:
//   Section        collapsible block: title · count · tags · "View all" — a one-line summary when closed
//   Timeline       what happened, in order: time · icon · title · one line; expands for detail
//   RelatedBanner  "This detection is part of threat X with 50 related detections → View threat"
//   HelpTip        page intro: 1–3 sentences, Learn more, a small video, Done, "Show help tips" setting
//   VideoTip       small training video: loads only when played, allow-listed hosts, sandboxed
import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronRight, InfoIcon, LinkIcon, PlayIcon, XIcon } from "./icons";

/* ── section ───────────────────────────────────────────────────────────── */

export function Section({ title, count, tags, summary, action, defaultOpen = false, storageKey, children }: {
  title: string;
  count?: number;
  /** Small tags after the title: "AI powered", "Preview". */
  tags?: ReactNode;
  /** One line shown while closed, so the reader knows whether to open it. */
  summary?: ReactNode;
  /** Right side: "View all ›". */
  action?: { label: string; onClick: () => void };
  defaultOpen?: boolean;
  /** Remember open / closed. */
  storageKey?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  useEffect(() => {
    if (!storageKey) return;
    try { const v = localStorage.getItem(`section-${storageKey}`); if (v) setOpen(v === "1"); } catch { /* none */ }
  }, [storageKey]);
  const toggle = () => setOpen((o) => { if (storageKey) try { localStorage.setItem(`section-${storageKey}`, o ? "0" : "1"); } catch { /* private */ } return !o; });
  return (
    <section className="rounded-xl border border-border-subtle bg-surface">
      <div className="flex items-center gap-2 px-4">
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={id} className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronRight width={16} height={16} className={`shrink-0 text-text-3 transition-transform duration-fast ${open ? "rotate-90" : ""}`} />
          <span className="text-base font-semibold text-text">{title}</span>
          {count != null && <span className="rounded-md bg-surface-2 px-1.5 text-xs tabular-nums text-text-3">{count}</span>}
          {tags}
          {!open && summary && <span className="ml-2 min-w-0 truncate text-sm text-text-3">{summary}</span>}
        </button>
        {action && (
          <button type="button" onClick={action.onClick} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-sm text-text-2 ring-1 ring-border hover:text-text">
            {action.label} <ChevronRight width={14} height={14} />
          </button>
        )}
      </div>
      {open && <div id={id} className="border-t border-border-subtle px-4 py-4">{children}</div>}
    </section>
  );
}

/** "AI powered" / "Preview" / "New" — small tag for Section titles and nav items. */
export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" }) {
  return <span className={`rounded-md px-1.5 py-0.5 text-xs ${tone === "accent" ? "bg-accent-soft text-accent-text" : "bg-surface-2 text-text-3"}`}>{children}</span>;
}

/* ── timeline ──────────────────────────────────────────────────────────── */

export interface TimelineEvent { id: string; time: string; date?: string; title: string; summary?: string; icon?: ReactNode; detail?: ReactNode }

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  return (
    <ol className="relative space-y-3 pl-28">
      <span className="absolute bottom-4 left-[92px] top-4 w-px bg-border-subtle" aria-hidden />
      {events.map((e) => {
        const isOpen = open.has(e.id);
        return (
          <li key={e.id} className="relative">
            <div className="absolute -left-28 top-3 w-[72px] text-right text-xs tabular-nums text-text-3">
              <span className="block text-text-2">{e.time}</span>{e.date}
            </div>
            <span className="absolute -left-6 top-[18px] h-2 w-2 rounded-full bg-border-strong ring-4 ring-surface" aria-hidden />
            <button type="button" disabled={!e.detail} aria-expanded={e.detail ? isOpen : undefined}
              onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })}
              className="flex w-full items-start gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-left enabled:hover:bg-surface-2">
              {e.icon && <span className="mt-0.5 shrink-0 text-accent-text">{e.icon}</span>}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text">{e.title}</span>
                {e.summary && <span className="mt-0.5 block text-xs text-text-3">{e.summary}</span>}
              </span>
              {e.detail && <ChevronRight width={14} height={14} className={`mt-1 shrink-0 text-text-3 transition-transform duration-fast ${isOpen ? "rotate-90" : ""}`} />}
            </button>
            {isOpen && <div className="mt-2 rounded-lg bg-sunken px-4 py-3 text-sm text-text-2">{e.detail}</div>}
          </li>
        );
      })}
    </ol>
  );
}

/* ── correlation banner ────────────────────────────────────────────────── */

export function RelatedBanner({ children, action }: { children: ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm text-text-2">
      <LinkIcon className="shrink-0 text-accent-text" />
      <span className="min-w-0 flex-1">{children}</span>
      {action && <button type="button" onClick={action.onClick} className="h-8 shrink-0 rounded-lg px-3 text-sm text-text ring-1 ring-border hover:bg-surface-2">{action.label}</button>}
    </div>
  );
}

/* ── video ─────────────────────────────────────────────────────────────── */

/** Hosts a training video may come from. Anything else is refused (no arbitrary iframes). */
const EMBED_HOSTS = ["www.youtube-nocookie.com", "player.vimeo.com", "www.loom.com"];

/** A safe, privacy-friendly embed URL — or null when the source isn't allowed. */
export function safeVideoSource(src: string): { kind: "file" | "embed"; url: string } | null {
  let u: URL;
  try { u = new URL(src, typeof window !== "undefined" ? window.location.origin : "http://localhost"); } catch { return null; }
  if (u.protocol !== "https:" && !(u.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return null;
  const sameOrigin = typeof window !== "undefined" && u.origin === window.location.origin;
  if (/\.(mp4|webm)$/i.test(u.pathname) && (sameOrigin || u.protocol === "https:")) return { kind: "file", url: u.toString() };
  // youtube.com / youtu.be → the no-cookie player
  const yt = u.hostname.replace(/^www\./, "") === "youtube.com" ? u.searchParams.get("v") : u.hostname === "youtu.be" ? u.pathname.slice(1) : null;
  if (yt && /^[\w-]{6,20}$/.test(yt)) return { kind: "embed", url: `https://www.youtube-nocookie.com/embed/${yt}?rel=0` };
  if (EMBED_HOSTS.includes(u.hostname)) return { kind: "embed", url: u.toString() };
  return null;
}

/** Small training video: a poster with ▶ until played (nothing loads before), then a compact
 *  player. Files play with native controls (+ captions); embeds are sandboxed iframes. */
export function VideoTip({ src, title, poster, captions, width = 240 }: {
  src: string; title: string; poster?: string; captions?: string; width?: number;
}) {
  const [playing, setPlaying] = useState(false);
  const v = safeVideoSource(src);
  if (!v) return <p className="text-xs text-text-3">This video can't be shown here.</p>;
  const h = Math.round((width * 9) / 16);
  if (!playing)
    return (
      <button type="button" onClick={() => setPlaying(true)} aria-label={`Play video: ${title}`}
        className="group relative shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2" style={{ width, height: h }}>
        {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-on shadow-calm transition-transform duration-fast group-hover:scale-105"><PlayIcon /></span>
        </span>
        <span className="absolute bottom-2 left-2 right-2 truncate text-left text-xs font-medium text-text">{title}</span>
      </button>
    );
  return v.kind === "file" ? (
    <video src={v.url} controls autoPlay playsInline className="shrink-0 rounded-xl bg-black" style={{ width, height: h }} aria-label={title}>
      {captions && <track kind="captions" src={captions} default />}
    </video>
  ) : (
    <iframe src={v.url} title={title} width={width} height={h} className="shrink-0 rounded-xl border-0"
      sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin" loading="lazy" />
  );
}

/* ── help tip (page intro) ─────────────────────────────────────────────── */

const TIPS_KEY = "help-tips";

/** Whether the user wants page intros (one global setting). */
export function useHelpTips() {
  const [on, setOn] = useState(true);
  useEffect(() => { try { setOn(localStorage.getItem(TIPS_KEY) !== "off"); } catch { /* default on */ } }, []);
  const set = (v: boolean) => { setOn(v); try { localStorage.setItem(TIPS_KEY, v ? "on" : "off"); } catch { /* private */ } };
  return [on, set] as const;
}

/** "Learn about Saved reports" — short, dismissible, never in the way. Keep `body` to 1–3 sentences. */
export function HelpTip({ id, title, body, learnMore, video, onDone }: {
  /** Stable id: once Done, it stays hidden for this page. */
  id: string;
  title: string;
  body: ReactNode;
  learnMore?: { label?: string; href: string };
  video?: { src: string; title: string; poster?: string; captions?: string };
  onDone?: () => void;
}) {
  const [tipsOn, setTipsOn] = useHelpTips();
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(localStorage.getItem(`help-${id}`) === "done"); } catch { setHidden(false); } }, [id]);
  if (hidden || !tipsOn) return null;
  const done = () => { setHidden(true); try { localStorage.setItem(`help-${id}`, "done"); } catch { /* private */ } onDone?.(); };
  const safeHref = learnMore && /^(https:\/\/|\/(?!\/))/.test(learnMore.href) ? learnMore.href : null;
  return (
    <aside className="relative flex flex-wrap gap-5 rounded-xl border border-border-subtle bg-surface p-5 shadow-sm" aria-label={title}>
      <InfoIcon width={28} height={28} className="shrink-0 text-accent-text" />
      <div className="min-w-[240px] flex-1">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        <div className="mt-1 max-w-2xl text-sm leading-relaxed text-text-2">{body}</div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          {safeHref && <a href={safeHref} target="_blank" rel="noopener noreferrer" className="text-accent-text hover:underline">{learnMore?.label ?? "Learn more"}</a>}
          <button type="button" onClick={done} className="h-8 rounded-lg bg-accent px-4 font-medium text-accent-on hover:bg-accent-hover">Done</button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-text-3">
            <input type="checkbox" checked={tipsOn} onChange={(e) => setTipsOn(e.target.checked)} className="accent-[var(--accent)]" /> Show help tips on new pages
          </label>
        </div>
      </div>
      {video && <div className="pr-8"><VideoTip {...video} /></div>}
      <button type="button" onClick={done} aria-label="Dismiss" className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-text-3 hover:text-text"><XIcon width={14} height={14} /></button>
    </aside>
  );
}
