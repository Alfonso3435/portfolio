import { ProjectCard } from "@/components/projects/ProjectCard";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { projects } from "@/data/projects";
import { getFeaturedProjects } from "@/lib/content";

export function FeaturedProjects() {
  return (
    <section aria-labelledby="featured-title">
      <Container className="flex flex-col gap-7 py-18">
        <SectionHeading
          id="featured-title"
          title="Featured projects"
          link={{ href: "/projects", label: `All ${projects.length} projects` }}
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-6">
          {getFeaturedProjects().map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      </Container>
    </section>
  );
}
