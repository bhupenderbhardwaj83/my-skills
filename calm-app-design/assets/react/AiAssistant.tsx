"use client";
// AI assistant: a floating "Ask AI" pill (bottom-right, ⌘I / Ctrl+I) that opens a side panel —
// greeting, suggested questions, streaming answers, stop, copy, history, new chat.
// Works without AI too: `available={false}` shows a calm "not set up" note (+ optional setup
// action) instead of a broken chat — the rest of the app never depends on it.
//
// Plug in any backend: onAsk(messages, signal) returns the answer as a string, or streams it as
// an AsyncIterable<string> of text chunks (fetch + ReadableStream, an SDK stream, a local model…).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CopyIcon, HistoryIcon, PanelIcon, PlusIcon, SendIcon, SparkleIcon, StopIcon, XIcon } from "./icons";
import { useShortcut } from "./platform";

export interface ChatMessage { role: "user" | "assistant"; content: string; error?: boolean }
export type AskFn = (messages: ChatMessage[], signal: AbortSignal) => Promise<string> | AsyncIterable<string>;
interface Thread { id: string; title: string; messages: ChatMessage[]; at: number }

const HIST_KEY = "assistant-history";
const iconBtn = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-3 hover:bg-surface-2 hover:text-text";

/** Tiny, safe formatter: paragraphs, lists, **bold**, `code`, ``` blocks — no HTML injection. */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <>
      {blocks.map((b, i) =>
        i % 2 ? (
          <pre key={i} className="my-2 overflow-x-auto rounded-lg bg-sunken p-3 font-mono text-xs text-text">{b.replace(/^\w*\n/, "")}</pre>
        ) : (
          b.split(/\n{2,}/).filter((p) => p.trim()).map((p, j) => {
            const lines = p.split("\n");
            const inline = (s: string) => s.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((t, k) =>
              t.startsWith("**") ? <b key={k} className="font-semibold text-text">{t.slice(2, -2)}</b>
              : t.startsWith("`") ? <code key={k} className="rounded bg-sunken px-1 font-mono text-[0.85em]">{t.slice(1, -1)}</code> : t);
            if (lines.every((l) => /^\s*([-*]|\d+\.)\s/.test(l)))
              return <ul key={`${i}-${j}`} className="my-1.5 list-disc space-y-1 pl-5">{lines.map((l, k) => <li key={k}>{inline(l.replace(/^\s*([-*]|\d+\.)\s/, ""))}</li>)}</ul>;
            return <p key={`${i}-${j}`} className="my-1.5">{lines.map((l, k) => <span key={k}>{k > 0 && <br />}{inline(l)}</span>)}</p>;
          })
        ))}
    </>
  );
}

