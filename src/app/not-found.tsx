import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PageIntro } from "@/components/ui/PageIntro";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <Container className="flex flex-col gap-8 py-24">
      <PageIntro eyebrow="404" title="This page doesn't exist.">
        The link may be old or mistyped. Here are the places worth visiting:
      </PageIntro>
      <div className="flex flex-wrap gap-2.5">
        <ButtonLink href="/">Home</ButtonLink>
        <ButtonLink href="/projects" variant="secondary">
          Projects
        </ButtonLink>
        <ButtonLink href="/contact" variant="secondary">
          Contact
        </ButtonLink>
      </div>
    </Container>
  );
}
