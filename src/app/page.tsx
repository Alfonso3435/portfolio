import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { profile } from "@/data/profile";

// Temporary Home: proves the design tokens and the data layer work together.
// It gets replaced section by section (Hero, Highlights, Featured…) next milestone.
export default function HomePage() {
  return (
    <Container className="flex flex-col gap-6 py-20">
      <p className="font-mono text-[13px] uppercase tracking-[0.06em] text-accent">
        CS @ UW Paul G. Allen School · AI / ML
      </p>
      <h1 className="font-display text-5xl leading-[1.04] font-bold tracking-tight sm:text-6xl">
        {profile.name}
      </h1>
      <p className="max-w-2xl text-xl text-muted">{profile.tagline}</p>
      <p className="flex items-center gap-2.5 text-[15px] text-muted">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
        {profile.lookingFor.short}
      </p>
      <div className="flex flex-wrap gap-2.5 pt-2">
        <Link
          href="/projects"
          className="inline-flex min-h-11 items-center rounded-[10px] bg-accent px-5 text-[15px] font-semibold text-on-accent hover:opacity-90"
        >
          See my projects
        </Link>
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center rounded-[10px] border border-line px-[18px] text-[15px] hover:border-muted"
        >
          Contact
        </Link>
      </div>
    </Container>
  );
}
