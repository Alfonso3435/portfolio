// Turn a selection of ids into a résumé document, refusing anything that isn't in the bank.
//
// This is the honesty boundary of Hire Me Maybe: whatever the model returns, only ids that
// exist in src/data/resume.ts survive, and the text always comes from that file.

import {
  baseSelection,
  experienceBank,
  projectBank,
  resumeContact,
  resumeEducation,
  resumeName,
  resumeSkills,
  skillPool,
  type ResumeExperience,
  type ResumeProject,
  type ResumeSelection,
  type SkillLine,
} from "@/data/resume";

export interface ResumeDoc {
  name: string;
  contact: typeof resumeContact;
  education: typeof resumeEducation;
  skills: SkillLine[];
  experience: (Omit<ResumeExperience, "bullets" | "about"> & { bullets: string[] })[];
  projects: (Omit<ResumeProject, "bullets" | "about" | "priority"> & { bullets: string[] })[];
}

const FLAGSHIP = "ask-alfonso";
const MAX_PROJECTS = 4;
const MAX_EXTRA_SKILLS = 6;
// Caps that keep any selection close to one page before the fitter trims the rest.
const maxBullets = (id: string) => (id === "answr" || id === FLAGSHIP ? 3 : 2);

/**
 * Keep only valid ids, in a sane order:
 * - experience in the bank's (reverse-chronological) order, each with 1+ real bullets;
 * - projects in the model's order, the flagship always first;
 * - extra skills that are in the pool and not already listed.
 */
export function sanitizeSelection(raw: ResumeSelection): ResumeSelection {
  const experience = experienceBank
    .map((entry) => {
      const picked = raw.experience.find((e) => e.id === entry.id);
      if (!picked) return null;
      const valid = new Set(entry.bullets.map((b) => b.id));
      const bullets = [...new Set(picked.bullets)].filter((id) => valid.has(id)).slice(0, maxBullets(entry.id));
      return bullets.length ? { id: entry.id, bullets } : null;
    })
    .filter((e): e is { id: string; bullets: string[] } => e !== null);

  const seen = new Set<string>();
  let projects = raw.projects
    .map((p) => {
      const entry = projectBank.find((b) => b.id === p.id);
      if (!entry || seen.has(p.id)) return null;
      seen.add(p.id);
      const valid = new Set(entry.bullets.map((b) => b.id));
      const bullets = [...new Set(p.bullets)].filter((id) => valid.has(id)).slice(0, maxBullets(p.id));
      return bullets.length ? { id: p.id, bullets } : null;
    })
    .filter((p): p is { id: string; bullets: string[] } => p !== null);
  // The flagship project always leads (Alfonso's rule), with its base bullets if the model dropped it.
  const flagship = projects.find((p) => p.id === FLAGSHIP) ?? baseSelection.projects.find((p) => p.id === FLAGSHIP)!;
  projects = [flagship, ...projects.filter((p) => p.id !== FLAGSHIP)].slice(0, MAX_PROJECTS);

  const listed = new Set(resumeSkills.flatMap((l) => l.items));
  const pool = new Set(Object.values(skillPool).flat());
  const extraSkills = [...new Set(raw.extraSkills)].filter((s) => pool.has(s) && !listed.has(s)).slice(0, MAX_EXTRA_SKILLS);

  // Without the four core experience entries the résumé loses its awards; fall back to the base ones.
  const required = ["answr", "thinkcity", "hackmx", "atrato"];
  for (const id of required) {
    if (!experience.some((e) => e.id === id)) {
      const base = baseSelection.experience.find((e) => e.id === id)!;
      experience.splice(experienceBank.findIndex((b) => b.id === id), 0, base);
    }
  }
  experience.sort((a, b) => experienceBank.findIndex((x) => x.id === a.id) - experienceBank.findIndex((x) => x.id === b.id));

  return { experience, projects, extraSkills };
}

/** Resolve a (sanitized) selection into printable text. */
export function buildResume(selection: ResumeSelection): ResumeDoc {
  const skills = resumeSkills.map((line) => ({
    label: line.label,
    items: [...line.items, ...selection.extraSkills.filter((s) => skillPool[line.label]?.includes(s))],
  }));
  return {
    name: resumeName,
    contact: resumeContact,
    education: resumeEducation,
    skills,
    experience: selection.experience.map(({ id, bullets }) => {
      const entry = experienceBank.find((e) => e.id === id)!;
      return {
        id: entry.id, title: entry.title, org: entry.org, orgHref: entry.orgHref, dates: entry.dates, location: entry.location,
        bullets: bullets.map((b) => entry.bullets.find((x) => x.id === b)!.text),
      };
    }),
    projects: selection.projects.map(({ id, bullets }) => {
      const entry = projectBank.find((p) => p.id === id)!;
      return {
        id: entry.id, name: entry.name, subtitle: entry.subtitle, stack: entry.stack, right: entry.right, rightHref: entry.rightHref,
        bullets: bullets.map((b) => entry.bullets.find((x) => x.id === b)!.text),
      };
    }),
  };
}

/**
 * One step shorter, in an order that protects the strongest content: extra bullets on weaker
 * projects, then on hackathons, then ZapTap, then Answr's third bullet, then the weakest
 * project, and only at the very end the flagship's second bullet. Returns null when nothing
 * more can go.
 */
export function shorten(selection: ResumeSelection): ResumeSelection | null {
  const priority = (id: string) => projectBank.find((p) => p.id === id)!.priority;
  const clone = (): ResumeSelection => ({
    experience: selection.experience.map((e) => ({ ...e, bullets: [...e.bullets] })),
    projects: selection.projects.map((p) => ({ ...p, bullets: [...p.bullets] })),
    extraSkills: selection.extraSkills,
  });
  // Weakest first: higher priority number, then later in the list.
  const weakProjects = (s: ResumeSelection) =>
    [...s.projects].reverse().sort((a, b) => priority(b.id) - priority(a.id)).filter((p) => p.id !== FLAGSHIP);
  // Weakest first: ZapTap, then the oldest hackathon.
  const weakExperience = (s: ResumeSelection) => [...s.experience].reverse().filter((e) => e.id !== "answr");

  const steps: ((s: ResumeSelection) => boolean)[] = [
    (s) => { const p = weakProjects(s).find((x) => x.bullets.length > 1); return !!p && !!p.bullets.pop(); },
    (s) => { const p = s.projects.find((x) => x.id === FLAGSHIP && x.bullets.length > 2); return !!p && !!p.bullets.pop(); },
    (s) => { const e = weakExperience(s).find((x) => x.bullets.length > 1); return !!e && !!e.bullets.pop(); },
    (s) => { const i = s.experience.findIndex((x) => x.id === "zaptap"); if (i < 0) return false; s.experience.splice(i, 1); return true; },
    (s) => { const e = s.experience.find((x) => x.id === "answr" && x.bullets.length > 2); return !!e && !!e.bullets.pop(); },
    (s) => { if (s.projects.length <= 3) return false; const p = weakProjects(s)[0]; s.projects = s.projects.filter((x) => x !== p); return true; },
    (s) => { const p = s.projects.find((x) => x.id === FLAGSHIP && x.bullets.length > 1); return !!p && !!p.bullets.pop(); },
    (s) => { if (s.projects.length <= 2) return false; const p = weakProjects(s)[0]; s.projects = s.projects.filter((x) => x !== p); return true; },
    (s) => { const e = s.experience.find((x) => x.id === "answr" && x.bullets.length > 1); return !!e && !!e.bullets.pop(); },
  ];
  for (const step of steps) {
    const next = clone();
    if (step(next)) return next;
  }
  return null;
}
