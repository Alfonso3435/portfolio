import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { profile } from "@/data/profile";

export function ContactCta() {
  return (
    <section aria-labelledby="cta-title" className="border-t border-line bg-surface">
      <Container className="flex flex-wrap items-center justify-between gap-6 py-16">
        <div className="min-w-0 flex-[1_1_420px]">
          <h2 id="cta-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Let&apos;s talk.
          </h2>
          <p className="mt-2 text-[17px] text-muted">{profile.lookingFor.long}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <ButtonLink href={`mailto:${profile.email}`}>{profile.email}</ButtonLink>
          <ButtonLink href={profile.links.linkedin} variant="secondary">
            LinkedIn
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
