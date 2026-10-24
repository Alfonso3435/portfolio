import Image from "next/image";
import type { Project } from "@/lib/types";

interface ProjectMediaProps {
  project: Project;
  /** Tailwind aspect ratio class, e.g. "aspect-video". */
  aspect?: string;
  /** Load eagerly when the image is visible on first paint (case-study hero). */
  priority?: boolean;
  sizes?: string;
}

/**
 * The project's cover image. Until you add images to projects.ts it renders a
 * clean typographic cover, so the layout already looks finished.
 */
export function ProjectMedia({
  project,
  aspect = "aspect-video",
  priority = false,
  sizes = "(min-width: 1024px) 560px, 100vw",
}: ProjectMediaProps) {
  const cover = project.images?.[0];

  return (
    <div className={`relative overflow-hidden bg-surface-2 ${aspect}`}>
      {cover ? (
        <Image
          src={cover.src}
          alt={cover.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          style={cover.position ? { objectPosition: cover.position } : undefined}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex flex-col justify-end gap-1 bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] bg-[size:32px_32px] p-6"
        >
          <span className="font-mono text-xs text-accent">{project.stack.slice(0, 2).join(" · ")}</span>
          <span className="font-display text-3xl font-bold tracking-tight text-fg/80">{project.title}</span>
        </div>
      )}
    </div>
  );
}
