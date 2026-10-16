import { Container } from "@/components/ui/Container";
import { awards } from "@/data/awards";
import { experience } from "@/data/experience";
import { profile } from "@/data/profile";
import { getProject } from "@/lib/content";
import { formatLongYearMonth } from "@/lib/format";

interface Highlight {
  label: string;
  title: string;
  detail: string;
}

/** Built entirely from data: add an award or a venture and it shows up here. */
function getHighlights(): Highlight[] {
  const wins: Highlight[] = awards
    .filter((a) => a.kind === "win")
    .sort((a, b) => b.year - a.year)
    .map((a) => ({
      label: a.placement,
      title: a.title,
      detail: [a.year, getProject(a.projectSlug ?? "")?.title].filter(Boolean).join(" · "),
    }));

  const ventures: Highlight[] = experience
    .filter((e) => e.role.includes("Founder"))
    .map((e) => ({ label: "Founder", title: e.company, detail: e.short ?? e.summary }));

  const school = profile.education[0];
  const education: Highlight = {
    label: "Education",
    title: school.short ?? school.school,
    detail: school.expectedGraduation ? `Expected ${formatLongYearMonth(school.expectedGraduation)}` : school.degree,
  };

  return [...wins, ...ventures, education];
}

export function Highlights() {
  return (
    <section aria-label="Highlights" className="border-y border-line bg-surface">
      <Container>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-6 py-7">
          {getHighlights().map((h) => (
            <li key={`${h.label}-${h.title}`} className="flex flex-col gap-1">
              <p className="font-mono text-xs uppercase text-accent">{h.label}</p>
              <p className="text-[15px] leading-snug font-semibold">{h.title}</p>
              <p className="text-[13px] text-muted">{h.detail}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
