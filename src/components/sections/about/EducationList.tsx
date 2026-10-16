import { profile } from "@/data/profile";
import { formatDateRange, formatLongYearMonth } from "@/lib/format";
import type { Education } from "@/lib/types";

function datesLabel(edu: Education): string {
  if (edu.expectedGraduation) return `Expected ${formatLongYearMonth(edu.expectedGraduation)}`;
  return edu.dates ? formatDateRange(edu.dates) : "";
}

export function EducationList() {
  return (
    <section aria-labelledby="education" className="flex flex-col gap-6">
      <h2 id="education" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Education
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
        {profile.education.map((edu) => (
          <article key={edu.school} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-[17px] font-semibold leading-snug">{edu.school}</h3>
              <p className="text-[15px] text-muted">{edu.degree}</p>
              <p className="font-mono text-[13px] text-accent">
                {[datesLabel(edu), edu.gpa ? `GPA ${edu.gpa}` : ""].filter(Boolean).join(" · ")}
              </p>
            </div>
            {edu.notes?.length ? (
              <ul className="flex flex-col gap-1 text-sm text-muted">
                {edu.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
            <details className="mt-auto text-sm">
              <summary className="cursor-pointer text-muted hover:text-fg">Relevant coursework</summary>
              <p className="mt-2 text-muted">{edu.coursework.join(" · ")}</p>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
