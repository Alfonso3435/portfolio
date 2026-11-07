// POST /api/hire-me-maybe  { posting: string }
//
// reject  → a short explanation, no résumé
// partial → the approved base résumé (/resume.pdf)
// match   → a one-page résumé tailored from the approved bank, as a PDF (base64)

import { AnalyzeError, askClaude, interpret } from "@/lib/hire-me-maybe/analyze";
import type { ModelAnswer } from "@/lib/hire-me-maybe/prompt";
import { renderOnePage } from "@/lib/resume/fit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MIN_CHARS = 150;
const MAX_CHARS = 15_000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;

// Best-effort, per-instance rate limit: enough to stop casual abuse. The real cap on cost is
// the monthly spend limit set in the Anthropic Console.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  // Test hook (scripts/test-hire-me-maybe.ts): with HIRE_ME_MAYBE_FAKE=1 the request carries the model's
  // answer, so the validation and PDF pipeline can be tested without calling the API. Never set it in production.
  const fake = process.env.HIRE_ME_MAYBE_FAKE === "1";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !fake) return json({ error: "Hire Me Maybe isn't configured yet.", resumeUrl: "/resume.pdf" }, 503);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return json({ error: "Too many analyses in a few minutes. Please try again shortly.", resumeUrl: "/resume.pdf" }, 429);

  let posting = "";
  let fakeAnswer: ModelAnswer | undefined;
  try {
    const body = (await req.json()) as { posting?: unknown; fakeAnswer?: ModelAnswer };
    posting = String(body.posting ?? "").trim();
    if (fake) fakeAnswer = body.fakeAnswer;
  } catch {
    return json({ error: "Send the job posting as JSON: { posting }." }, 400);
  }
  if (posting.length < MIN_CHARS) return json({ error: "That's too short to be a job posting. Paste the full description." }, 400);
  if (posting.length > MAX_CHARS) return json({ error: `Please keep it under ${MAX_CHARS.toLocaleString("en-US")} characters.` }, 400);

  try {
    const analysis = interpret(fakeAnswer ?? (await askClaude(posting, apiKey!)));
    const base = { verdict: analysis.verdict, role: analysis.role, field: analysis.field, requirements: analysis.requirements };
    if (analysis.verdict !== "match" || !analysis.selection) {
      return json({ ...base, resumeUrl: analysis.verdict === "partial" ? "/resume.pdf" : null });
    }
    const { pdf, selection } = await renderOnePage(analysis.selection);
    // `selection` lists the ids that made it onto the page, for transparency and tests.
    return json({ ...base, pdf: pdf.toString("base64"), selection, resumeUrl: "/resume.pdf" });
  } catch (err) {
    const status = err instanceof AnalyzeError ? err.status : 500;
    if (!(err instanceof AnalyzeError)) console.error("Hire Me Maybe failed", err);
    return json({ error: err instanceof AnalyzeError ? err.message : "Something went wrong.", resumeUrl: "/resume.pdf" }, status);
  }
}
