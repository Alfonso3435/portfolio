import type { Metadata } from "next";
import { ProjectFilter } from "@/components/projects/ProjectFilter";
import { Container } from "@/components/ui/Container";
import { PageIntro } from "@/components/ui/PageIntro";
import { projects } from "@/data/projects";

export const metadata: Metadata = {
  title: "Projects",
  description: "AI/ML, full-stack and hackathon projects by Juan Alfonso Vega Sol, each with a case study.",
};

export default function ProjectsPage() {
  return (
    <Container className="flex flex-col gap-10 py-16 pb-20">
      <PageIntro eyebrow="Projects" title="Things I've built">
        From award-winning hackathon prototypes to products with real customers. Each card opens a case study: the
        problem, what I built, my role and the result.
      </PageIntro>
      <ProjectFilter projects={projects} />
    </Container>
  );
}
