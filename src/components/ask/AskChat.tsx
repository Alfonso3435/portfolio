"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Reply, Source } from "@/lib/ask-alfonso/types";
import { useAskAlfonso } from "@/lib/ask-alfonso/useAskAlfonso";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  reply?: Reply;
  /** For user messages: the question as the model received it, if the rewriter changed it. */
  understoodAs?: string;
}

/** Why an answer was replaced, in plain words (guardrails' reasons → visitor-facing copy). */
function fallbackNote(reason?: string): string {
  switch (reason) {
    case "ungrounded":
    case "ungrounded_refusal":
    case "unsupported_name":
      return "Its first answer mentioned something that isn't in Alfonso's data, so it wasn't shown.";
    case "off_question":
      return "Its first answer was about something other than what you asked, so it wasn't shown.";
    case "fact_without_context":
      return "It didn't find information about that in Alfonso's data.";
    default:
      return "Its answer didn't come out right, so it wasn't shown.";
  }
}

interface AskChatProps {
  assistantName: string;
  shortName: string;
  email: string;
  suggestions: string[];
}

/** Where a retrieved chunk lives on the site, so every answer can cite its source. */
function sourceHref(id: string): string {
  const [kind, slug] = id.split("/");
  if (kind === "project") return `/projects/${slug}`;
  const anchors: Record<string, string> = {
    experience: "experience",
    education: "education",
    award: "recognition",
    skills: "skills",
    certifications: "learning",
  };
  return anchors[kind] ? `/about#${anchors[kind]}` : "/about";
}

/** Turn URLs and the email in an answer into links; case-study URLs stay on the site. */
function linkify(text: string, email: string): ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s]+?(?=[.,;)]?(?:\s|$))|alfonsovegasol\.com\/[a-z0-9/-]*[a-z0-9]|[\w.+-]+@[\w-]+\.[\w.]+[a-z])/i);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    if (part.startsWith("http")) {
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
          {part}
        </a>
      );
    }
    if (part.includes("@")) {
      return (
        <a key={i} href={`mailto:${part === email ? email : part}`} className="text-accent hover:underline">
          {part}
        </a>
      );
    }
    return (
      <Link key={i} href={part.replace("alfonsovegasol.com", "")} className="text-accent hover:underline">
        {part}
      </Link>
    );
  });
}

function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <span className="font-mono uppercase">Source{sources.length > 1 ? "s" : ""}:</span>
      {sources.map((s) => (
        <Link key={s.id} href={sourceHref(s.id)} className="rounded-full border border-line px-2 py-0.5 hover:text-fg">
          {s.title}
        </Link>
      ))}
    </p>
  );
}

/** The pipeline's reasoning, for curious visitors (and for showing how the guardrails work). */
function HowItAnswered({ reply }: { reply: Reply }) {
  const d = reply.debug;
  return (
    <details className="mt-2.5 text-xs text-muted">
      <summary className="cursor-pointer select-none hover:text-fg">How it answered</summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono">
        {d.hits ? (
          <>
            <dt>Retrieved</dt>
            <dd>{d.hits.map(([id, score]) => `${id} (${score.toFixed(2)})`).join(", ")}</dd>
            <dt>Read</dt>
            <dd>{d.contextIds?.length ? d.contextIds.join(", ") : "nothing (low confidence)"}</dd>
            <dt>Model wrote</dt>
            <dd className="whitespace-pre-line break-words">{d.raw || "—"}</dd>
          </>
        ) : null}
        <dt>Guardrails</dt>
        <dd>
          {d.reason === "about_assistant"
            ? "a question about the assistant itself: fixed answer, the model didn't run"
            : d.reason === "private_guard"
            ? "personal topic: refused before the model ran"
            : d.reason
              ? `replaced the answer (${d.reason.replaceAll("_", " ")}${d.ungrounded?.length ? `: ${d.ungrounded.join(", ")}` : ""})`
              : "passed"}
        </dd>
        {d.ms !== undefined ? (
          <>
            <dt>Time</dt>
            <dd>
              {(d.ms / 1000).toFixed(2)} s{d.promptTokens ? ` · ${d.promptTokens} prompt tokens` : ""}
            </dd>
          </>
        ) : null}
      </dl>
    </details>
  );
}

