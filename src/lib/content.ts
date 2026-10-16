// Read-only helpers over src/data. Pages ask questions here ("which projects
// are featured?", "what award goes with this project?") instead of filtering
// arrays themselves, so every page answers them the same way.
import { awards } from "@/data/awards";
import { experience } from "@/data/experience";
import { projects } from "@/data/projects";
import type { Award, Project, ProjectCategory } from "@/lib/types";

export const categoryLabels: Record<ProjectCategory, string> = {
  "ai-ml": "AI / ML",
  "full-stack": "Full-stack",
  hackathon: "Hackathon",
  iot: "IoT & hardware",
};

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getAward(id: string | undefined): Award | undefined {
  return id ? awards.find((a) => a.id === id) : undefined;
}

export function getFeaturedProjects(): Project[] {
  return projects.filter((p) => p.featured);
}

/** Projects that are also a company Alfonso runs (Answr, ZapTap). */
export function isVenture(project: Project): boolean {
  return experience.some((e) => e.projectSlug === project.slug && e.role.includes("Founder"));
}

/** The highlighted badge on a project card: award first, then venture or status. */
export function getProjectBadge(project: Project): string | undefined {
  const award = getAward(project.awardId);
  if (award) return `${award.placement} · ${award.event}`;
  if (project.status === "in-progress") return "In progress";
  if (isVenture(project)) return "Venture";
  return undefined;
}

/** Category label for cards; "Hackathon" is skipped because the award badge says it. */
export function getProjectTags(project: Project): string {
  return project.categories
    .filter((c) => c !== "hackathon")
    .map((c) => categoryLabels[c])
    .join(" · ");
}

/** Previous/next project in the order of projects.ts, wrapping around. */
export function getAdjacentProjects(slug: string): { prev: Project; next: Project } {
  const i = projects.findIndex((p) => p.slug === slug);
  const n = projects.length;
  return { prev: projects[(i - 1 + n) % n], next: projects[(i + 1) % n] };
}
