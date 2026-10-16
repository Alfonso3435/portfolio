import Link from "next/link";
import { awards } from "@/data/awards";
import { getProject } from "@/lib/content";

export function Recognition() {
  const sorted = [...awards].sort((a, b) => b.year - a.year);

  return (
    <section aria-labelledby="recognition" className="flex flex-col gap-6">
      <h2 id="recognition" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Awards &amp; recognition
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
        {sorted.map((award) => {
          const project = award.projectSlug ? getProject(award.projectSlug) : undefined;
          return (
            <li key={award.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-6">
              <p className="font-mono text-xs uppercase text-accent">
                {award.placement} · {award.year}
              </p>
              <h3 className="text-[17px] font-semibold leading-snug">{award.title}</h3>
              <p className="text-sm text-muted">{award.organizer}</p>
              <p className="text-[15px] text-muted">{award.summary}</p>
              {project ? (
                <Link
                  href={`/projects/${project.slug}`}
                  className="mt-auto pt-1 text-[15px] font-semibold text-accent hover:text-fg"
                >
                  {project.title} case study →
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
