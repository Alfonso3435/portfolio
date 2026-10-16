import Link from "next/link";
import { ProjectMedia } from "@/components/projects/ProjectMedia";
import { Chip } from "@/components/ui/Chip";
import { getProjectBadge, getProjectTags } from "@/lib/content";
import type { Project } from "@/lib/types";

interface ProjectCardProps {
  project: Project;
  /** h2 on the Projects page, h3 inside a Home section. */
  headingLevel?: "h2" | "h3";
}

export function ProjectCard({ project, headingLevel = "h3" }: ProjectCardProps) {
  const Heading = headingLevel;
  const badge = getProjectBadge(project);
  const href = `/projects/${project.slug}`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-muted">
      <div className="border-b border-line">
        <ProjectMedia project={project} />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex flex-wrap gap-2">
          {badge ? <Chip tone="accent">{badge}</Chip> : null}
          <Chip>{getProjectTags(project)}</Chip>
        </div>
        <Heading className="font-display text-2xl font-bold tracking-tight">
          {/* The ::after makes the whole card clickable while keeping one link for screen readers. */}
          <Link href={href} className="after:absolute after:inset-0 after:content-['']">
            {project.title}
          </Link>
        </Heading>
        <p className="text-[15px] text-muted">{project.pitch}</p>
        <p className="font-mono text-xs text-muted">{project.stack.slice(0, 4).join(" · ")}</p>
        <span aria-hidden="true" className="mt-auto pt-2 text-[15px] font-semibold text-accent group-hover:text-fg">
          Read case study →
        </span>
      </div>
    </article>
  );
}
