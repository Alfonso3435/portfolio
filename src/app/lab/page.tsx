import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageIntro } from "@/components/ui/PageIntro";

export const metadata: Metadata = {
  title: "Lab",
  description: "Ask Alfonso, a language model built from scratch, and other interactive ML tools.",
};

// Placeholder — the full page is built in an upcoming milestone.
export default function LabPage() {
  return (
    <Container className="py-16">
      <PageIntro eyebrow="Lab" title="Ask Alfonso: a language model I built from scratch">
        Coming soon.
      </PageIntro>
    </Container>
  );
}
