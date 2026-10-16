"use client";

// The only interactive part of the Projects page. The page itself stays a
// Server Component and hands the data down as props.
import { useState } from "react";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { categoryLabels } from "@/lib/content";
import type { Project, ProjectCategory } from "@/lib/types";

type Filter = "all" | ProjectCategory;

const filters: Filter[] = ["all", "ai-ml", "full-stack", "hackathon", "iot"];

const filterLabels: Record<Filter, string> = {
  all: "All",
  ...categoryLabels,
  hackathon: "Hackathons",
};

export function ProjectFilter({ projects }: { projects: Project[] }) {
  const [active, setActive] = useState<Filter>("all");

  const countFor = (f: Filter) =>
    f === "all" ? projects.length : projects.filter((p) => p.categories.includes(f)).length;

  const shown = active === "all" ? projects : projects.filter((p) => p.categories.includes(active));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Filter projects by category" className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const isActive = f === active;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActive(f)}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium transition-colors ${
                  isActive
                    ? "border-accent bg-accent text-on-accent"
                    : "border-line text-fg hover:border-muted"
                }`}
              >
                {filterLabels[f]}
                <span className="opacity-70">{countFor(f)}</span>
              </button>
            );
          })}
        </div>
        {/* aria-live announces the new count to screen-reader users after each click. */}
        <p aria-live="polite" className="font-mono text-[13px] text-muted">
          {shown.length} {shown.length === 1 ? "project" : "projects"}
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-6">
        {shown.map((project) => (
          <ProjectCard key={project.slug} project={project} headingLevel="h2" />
        ))}
      </div>
    </div>
  );
}
