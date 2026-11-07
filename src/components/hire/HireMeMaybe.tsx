"use client";

import { useEffect, useRef, useState } from "react";
import { samplePostings } from "@/components/hire/samples";

type Verdict = "reject" | "partial" | "match";

interface Result {
  verdict?: Verdict;
  role?: string;
  field?: string;
  requirements?: { requirement: string; evidence: { label: string }[] }[];
  pdf?: string;
  resumeUrl?: string | null;
  error?: string;
}

const FILE_NAME = "Resume_Juan_Alfonso_Vega_Sol.pdf";

const VERDICT_COPY: Record<Verdict, { badge: string; title: string; body: string; tone: string }> = {
  match: {
    badge: "It's a match",
    title: "Here's a résumé tailored to this role",
    body: "Built only from Alfonso's real experience: the tool picks which approved projects and bullets to show, it never writes new ones.",
    tone: "border-accent/40 bg-accent/10 text-accent",
  },
  partial: {
    badge: "Partial match",
    title: "Related field, different focus",
    body: "This role is in computing but outside Alfonso's focus on AI/ML and software engineering, so here's his standard résumé.",
    tone: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  },
  reject: {
    badge: "Not a fit",
    title: "This role is outside Alfonso's field",
    body: "Hire Me Maybe only tailors résumés for software engineering and AI/ML roles.",
    tone: "border-line bg-surface-2 text-muted",
  },
};

function base64ToBlobUrl(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

export function HireMeMaybe({ email }: { email: string }) {
  const [posting, setPosting] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const sample = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const words = posting.trim() ? posting.trim().split(/\s+/).length : 0;

  // Free the previous PDF's memory when a new one arrives.
  useEffect(() => () => void (pdfUrl && URL.revokeObjectURL(pdfUrl)), [pdfUrl]);

  const paste = async () => {
    try {
      setPosting(await navigator.clipboard.readText());
    } catch {
      document.getElementById("posting")?.focus();
    }
  };

  const trySample = () => {
    const s = samplePostings[sample.current % samplePostings.length];
    sample.current += 1;
    setPosting(s.text);
    setResult(null);
  };

  const analyze = async () => {
    if (!posting.trim() || busy) return;
    setBusy(true);
    setResult(null);
    setPdfUrl(null);
    try {
      const res = await fetch("/api/hire-me-maybe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ posting }),
      });
      const data = (await res.json()) as Result;
      setResult(data);
      if (data.pdf) setPdfUrl(base64ToBlobUrl(data.pdf));
    } catch {
      setResult({ error: "Couldn't reach the server. Check your connection and try again.", resumeUrl: "/resume.pdf" });
    } finally {
      setBusy(false);
      // On phones the result is below the fold.
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }
  };

  const copy = result?.verdict ? VERDICT_COPY[result.verdict] : null;

  return (
    <div className="grid overflow-hidden rounded-2xl border border-line bg-surface lg:grid-cols-2">
      {/* Left: the posting */}
      <section aria-labelledby="posting-label" className="flex min-h-[420px] flex-col border-line p-5 sm:p-6 lg:border-r">
        <h2 id="posting-label" className="font-display text-lg font-semibold">
          Job description
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={paste} className="min-h-9 rounded-full border border-line px-4 text-sm hover:border-muted">
            Paste
          </button>
          <button type="button" onClick={trySample} className="min-h-9 rounded-full border border-line px-4 text-sm hover:border-muted">
            Try a sample
          </button>
        </div>
        <label htmlFor="posting" className="sr-only">
          Job description
        </label>
        <textarea
          id="posting"
          value={posting}
          onChange={(e) => setPosting(e.target.value)}
          placeholder="Paste a job description here, or try a sample."
          maxLength={15000}
          className="mt-4 min-h-64 flex-1 resize-none bg-transparent text-[15px] leading-relaxed placeholder:text-muted focus:outline-none"
        />
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <span className="font-mono text-xs text-muted">{words.toLocaleString("en-US")} words</span>
          <button
            type="button"
            onClick={analyze}
            disabled={busy || words < 25}
            className="min-h-11 rounded-full bg-accent px-6 font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </section>

      {/* Right: the result */}
      <section aria-labelledby="result-label" aria-live="polite" ref={resultRef} className="flex flex-col border-t border-line p-5 sm:p-6 lg:border-t-0">
        <h2 id="result-label" className="font-display text-lg font-semibold">
          Result
        </h2>

        {busy ? (
          <div className="mt-4 flex flex-col gap-2 text-sm text-muted">
            <p className="animate-pulse">Reading the posting and checking it against Alfonso&apos;s experience…</p>
          </div>
        ) : !result ? (
          <p className="mt-4 text-[15px] text-muted">Click Analyze to see the result here.</p>
        ) : result.error ? (
          <div className="mt-4 flex flex-col gap-3 text-[15px]">
            <p>{result.error}</p>
            {result.resumeUrl ? (
              <a href={result.resumeUrl} className="text-accent hover:text-fg">
                Download his standard résumé instead →
              </a>
            ) : null}
          </div>
        ) : copy ? (
          <div className="mt-4 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className={`self-start rounded-full border px-3 py-1 font-mono text-xs uppercase ${copy.tone}`}>{copy.badge}</span>
              {result.role ? (
                <p className="text-sm text-muted">
                  {result.role}
                  {result.field ? ` · ${result.field}` : ""}
                </p>
              ) : null}
              <h3 className="text-xl font-semibold">{copy.title}</h3>
              <p className="text-[15px] text-muted">{copy.body}</p>
            </div>

            {result.requirements?.length ? (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-xs uppercase text-muted">What the role asks for → where Alfonso has done it</p>
                <ul className="flex flex-col gap-2">
                  {result.requirements.map((r) => (
                    <li key={r.requirement} className="rounded-xl border border-line px-3.5 py-2.5 text-sm">
                      <p>{r.requirement}</p>
                      <p className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.evidence.map((e) => (
                          <span key={e.label} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                            {e.label}
                          </span>
                        ))}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {pdfUrl ? (
                <>
                  <a
                    href={pdfUrl}
                    download={FILE_NAME}
                    className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-on-accent hover:opacity-90"
                  >
                    Download tailored résumé
                  </a>
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 hover:border-muted">
                    Open preview
                  </a>
                </>
              ) : result.resumeUrl ? (
                <a
                  href={result.resumeUrl}
                  className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-on-accent hover:opacity-90"
                >
                  Download résumé
                </a>
              ) : (
                <a href={`mailto:${email}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-5 hover:border-muted">
                  Contact Alfonso anyway
                </a>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
