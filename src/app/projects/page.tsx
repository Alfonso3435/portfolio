import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageIntro } from "@/components/ui/PageIntro";

export const metadata: Metadata = {
  title: "Projects",
  description: "AI/ML, full-stack and hackathon projects by Juan Alfonso Vega Sol.",
};

// Placeholder — the full page is built in an upcoming milestone.
export default function ProjectsPage() {
  return (
    <Container className="py-16">
      <PageIntro eyebrow="Projects" title="Things I've built">
        Coming soon.
      </PageIntro>
    </Container>
  );
}