export function AskChat({ assistantName, shortName, email, suggestions }: AskChatProps) {
  const { status, progress, error, load, ask } = useAskAlfonso();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const list = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const lastQuestion = useRef<string | undefined>(undefined);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");
    const userId = nextId.current++;
    setMessages((m) => [...m, { id: userId, role: "user", text: q }]);
    try {
      const reply = await ask(q, lastQuestion.current);
      lastQuestion.current = reply.question ?? q;
      setMessages((m) => [
        ...m.map((msg) => (msg.id === userId && reply.rewritten ? { ...msg, understoodAs: reply.question } : msg)),
        { id: nextId.current++, role: "assistant", text: reply.answer, reply },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { id: nextId.current++, role: "assistant", text: `Something went wrong: ${(err as Error).message}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // Start downloading as soon as the chat is on screen, and answer ?q=… links from other pages.
  useEffect(() => {
    // load() runs on every mount: in development React mounts twice and the first
    // unmount terminates the worker, so loading only once left the chat stuck at 0%.
    load();
    const q = new URLSearchParams(window.location.search).get("q");
    if (!q || started.current) return;
    // Deferred so the throwaway first mount in development can't send it to a dead worker.
    const timer = setTimeout(() => {
      started.current = true;
      void send(q);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll the conversation itself (not the page) to the newest message.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const statusText =
    status === "ready"
      ? "Model loaded · runs entirely in your browser"
      : status === "error"
        ? `Couldn't load the model: ${error}`
        : `Downloading the model (7.7 MB, once)… ${Math.round(progress * 100)}%`;

  return (
    <section aria-label={`Chat with ${assistantName}`} className="flex flex-col rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <p className="font-display font-semibold">{assistantName}</p>
        <p className="flex items-center gap-2 font-mono text-xs text-muted" role="status">
          <span
            aria-hidden
            className={`size-2 rounded-full ${status === "ready" ? "bg-accent" : status === "error" ? "bg-red-400" : "animate-pulse bg-muted"}`}
          />
          {statusText}
          {status === "error" ? (
            <button type="button" onClick={load} className="text-accent hover:text-fg">
              Retry
            </button>
          ) : null}
        </p>
      </div>

      <div
        ref={list}
        className="flex max-h-[60vh] min-h-[320px] flex-col gap-4 overflow-y-auto px-5 py-5"
        aria-live="polite"
      >
        <div className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-surface-2 px-4 py-3 text-[15px]">
          Hi! I&apos;m {assistantName}, a small language model {shortName} built from scratch. Ask me about his
          projects, skills or experience. I only answer from his real data, and I&apos;ll tell you when I don&apos;t know.
        </div>

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex max-w-[85%] flex-col items-end gap-1 self-end">
              <div className="rounded-2xl rounded-tr-sm bg-accent px-4 py-3 text-[15px] text-on-accent">{m.text}</div>
              {m.understoodAs ? (
                <p className="text-right text-xs text-muted">Understood as: “{m.understoodAs}”</p>
              ) : null}
            </div>
          ) : (
            <div key={m.id} className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-surface-2 px-4 py-3 text-[15px]">
              <p className="whitespace-pre-line break-words">{linkify(m.text, email)}</p>
              {m.reply?.status === "fallback" ? (
                <p className="mt-2 text-xs text-muted">{fallbackNote(m.reply.debug.reason)}</p>
              ) : null}
              {m.reply ? <Sources sources={m.reply.sources} /> : null}
              {m.reply ? <HowItAnswered reply={m.reply} /> : null}
            </div>
          ),
        )}

        {busy ? (
          <p className="self-start font-mono text-xs text-muted">
            {status === "ready" ? "Thinking…" : "Loading the model, then thinking…"}
          </p>
        ) : null}
      </div>

      {messages.length === 0 ? (
        <ul className="flex flex-wrap gap-2 px-5 pb-4" aria-label="Example questions">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => void send(s)}
                disabled={busy}
                className="min-h-9 rounded-full border border-line px-3.5 text-sm text-muted hover:border-muted hover:text-fg disabled:opacity-50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-line p-3">
        <label htmlFor="ask-input" className="sr-only">
          Ask {assistantName} a question
        </label>
        <input
          id="ask-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${shortName}'s projects, skills or experience…`}
          maxLength={300}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-line bg-bg px-3.5 text-[15px] placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="min-h-11 rounded-[10px] bg-accent px-5 text-[15px] font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </section>
  );
}
