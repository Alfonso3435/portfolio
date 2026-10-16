import Link from "next/link";
import { experience } from "@/data/experience";
import { formatDateRange } from "@/lib/format";

export function ExperienceTimeline() {
  return (
    <section aria-labelledby="experience" className="flex flex-col gap-6">
      <h2 id="experience" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Experience
      </h2>
      <ol className="flex flex-col">
        {experience.map((job) => (
          <li
            key={job.id}
            className="flex flex-wrap gap-x-10 gap-y-2 border-b border-line py-6 first:pt-0 last:border-b-0"
          >
            <div className="flex-[0_0_220px]">
              <p className="font-mono text-[13px] text-muted">{formatDateRange(job.dates)}</p>
              {job.location ? <p className="mt-1 text-sm text-muted">{job.location}</p> : null}
            </div>
            <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-2.5">
              <h3 className="text-xl font-semibold">
                {job.role} ·{" "}
                {job.url ? (
                  <a href={job.url} target="_blank" rel="noreferrer" className="text-accent hover:text-fg">
                    {job.company}
                  </a>
                ) : (
                  job.company
                )}
              </h3>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted marker:text-accent">
                {job.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              <p className="font-mono text-xs text-muted">{job.stack.join(" · ")}</p>
              {job.projectSlug ? (
                <Link href={`/projects/${job.projectSlug}`} className="text-[15px] font-semibold text-accent hover:text-fg">
                  Case study →
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
