import { AskTeaser } from "@/components/sections/home/AskTeaser";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { profile } from "@/data/profile";

export function Hero() {
  return (
    <section aria-labelledby="hero-title">
      <Container className="flex flex-wrap items-center gap-12 py-16 sm:py-20">
        <div className="flex min-w-0 flex-[1_1_540px] flex-col gap-6">
          <p className="font-mono text-[13px] uppercase tracking-[0.06em] text-accent">
            CS @ UW Paul G. Allen School · AI / ML
          </p>
          <h1
            id="hero-title"
            className="font-display text-5xl leading-[1.04] font-bold tracking-tight sm:text-6xl"
          >
            {profile.name}
          </h1>
          <p className="max-w-2xl text-xl leading-relaxed text-muted">{profile.tagline}</p>
          <p className="flex items-center gap-2.5 text-[15px] text-muted">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
            {profile.lookingFor.short}
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <ButtonLink href={profile.resumeUrl}>Download résumé</ButtonLink>
            <ButtonLink href={profile.links.github} variant="secondary">
              GitHub
            </ButtonLink>
            <ButtonLink href={profile.links.linkedin} variant="secondary">
              LinkedIn
            </ButtonLink>
            <ButtonLink href={`mailto:${profile.email}`} variant="secondary">
              Email
            </ButtonLink>
          </div>
        </div>
        <AskTeaser />
      </Container>
    </section>
  );
}
