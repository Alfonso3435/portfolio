import type { Metadata } from "next";
import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { Container } from "@/components/ui/Container";
import { labSteps, labTools } from "@/data/lab";
import { profile } from "@/data/profile";
import type { LabToolStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Lab",
  description: `${profile.assistantName}, a language model built from scratch, and other interactive ML tools.`,
};

const statusLabels: Record<LabToolStatus, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  live: "Live",
};

export default function LabPage() {
  const tools = [...labTools].sort((a, b) => a.priority - b.priority);

  return (
    <Container className="flex flex-col gap-20 py-16 pb-24">
      <section aria-labelledby="lab-title" className="flex flex-wrap items-stretch gap-10">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col justify-center gap-5">
          <p className="font-mono text-[13px] uppercase tracking-[0.06em] text-accent">Lab</p>
          <h1 id="lab-title" className="font-display text-4xl leading-[1.06] font-bold tracking-tight sm:text-5xl">
            {profile.assistantName}: a language model I&apos;m building from scratch.
          </h1>
          <p className="text-lg text-muted">
            Tokenizer, transformer, training loop and retrieval, all written by me and applied end-to-end. It will
            only answer from my real profile data, and say so when it doesn&apos;t know.
          </p>
        </div>

        <div className="flex min-w-0 flex-[1_1_420px] flex-col justify-center gap-4 rounded-2xl border border-line bg-surface p-7">
          <Chip tone="accent">Status · In development</Chip>
          <p className="text-[17px]">
            The chat will live here once the model is trained and evaluated. Until then, this page documents the
            build: architecture, training curves and honest limitations will be added as each phase ships.
          </p>
          <p className="text-[15px] text-muted">
            Want to talk about it now?{" "}
            <Link href="/contact" className="text-accent hover:text-fg">
              Get in touch →
            </Link>
          </p>
        </div>
      </section>

      <section aria-labelledby="how" className="flex flex-col gap-6">
        <h2 id="how" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          How it works
        </h2>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3">
          {labSteps.map((step) => (
            <li key={step.label} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5">
              <span className="font-mono text-xs uppercase text-accent">{step.label}</span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-sm text-muted">{step.description}</p>
              {step.foundation ? (
                <p className="mt-auto pt-1 font-mono text-xs text-muted">Builds on: {step.foundation}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="tools" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h2 id="tools" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Interactive tools
          </h2>
          <p className="text-muted">Each one lets you use something I built instead of reading about it.</p>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-4">
          {tools.map((tool) => (
            <li key={tool.name} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{tool.name}</h3>
                <Chip tone={tool.status === "live" ? "accent" : "muted"}>{statusLabels[tool.status]}</Chip>
              </div>
              <p className="text-[15px] text-muted">{tool.description}</p>
              <p className="mt-auto font-mono text-xs text-muted">Built on: {tool.builtOn}</p>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
