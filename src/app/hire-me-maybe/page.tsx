import type { Metadata } from "next";
import { HireMeMaybe } from "@/components/hire/HireMeMaybe";
import { Container } from "@/components/ui/Container";
import { PageIntro } from "@/components/ui/PageIntro";
import { profile } from "@/data/profile";

export const metadata: Metadata = {
  title: "Hire Me Maybe",
  description: `Paste a job description and get ${profile.name}'s résumé tailored to it, built only from his real, pre-approved experience.`,
};

export default function HireMeMaybePage() {
  return (
    <Container className="flex flex-col gap-10 py-16 pb-24">
      <PageIntro eyebrow="Lab · Recruiter tool" title="Hire Me Maybe">
        Paste a job description and get my résumé tailored to it. Claude reads the posting, decides if it fits my
        field and picks the most relevant projects and bullets from a bank of pre-approved content. It never writes a
        word of the résumé itself, so everything you download is true.
      </PageIntro>
      <HireMeMaybe email={profile.email} />
      <p className="text-sm text-muted">
        Unrelated roles are declined, related-but-different roles get my standard résumé, and the job description isn&apos;t
        stored on this site.
      </p>
    </Container>
  );
}