export function AiAssistant({
  name = "Assistant", onAsk, available = true, suggestions = [], description, context, setupAction,
  remember = true, shortcut = "i", avatar,
}: {
  /** Shown on the pill and in the panel: "Ask Mika", "Copilot"… */
  name?: string;
  onAsk: AskFn;
  /** False when no AI provider is configured (or offline): the panel explains instead of failing. */
  available?: boolean;
  /** 4–6 starter questions that fit this screen. */
  suggestions?: string[];
  description?: string;
  /** What the assistant can see: "Threats page · 30 days". Shown as a chip above the input. */
  context?: string;
  setupAction?: { label: string; onClick: () => void };
  /** Keep chat history in this browser (localStorage). */
  remember?: boolean;
  /** ⌘ + this key toggles the panel. */
  shortcut?: string;
  avatar?: ReactNode;
}) {
  const sc = useShortcut();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState(() => String(Date.now()));
  const [threads, setThreads] = useState<Thread[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!remember) return;
    try { setThreads(JSON.parse(localStorage.getItem(HIST_KEY) || "[]")); } catch { /* none */ }
  }, [remember]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === shortcut) { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);
  useEffect(() => { if (open && view === "chat") requestAnimationFrame(() => input.current?.focus()); }, [open, view]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [messages]);

  const save = useCallback((msgs: ChatMessage[]) => {
    if (!remember || !msgs.length) return;
    setThreads((all) => {
      const t: Thread = { id: threadId, title: msgs[0].content.slice(0, 80), messages: msgs.slice(-40), at: Date.now() };
      const next = [t, ...all.filter((x) => x.id !== threadId)].slice(0, 20);
      try { localStorage.setItem(HIST_KEY, JSON.stringify(next)); } catch { /* full or private */ }
      return next;
    });
  }, [remember, threadId]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy || !available) return;
    const base: ChatMessage[] = [...messages.filter((m) => !m.error), { role: "user", content: q }];
    setMessages([...base, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);
    const ctl = new AbortController();
    abort.current = ctl;
    let answer = "";
    try {
      const res = onAsk(base, ctl.signal);
      if (typeof (res as AsyncIterable<string>)[Symbol.asyncIterator] === "function") {
        for await (const chunk of res as AsyncIterable<string>) {
          if (ctl.signal.aborted) break;
          answer += chunk;
          setMessages([...base, { role: "assistant", content: answer }]);
        }
      } else {
        answer = await (res as Promise<string>);
        setMessages([...base, { role: "assistant", content: answer }]);
      }
      save([...base, { role: "assistant", content: answer || "(stopped)" }]);
    } catch (err) {
      const stopped = ctl.signal.aborted;
      setMessages([...base, { role: "assistant", content: stopped ? answer || "Stopped." : `Couldn't get an answer: ${err instanceof Error ? err.message : String(err)}`, error: !stopped }]);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };
  const stop = () => abort.current?.abort();
  const newChat = () => { stop(); setMessages([]); setThreadId(String(Date.now())); setView("chat"); };
  const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.content;

  return (
    <>
      {!open && (available || setupAction) && (
        <button type="button" onClick={() => setOpen(true)} title={`${name} (${sc(shortcut)})`}
          className="fixed bottom-4 right-4 z-30 inline-flex h-10 items-center gap-2 rounded-full border border-accent-text/40 bg-surface-2 px-4 text-sm font-medium text-text shadow-calm transition-colors duration-fast hover:border-accent-text">
          <SparkleIcon className="text-accent-text" /> {name}
        </button>
      )}
      {open && (
        <aside role="complementary" aria-label={name}
          className="fixed inset-y-0 right-0 z-40 flex w-[420px] max-w-full flex-col border-l border-border bg-surface shadow-calm"
          style={{ animation: "calm-drawer-in 180ms cubic-bezier(.2,.8,.2,1)" }}
          onKeyDown={(e) => { if (e.key === "Escape") { if (busy) stop(); else if (!draft) setOpen(false); } }}>
          <style>{"@keyframes calm-drawer-in{from{transform:translateX(24px)}to{transform:none}}"}</style>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border-subtle px-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent-text"><SparkleIcon /></span>
            <h2 className="flex-1 text-base font-semibold text-text">{view === "history" ? "Recent chats" : name}</h2>
            <button type="button" onClick={newChat} className={iconBtn} title="New chat" aria-label="New chat"><PlusIcon /></button>
            {remember && <button type="button" onClick={() => setView((v) => (v === "history" ? "chat" : "history"))} aria-pressed={view === "history"} className={iconBtn} title="History" aria-label="Chat history"><HistoryIcon /></button>}
            <button type="button" onClick={() => setOpen(false)} className={iconBtn} title={`Hide (${sc(shortcut)}) — the chat is kept`} aria-label="Hide panel"><PanelIcon /></button>
            <button type="button" onClick={() => { newChat(); setOpen(false); }} className={iconBtn} title="Close and clear" aria-label="Close"><XIcon /></button>
          </header>

          {view === "history" ? (
            <div className="flex-1 overflow-y-auto p-2">
              {threads.length === 0 && <p className="px-3 py-10 text-center text-sm text-text-3">No chats yet — they're kept only in this browser.</p>}
              {threads.map((t) => (
                <button key={t.id} type="button" onClick={() => { setMessages(t.messages); setThreadId(t.id); setView("chat"); }}
                  className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-surface-2">
                  <span className="w-full truncate text-sm text-text">{t.title}</span>
                  <span className="text-xs text-text-3">{new Date(t.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-4">
                {!available ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-text-3"><SparkleIcon width={24} height={24} /></span>
                    <p className="mt-3 font-medium text-text">{name} isn't set up</p>
                    <p className="mt-1 max-w-xs text-sm text-text-3">Everything else works without it. Connect an AI provider to ask questions about this workspace.</p>
                    {setupAction && <button type="button" onClick={setupAction.onClick} className="mt-4 h-9 rounded-lg bg-accent px-4 text-sm font-medium text-accent-on hover:bg-accent-hover">{setupAction.label}</button>}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center pt-8 text-center">
                    {avatar ?? <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent-text"><SparkleIcon width={28} height={28} /></span>}
                    <p className="mt-4 text-lg font-semibold text-text">Ask {name} anything</p>
                    {description && <p className="mt-1 max-w-xs text-sm text-text-3">{description}</p>}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((m, i) => (
                      m.role === "user" ? (
                        <div key={i} className="ml-10 rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2 text-sm text-text">{m.content}</div>
                      ) : (
                        <div key={i} className={`group mr-4 text-sm leading-relaxed ${m.error ? "text-danger" : "text-text-2"}`}>
                          {m.content ? <Rich text={m.content} /> : <span className="inline-flex gap-1 py-2" aria-label="Thinking">{[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-3" style={{ animationDelay: `${d * 150}ms` }} />)}</span>}
                          {m.content && !busy && (
                            <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                              <button type="button" onClick={() => void navigator.clipboard?.writeText(m.content)} className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-text-3 hover:bg-surface-2 hover:text-text"><CopyIcon width={13} height={13} /> Copy</button>
                              {m.error && lastQuestion && <button type="button" onClick={() => void send(lastQuestion)} className="h-7 rounded-md px-1.5 text-xs text-text-3 hover:bg-surface-2 hover:text-text">Try again</button>}
                            </div>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>

              {available && (
                <div className="border-t border-border-subtle p-3">
                  {messages.length === 0 && suggestions.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {suggestions.map((s) => (
                        <button key={s} type="button" onClick={() => void send(s)}
                          className="block w-full truncate rounded-lg border border-border-subtle px-3 py-2 text-left text-sm text-text-2 hover:border-border-strong hover:text-text">{s}</button>
                      ))}
                    </div>
                  )}
                  {context && <p className="mb-2 inline-flex rounded-md bg-surface-2 px-2 py-0.5 text-xs text-text-3">Using: {context}</p>}
                  <div className="flex items-end gap-2 rounded-xl border border-border bg-sunken p-2 focus-within:border-accent-text/60 focus-within:ring-2 focus-within:ring-accent-soft">
                    <textarea ref={input} value={draft} rows={1} placeholder="Ask anything…" aria-label={`Message ${name}`}
                      onChange={(e) => { setDraft(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px`; }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(draft); }
                        else if (e.key === "ArrowUp" && !draft && lastQuestion) { e.preventDefault(); setDraft(lastQuestion); }
                      }}
                      className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent px-1 py-0.5 text-sm text-text outline-none placeholder:text-text-3" />
                    {busy ? (
                      <button type="button" onClick={stop} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text" title="Stop (Esc)" aria-label="Stop"><StopIcon /></button>
                    ) : (
                      <button type="button" onClick={() => void send(draft)} disabled={!draft.trim()} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-on disabled:opacity-40" title="Send (Enter)" aria-label="Send"><SendIcon /></button>
                    )}
                  </div>
                  <p className="mt-2 text-center text-xs text-text-3">AI answers can be wrong — check important details. · Shift+Enter new line</p>
                </div>
              )}
            </>
          )}
        </aside>
      )}
    </>
  );
}
