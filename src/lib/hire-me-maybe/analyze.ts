// Ask Claude for a verdict and a selection, then turn its ids into a safe résumé selection.

import { experienceBank, projectBank, resumeSkills, skillPool, type ResumeSelection } from "@/data/resume";
import { sanitizeSelection } from "@/lib/resume/build";
import { answerSchema, systemPrompt, type ModelAnswer, type Verdict } from "@/lib/hire-me-maybe/prompt";

const API_URL = "https://api.anthropic.com/v1/messages";
export const MODEL = process.env.HIRE_ME_MAYBE_MODEL ?? "claude-sonnet-5-5";

export interface Evidence {
  label: string;
}

export interface Analysis {
  verdict: Verdict;
  role: string;
  field: string;
  requirements: { requirement: string; evidence: Evidence[] }[];
  selection: ResumeSelection | null;
}

export class AnalyzeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** One call to the Messages API with a JSON-schema structured output. */
export async function askClaude(posting: string, apiKey: string): Promise<ModelAnswer> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0,
      // The bank is the same on every request, so it's cached: later calls pay ~10% for it.
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `JOB POSTING\n"""\n${posting}\n"""` }],
      output_config: { format: { type: "json_schema", schema: answerSchema } },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Hire Me Maybe: Claude API error", res.status, detail.slice(0, 500));
    throw new AnalyzeError("The analysis service is unavailable right now.", 502);
  }
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  try {
    return JSON.parse(text) as ModelAnswer;
  } catch {
    throw new AnalyzeError("The analysis came back malformed. Please try again.", 502);
  }
}

// Short names for the evidence chips (the résumé itself prints the full event names).
const EVIDENCE_LABEL: Record<string, string> = {
  thinkcity: "ThinkCity 2026 (SkySAR)",
  hackmx: "HackMX (IdentifEye)",
  atrato: "Atrato Hackathon (FinanceAI)",
};
const bulletOwner = new Map<string, { label: string }>();
for (const e of experienceBank) for (const b of e.bullets) bulletOwner.set(b.id, { label: EVIDENCE_LABEL[e.id] ?? e.org });
for (const p of projectBank) for (const b of p.bullets) bulletOwner.set(b.id, { label: p.name });
const allSkills = new Set([...resumeSkills.flatMap((l) => l.items), ...Object.values(skillPool).flat()]);

/** Evidence ids → human labels; anything that isn't in the bank is dropped. */
function resolveEvidence(ids: string[]): Evidence[] {
  const out = new Map<string, Evidence>();
  for (const id of ids) {
    const owner = bulletOwner.get(id);
    const project = projectBank.find((p) => p.id === id);
    if (owner) out.set(owner.label, { label: owner.label });
    else if (project) out.set(project.name, { label: project.name });
    else if (allSkills.has(id)) out.set(id, { label: id });
  }
  return [...out.values()];
}

/** Model answer → validated analysis. Every id that isn't in src/data/resume.ts is discarded here. */
export function interpret(answer: ModelAnswer): Analysis {
  const verdict: Verdict = (["reject", "partial", "match"] as const).find((v) => v === answer.verdict?.toLowerCase()) ?? "partial";
  const clip = (s: string, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const requirements = (answer.requirements ?? [])
    .slice(0, 6)
    .map((r) => ({ requirement: clip(r.requirement, 110), evidence: resolveEvidence(r.evidence ?? []) }))
    .filter((r) => r.requirement && r.evidence.length);

  let selection: ResumeSelection | null = null;
  if (verdict === "match") {
    const experience = experienceBank.map((e) => ({
      id: e.id,
      bullets: (answer.experienceBullets ?? []).filter((b) => e.bullets.some((x) => x.id === b)),
    }));
    const projects = (answer.projects ?? []).map((id) => ({
      id,
      bullets: (answer.projectBullets ?? []).filter((b) => projectBank.find((p) => p.id === id)?.bullets.some((x) => x.id === b)),
    }));
    selection = sanitizeSelection({ experience, projects, extraSkills: answer.extraSkills ?? [] });
  }
  return {
    verdict,
    role: clip(answer.role, 90),
    field: clip(answer.field, 60),
    requirements: verdict === "match" ? requirements : [],
    selection,
  };
}
