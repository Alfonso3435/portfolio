import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageIntro } from "@/components/ui/PageIntro";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Juan Alfonso Vega Sol.",
};

// Placeholder — the full page is built in an upcoming milestone.
export default function ContactPage() {
  return (
    <Container className="py-16">
      <PageIntro eyebrow="Contact" title="Let's build something.">
        Coming soon.
      </PageIntro>
    </Container>
  );
}
