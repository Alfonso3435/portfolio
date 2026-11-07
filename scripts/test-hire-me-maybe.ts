// Tests for Hire Me Maybe's honesty boundary and one-page fitting.
//
//   1. unit: sanitizeSelection() keeps only ids that exist in src/data/resume.ts
//   2. end to end: POST /api/hire-me-maybe with a fake model answer (no API key needed)
//
//   HIRE_ME_MAYBE_FAKE=1 npm run dev        (or next start)
//   npm run test:hire-me-maybe              (BASE=http://localhost:3000 by default)

import { baseSelection, experienceBank, projectBank, skillPool } from "../src/data/resume";
import { sanitizeSelection } from "../src/lib/resume/build";

const BASE = process.env.BASE ?? "http://localhost:3000";
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok || !detail ? "" : `\n    ${detail}`}`);
}

const bulletIds = new Set([...experienceBank, ...projectBank].flatMap((e) => e.bullets.map((b) => b.id)));
const posting = "Machine Learning Engineer Intern. ".repeat(10);

// ── unit ──────────────────────────────────────────────────────────────────────
{
  const s = sanitizeSelection(baseSelection);
  check("base selection survives sanitizing unchanged", JSON.stringify(s) === JSON.stringify(baseSelection));

  const dirty = sanitizeSelection({
    experience: [
      { id: "atrato", bullets: ["atrato-win", "invented-bullet"] },
      { id: "google", bullets: ["google-swe"] },
      { id: "answr", bullets: ["answr-voice", "answr-voice"] },
    ],
    projects: [
      { id: "pdf-chatbot", bullets: ["pdf-rag", "lie-main"] },
      { id: "made-up", bullets: ["x"] },
      { id: "can-ai-spot-a-lie", bullets: ["lie-main"] },
    ],
    extraSkills: ["LangChain", "Kubernetes", "Python", "LangChain"],
  });
  check("unknown entries and bullets are dropped", !JSON.stringify(dirty).match(/google|invented|made-up|"x"/));
  check("a bullet can't move to another project", !dirty.projects.find((p) => p.id === "pdf-chatbot")!.bullets.includes("lie-main"));
  check("duplicate bullets are removed", dirty.experience.find((e) => e.id === "answr")!.bullets.length === 1);
  check("the flagship project is always first", dirty.projects[0].id === "ask-alfonso");
  check("the four core experience entries are always present, in order",
    dirty.experience.map((e) => e.id).join() === "answr,thinkcity,hackmx,atrato");
  check("only pool skills that aren't listed yet are added", dirty.extraSkills.join() === "LangChain");
}

// ── end to end ────────────────────────────────────────────────────────────────
interface Reply {
  verdict?: string;
  pdf?: string;
  resumeUrl?: string | null;
  error?: string;
  requirements?: { requirement: string; evidence: { label: string }[] }[];
  selection?: { experience: { id: string; bullets: string[] }[]; projects: { id: string; bullets: string[] }[]; extraSkills: string[] };
}

async function post(body: object): Promise<{ status: number; data: Reply }> {
  const res = await fetch(`${BASE}/api/hire-me-maybe`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `test-${Math.random()}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as Reply };
}
const empty = { role: "Role", field: "Field", requirements: [], experienceBullets: [], projects: [], projectBullets: [], extraSkills: [] };
const pages = (b64: string) => (Buffer.from(b64, "base64").toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

async function e2e() {
  let r = await post({ posting: "too short" });
  check("rejects text that's too short to be a posting", r.status === 400);

  r = await post({ posting, fakeAnswer: { ...empty, verdict: "reject", field: "Graphic design" } });
  check("reject → no résumé", r.data.verdict === "reject" && !r.data.pdf && r.data.resumeUrl === null);

  r = await post({ posting, fakeAnswer: { ...empty, verdict: "partial" } });
  check("partial → the standard résumé", r.data.verdict === "partial" && !r.data.pdf && r.data.resumeUrl === "/resume.pdf");

  r = await post({ posting, fakeAnswer: { ...empty, verdict: "MAYBE?" } });
  check("an unknown verdict falls back to partial", r.data.verdict === "partial");

  r = await post({
    posting,
    fakeAnswer: {
      ...empty,
      verdict: "match",
      requirements: [
        { requirement: "Experience with PyTorch and transformers", evidence: ["ask-model", "PyTorch"] },
        { requirement: "Kubernetes in production", evidence: ["k8s-cluster"] },
      ],
      experienceBullets: ["answr-voice", "answr-json", "thinkcity-award", "hackmx-win", "hackmx-storage", "atrato-win", "fake-bullet"],
      projects: ["pdf-chatbot", "ask-alfonso", "google-internship"],
      projectBullets: ["pdf-rag", "ask-model", "ask-results", "ask-data", "invented"],
      extraSkills: ["Retrieval-Augmented Generation (RAG)", "LangChain", "Kubernetes"],
    },
  });
  const sel = r.data.selection!;
  const used = [...sel.experience, ...sel.projects].flatMap((e) => e.bullets);
  check("match → a one-page PDF", r.data.verdict === "match" && !!r.data.pdf && pages(r.data.pdf) === 1, `pages: ${r.data.pdf && pages(r.data.pdf)}`);
  check("every bullet on the page exists in the bank", used.every((b) => bulletIds.has(b)), used.join());
  check("invented ids never reach the page", !JSON.stringify(sel).match(/fake|invented|google/));
  check("Ask Alfonso leads the projects", sel.projects[0].id === "ask-alfonso");
  check("invented skills are dropped", sel.extraSkills.join() === "Retrieval-Augmented Generation (RAG),LangChain");
  check("requirements without real evidence are hidden",
    r.data.requirements?.length === 1 && r.data.requirements[0].evidence.map((e) => e.label).join() === "Ask Alfonso,PyTorch");

  // Everything at once must still fit on one page.
  const allPool = Object.values(skillPool).flat();
  r = await post({
    posting,
    fakeAnswer: {
      ...empty,
      verdict: "match",
      experienceBullets: experienceBank.flatMap((e) => e.bullets.map((b) => b.id)),
      projects: projectBank.map((p) => p.id),
      projectBullets: projectBank.flatMap((p) => p.bullets.map((b) => b.id)),
      extraSkills: allPool,
    },
  });
  check("the whole bank at once is trimmed to one page", !!r.data.pdf && pages(r.data.pdf) === 1, r.data.error ?? "");
  console.log(`    kept: ${r.data.selection?.projects.map((p) => `${p.id}(${p.bullets.length})`).join(", ")}`);
}

e2e()
  .catch((e) => {
    failed++;
    console.error(`✗ end-to-end tests couldn't run (is the server up at ${BASE} with HIRE_ME_MAYBE_FAKE=1?)`, e.message);
  })
  .finally(() => {
    console.log(failed ? `\n${failed} failed` : "\nall passed");
    if (failed) process.exit(1);
  });
