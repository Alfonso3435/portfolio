import type { Metadata } from "next";
import { CopyEmailButton } from "@/components/contact/CopyEmailButton";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PageIntro } from "@/components/ui/PageIntro";
import { profile } from "@/data/profile";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with ${profile.name}. ${profile.lookingFor.long}`,
};

export default function ContactPage() {
  const channels = [
    { label: "LinkedIn", detail: "juan-alfonso-vega-sol", href: profile.links.linkedin },
    { label: "GitHub", detail: "Alfonso3435", href: profile.links.github },
    { label: "Résumé", detail: "PDF download", href: profile.resumeUrl },
  ];

  return (
    <Container className="flex flex-wrap gap-14 py-16 pb-24">
      <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-6">
        <PageIntro eyebrow="Contact" title="Let's build something.">
          {profile.lookingFor.long} The fastest way to reach me is email.
        </PageIntro>
        <div className="flex flex-wrap gap-2.5">
          <ButtonLink href={`mailto:${profile.email}`}>{profile.email}</ButtonLink>
          <CopyEmailButton email={profile.email} />
        </div>
      </div>

      <ul className="flex min-w-0 flex-[1_1_360px] flex-col self-start border-t border-line">
        {channels.map((c) => (
          <li key={c.label} className="border-b border-line">
            <a
              href={c.href}
              target={c.href.startsWith("http") ? "_blank" : undefined}
              rel={c.href.startsWith("http") ? "noreferrer" : undefined}
              className="flex min-h-14 items-center justify-between gap-4 text-fg hover:text-accent"
            >
              <span className="text-lg font-medium">{c.label}</span>
              <span className="text-sm text-muted">{c.detail} →</span>
            </a>
          </li>
        ))}
        <li className="pt-4 text-sm text-muted">Based in the {profile.location}.</li>
      </ul>
    </Container>
  );
}
