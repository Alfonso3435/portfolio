import type { Metadata } from "next";
import { HireMeMaybe } from "@/components/hire/HireMeMaybe";
import { Container } from "@/components/ui/Container";
import { profile } from "@/data/profile";

export const metadata: Metadata = {
  title: "Hire Me Maybe",
  description: `Paste a job description and get ${profile.name}'s résumé tailored to it, built only from his real, pre-approved experience.`,
};

const cases = [
  {
    label: "It's a match",
    title: "Software engineering and AI/ML roles",
    body: "You get a one-page résumé tailored to the role, with the projects and experience that matter most for it.",
  },
  {
    label: "Partial match",
    title: "Other computing roles",
    body: "For roles like cybersecurity or data analysis, you get my standard résumé.",
  },
  {
    label: "Not a fit",
    title: "Roles outside computing",
    body: "Postings from unrelated fields, like design or law, are declined.",
  },
];

export default function HireMeMaybePage() {
  return (
    <Container className="flex flex-col gap-8 py-16 pb-24">
      <div className="flex max-w-3xl flex-col gap-3">
        <p className="font-mono text-[13px] uppercase tracking-[0.06em] text-accent">Recruiter tool</p>
        <h1 className="font-display text-4xl leading-[1.06] font-bold tracking-tight sm:text-5xl">Hire Me Maybe</h1>
        <p className="text-lg text-muted">Paste a job description and get my résumé tailored to it.</p>
      </div>

      <HireMeMaybe email={profile.email} />

      <section aria-labelledby="hmm-how" className="mt-10 flex flex-col gap-6 border-t border-line pt-12">
        <div className="flex max-w-3xl flex-col gap-2">
          <p className="font-mono text-[13px] uppercase tracking-[0.06em] text-accent">About the tool</p>
          <h2 id="hmm-how" className="font-display text-3xl font-bold tracking-tight">
            A résumé for the role you&apos;re hiring for
          </h2>
          <p className="text-muted">
            Hire Me Maybe compares a job description with my experience and gives you the version of my résumé that
            fits it best. Everything on it comes from my real, pre-approved résumé content. Built with Next.js and the
            Claude API; the job description isn&apos;t stored on this site.
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-3">
          {cases.map((c) => (
            <li key={c.label} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
              <span className="font-mono text-xs uppercase text-accent">{c.label}</span>
              <h3 className="font-semibold">{c.title}</h3>
              <p className="text-sm text-muted">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
