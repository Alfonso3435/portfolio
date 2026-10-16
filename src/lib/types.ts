// Shared content types. Every page AND the Ask Alfonso dataset are generated
// from data that follows these types, so the site and the model never disagree.

/** "YYYY-MM" (e.g. "2025-03"), or "YYYY" when the month is unknown. */
export type YearMonth = string;

export interface DateRange {
  start: YearMonth;
  /** Omit for ongoing roles — rendered as "Present". */
  end?: YearMonth;
  /** Overrides the auto-formatted label, e.g. "Late 2025 — Present". */
  display?: string;
}

export interface Education {
  school: string;
  /** Compact label for tight spaces, e.g. "UW Allen School · B.S. CS". */
  short?: string;
  degree: string;
  location: string;
  dates?: DateRange;
  expectedGraduation?: YearMonth;
  gpa?: string;
  coursework: string[];
  notes?: string[];
}

export interface SpokenLanguage {
  language: string;
  level: string;
}

export interface Profile {
  name: string;
  /** Name used in copy and by the chatbot ("Ask Alfonso"). */
  shortName: string;
  headline: string;
  tagline: string;
  summary: string;
  location: string;
  email: string;
  siteUrl: string;
  resumeUrl: string;
  assistantName: string;
  /** Path under /public, e.g. "/headshot.jpg". The About photo is hidden until set. */
  headshot?: string;
  links: {
    github: string;
    linkedin: string;
  };
  lookingFor: {
    /** One line for the hero. */
    short: string;
    /** Full sentence for the Contact page. */
    long: string;
  };
  focusAreas: string[];
  spokenLanguages: SpokenLanguage[];
  education: Education[];
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  url?: string;
  location?: string;
  dates: DateRange;
  summary: string;
  /** Few-word hook for the Home highlights strip, e.g. "AI agent · <30 s response". */
  short?: string;
  highlights: string[];
  stack: string[];
  /** Links to a case study in projects.ts. */
  projectSlug?: string;
}

export type ProjectCategory = "ai-ml" | "full-stack" | "hackathon" | "iot";

export type ProjectStatus = "shipped" | "prototype" | "in-progress";

export interface ProjectImage {
  /** Path under /public, e.g. "/projects/identifeye/cover.jpg". */
  src: string;
  alt: string;
}

export interface Project {
  /** URL segment: /projects/[slug]. Also the folder name for images. */
  slug: string;
  title: string;
  /** One-line pitch shown on cards. */
  pitch: string;
  categories: ProjectCategory[];
  /** Shown on the home page. */
  featured: boolean;
  status: ProjectStatus;
  year?: number;
  /** 1 = individual project. Omit when unknown. */
  teamSize?: number;
  role: string;
  problem: string;
  built: string[];
  stack: string[];
  results?: string[];
  /** Links to an entry in awards.ts. */
  awardId?: string;
  links: Partial<Record<"repo" | "demo" | "video" | "site", string>>;
  images?: ProjectImage[];
}

export type AwardKind = "win" | "recognition";

export interface Award {
  id: string;
  kind: AwardKind;
  /** What you won, e.g. "1st Place" or "Community Impact Award". */
  placement: string;
  /** The challenge or track, e.g. "El Puerto de Liverpool AI Challenge". */
  title: string;
  event: string;
  organizer: string;
  year: number;
  projectSlug?: string;
  summary: string;
}

export interface Skill {
  name: string;
  /** Projects that prove this skill — each skill links to evidence. */
  projectSlugs: string[];
}

export interface SkillGroup {
  name: string;
  skills: Skill[];
}

export interface Certification {
  title: string;
  issuer: string;
  /** Groups courses on the learning timeline, e.g. "Deep Learning Specialization". */
  program?: string;
  date?: YearMonth;
  score?: string;
  verifyUrl?: string;
}

// ── Lab page ────────────────────────────────────────────────────────────────

export interface LabStep {
  label: string;
  title: string;
  description: string;
  /** The course or past project this step builds on. */
  foundation?: string;
}

export type LabToolStatus = "planned" | "in-progress" | "live";

export interface LabTool {
  name: string;
  description: string;
  /** What it reuses from earlier work. */
  builtOn: string;
  priority: 1 | 2 | 3;
  status: LabToolStatus;
}
