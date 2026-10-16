import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { skillGroups } from "@/data/skills";
import { getProject } from "@/lib/content";

// Home shows the first 3 groups and their first 4 proven skills; About shows everything.
const GROUPS_ON_HOME = 3;
const SKILLS_PER_GROUP = 4;

export function SkillsPreview() {
  const groups = skillGroups.slice(0, GROUPS_ON_HOME).map((group) => ({
    name: group.name,
    skills: group.skills.filter((s) => s.projectSlugs.length > 0).slice(0, SKILLS_PER_GROUP),
  }));

  return (
    <section aria-labelledby="skills-title">
      <Container className="flex flex-col gap-5 pb-18">
        <SectionHeading id="skills-title" title="Skills, with proof" link={{ href: "/about", label: "All skills" }} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
          {groups.map((group) => (
            <div key={group.name} className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-6">
              <h3 className="font-semibold">{group.name}</h3>
              <ul className="flex flex-wrap gap-2">
                {group.skills.map((skill) => {
                  const proof = getProject(skill.projectSlugs[0]);
                  return (
                    <li key={skill.name}>
                      <Link
                        href={`/projects/${skill.projectSlugs[0]}`}
                        className="inline-flex rounded-lg bg-surface-2 px-3 py-1.5 text-sm hover:text-accent"
                      >
                        {skill.name}
                        {proof ? <span className="text-muted">&nbsp;· {proof.title}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
