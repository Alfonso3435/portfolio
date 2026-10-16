import Image from "next/image";
import { profile } from "@/data/profile";

export function AboutIntro() {
  const facts = [
    { label: "Based in", value: profile.location },
    { label: "Languages", value: profile.spokenLanguages.map((l) => `${l.language} (${l.level.toLowerCase()})`).join(" · ") },
    { label: "Focus", value: profile.focusAreas.slice(0, 3).join(" · ") },
  ];

  return (
    <section aria-labelledby="about-title" className="flex flex-wrap items-start gap-10">
      {profile.headshot ? (
        <div className="relative aspect-[4/5] w-full max-w-[280px] overflow-hidden rounded-2xl border border-line">
          <Image src={profile.headshot} alt={profile.name} fill sizes="280px" priority className="object-cover" />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5">
        <p className="font-mono text-[13px] uppercase tracking-[0.06em] text-accent">About</p>
        <h1 id="about-title" className="font-display text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl">
          I like building intelligent systems that people actually use.
        </h1>
        <p className="text-lg text-muted">{profile.summary}</p>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="font-mono text-xs uppercase text-muted">{f.label}</dt>
              <dd className="mt-0.5 font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
