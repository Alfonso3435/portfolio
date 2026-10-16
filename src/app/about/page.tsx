import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageIntro } from "@/components/ui/PageIntro";

export const metadata: Metadata = {
  title: "About",
  description: "Experience, education, skills and learning path of Juan Alfonso Vega Sol.",
};

// Placeholder — the full page is built in an upcoming milestone.
export default function AboutPage() {
  return (
    <Container className="py-16">
      <PageIntro eyebrow="About" title="About me">
        Coming soon.
      </PageIntro>
    </Container>
  );
}
