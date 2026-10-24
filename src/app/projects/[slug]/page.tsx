import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectMedia } from "@/components/projects/ProjectMedia";
import { ProjectVideo } from "@/components/projects/ProjectVideo";
import { Chip } from "@/components/ui/Chip";
import { Container } from "@/components/ui/Container";
import { profile } from "@/data/profile";
import { projects } from "@/data/projects";
import { getAdjacentProjects, getAward, getProject, getProjectBadge } from "@/lib/content";
import { formatTeamSize } from "@/lib/format";

interface CaseStudyProps {
  // In Next.js 15+ route params arrive as a Promise, so pages await them.
  params: Promise<{ slug: string }>;
}

// Pre-render one static page per project at build time: /projects/identifeye, …
export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: CaseStudyProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return { title: project.title, description: project.pitch };
}

const linkLabels = { site: "Live site", demo: "Live demo", repo: "Source code", video: "Demo video" } as const;

export default async function CaseStudyPage({ params }: CaseStudyProps) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const award = getAward(project.awardId);
  const badge = getProjectBadge(project);
  const { next } = getAdjacentProjects(project.slug);
  const links = Object.entries(project.links).filter(([, url]) => Boolean(url)) as [keyof typeof linkLabels, string][];

  const facts = [
    { label: "My role", value: project.role },
    project.teamSize ? { label: "Team", value: formatTeamSize(project.teamSize) } : null,
    award ? { label: "Event", value: `${award.event} · ${award.organizer}` } : null,
    project.year ? { label: "Year", value: String(project.year) } : null,
  ].filter((f): f is { label: string; value: string } => f !== null);

  return (
    <Container className="flex flex-col gap-10 py-10 pb-20">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/projects" className="text-accent hover:text-fg">
          Projects
        </Link>{" "}
        / {project.title}
      </nav>

      <header className="flex max-w-3xl flex-col gap-4">
        {badge ? (
          <div>
            <Chip tone="accent">{badge}</Chip>
          </div>
        ) : null}
        <h1 className="font-display text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl">{project.title}</h1>
        <p className="text-xl text-muted">{project.pitch}</p>
      </header>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-px overflow-hidden rounded-2xl border border-line bg-line">
        {facts.map((f) => (
          <div key={f.label} className="bg-surface px-5 py-4">
            <dt className="font-mono text-xs uppercase text-muted">{f.label}</dt>
            <dd className="mt-1 font-semibold">{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-hidden rounded-2xl border border-line">
        <ProjectMedia project={project} aspect="aspect-[16/7]" priority sizes="(min-width: 1200px) 1152px, 100vw" />
      </div>

      <div className="flex flex-wrap gap-12">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-9">
          <section aria-labelledby="problem" className="flex flex-col gap-2.5">
            <h2 id="problem" className="font-display text-2xl font-bold">
              The problem
            </h2>
            <p className="text-[17px] text-muted">{project.problem}</p>
          </section>

          <section aria-labelledby="built" className="flex flex-col gap-2.5">
            <h2 id="built" className="font-display text-2xl font-bold">
              What I built
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[17px] marker:text-accent">
              {project.built.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {project.results?.length ? (
            <section aria-labelledby="results" className="flex flex-col gap-2.5">
              <h2 id="results" className="font-display text-2xl font-bold">
                Results
              </h2>
              <ul className="flex list-disc flex-col gap-2 pl-5 text-[17px] marker:text-accent">
                {project.results.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {project.videos?.length ? (
            <section aria-labelledby="video" className="flex flex-col gap-3">
              <h2 id="video" className="font-display text-2xl font-bold">
                {project.videos.length === 1 ? "Video" : "Videos"}
              </h2>
              {project.videos.map((video) => (
                <ProjectVideo key={video.title} video={video} />
              ))}
            </section>
          ) : null}

          {/* images[0] is the cover above; any extra images become a gallery. */}
          {project.images && project.images.length > 1 ? (
            <section aria-labelledby="gallery" className="flex flex-col gap-3">
              <h2 id="gallery" className="font-display text-2xl font-bold">
                Gallery
              </h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3">
                {project.images.slice(1).map((img) => (
                  <figure key={img.src} className="flex flex-col gap-2">
                    {/* object-contain: screenshots, diagrams and portrait photos are shown whole, never cropped. */}
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface-2">
                      <Image
                        src={img.src}
                        alt={img.alt}
                        fill
                        sizes="(min-width: 1024px) 360px, 100vw"
                        className="object-contain p-2"
                      />
                    </div>
                    <figcaption className="text-sm text-muted">{img.alt}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold">Stack</h2>
            <ul className="flex flex-wrap gap-1.5">
              {project.stack.map((tech) => (
                <li key={tech} className="rounded-md bg-surface-2 px-2.5 py-1 font-mono text-xs">
                  {tech}
                </li>
              ))}
            </ul>
          </div>

          {links.length ? (
            <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-5">
              <h2 className="font-semibold">Links</h2>
              {links.map(([kind, url]) => (
                <a key={kind} href={url} target="_blank" rel="noreferrer" className="text-[15px] text-accent hover:text-fg">
                  {linkLabels[kind]} →
                </a>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold">Questions about this project?</h2>
            <a href={`mailto:${profile.email}`} className="text-[15px] text-accent hover:text-fg">
              Email me →
            </a>
          </div>
        </aside>
      </div>

      <nav aria-label="More projects" className="flex flex-wrap justify-between gap-4 border-t border-line pt-6 text-[15px]">
        <Link href="/projects" className="text-accent hover:text-fg">
          ← All projects
        </Link>
        <Link href={`/projects/${next.slug}`} className="font-semibold text-accent hover:text-fg">
          Next: {next.title} →
        </Link>
      </nav>
    </Container>
  );
}
