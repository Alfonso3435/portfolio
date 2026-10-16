import Link from "next/link";
import { skillGroups } from "@/data/skills";
import { getProject } from "@/lib/content";

export function SkillsGrid() {
  return (
    <section aria-labelledby="skills" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 id="skills" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Skills
        </h2>
        <p className="text-muted">Every skill links to the projects where I used it.</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-4">
        {skillGroups.map((group) => (
          <div key={group.name} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
            <h3 className="font-semibold">{group.name}</h3>
            <ul className="flex flex-col divide-y divide-line">
              {group.skills.map((skill) => (
                <li key={skill.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                  <span className="text-[15px]">{skill.name}</span>
                  <span className="flex flex-wrap gap-x-2 text-sm">
                    {skill.projectSlugs.length === 0 ? (
                      <span className="text-muted">Coursework</span>
                    ) : (
                      skill.projectSlugs.slice(0, 3).map((slug) => (
                        <Link key={slug} href={`/projects/${slug}`} className="text-accent hover:text-fg">
                          {getProject(slug)?.title ?? slug}
                        </Link>
                      ))
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
