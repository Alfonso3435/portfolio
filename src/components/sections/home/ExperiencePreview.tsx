import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { experience } from "@/data/experience";
import { formatDateRange } from "@/lib/format";

export function ExperiencePreview() {
  return (
    <section aria-labelledby="experience-title">
      <Container className="flex flex-col gap-5 pb-18">
        <SectionHeading id="experience-title" title="Experience" link={{ href: "/about", label: "Full profile" }} />
        <ol className="border-t border-line">
          {experience.map((job) => (
            <li key={job.id} className="flex flex-wrap gap-x-8 gap-y-1.5 border-b border-line py-5">
              <p className="flex-[0_0_200px] pt-0.5 font-mono text-[13px] text-muted">{formatDateRange(job.dates)}</p>
              <div className="min-w-0 flex-[1_1_420px]">
                <h3 className="text-[17px] font-semibold">
                  {job.role} · {job.company}
                </h3>
                <p className="mt-1 text-[15px] text-muted">{job.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
