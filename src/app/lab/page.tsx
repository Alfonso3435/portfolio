import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LossChart } from "@/components/lab/LossChart";
import { ModelDiagram } from "@/components/lab/ModelDiagram";
import { VersionBars } from "@/components/lab/VersionBars";
import { Chip } from "@/components/ui/Chip";
import { Container } from "@/components/ui/Container";
import {
  labHeadline,
  labLessons,
  labLimits,
  labPipeline,
  labShipping,
  labTechniques,
  labTools,
  labVersions,
} from "@/data/lab";
import { labMetrics as m } from "@/data/lab-metrics";
import { profile } from "@/data/profile";
import { features } from "@/lib/features";

const REPO_ML = "https://github.com/Alfonso3435/portfolio/tree/main/ml";

export const metadata: Metadata = {
  // Hidden until launch (src/lib/features.ts): keep it out of search results too.
  ...(features.lab ? {} : { robots: { index: false, follow: false } }),
  title: "Lab",
  description: `${profile.assistantName}: a ${(m.model.parameters / 1e6).toFixed(1)}M-parameter language model built from scratch. ${(m.test.exactMatch * 100).toFixed(0)}% exact answers on unseen questions, 0 invented facts, $0 to serve.`,
};

function SectionTitle({ id, eyebrow, title, intro }: { id: string; eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[13px] uppercase tracking-[0.06em] text-accent">{eyebrow}</p>
      <h2 id={id} className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {intro ? <p className="max-w-2xl text-muted">{intro}</p> : null}
    </div>
  );
}

function StatGrid({ stats }: { stats: readonly { value: string; label: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-surface p-5 sm:p-6">
          <dd className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{s.value}</dd>
          <dt className="text-sm text-muted">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}

export default function LabPage() {
  if (!features.lab) notFound();
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  return (
    <Container className="flex flex-col gap-24 py-16 pb-24">
      {/* 1 · The claim, and the four numbers behind it */}
      <section aria-labelledby="lab-title" className="flex flex-col gap-10">
        <div className="flex max-w-3xl flex-col gap-5">
          <p className="font-mono text-[13px] uppercase tracking-[0.06em] text-accent">Lab</p>
          <h1 id="lab-title" className="font-display text-4xl leading-[1.06] font-bold tracking-tight sm:text-5xl">
            {profile.assistantName}: a language model I built from scratch.
          </h1>
          <p className="text-lg text-muted">
            Tokenizer, transformer, training, retrieval and guardrails, all written by me. It answers questions about
            my work using only my real data, and it runs entirely in your browser.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/ask"
              className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-on-accent transition-opacity hover:opacity-90"
            >
              Try {profile.assistantName}
            </Link>
            <a
              href={REPO_ML}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-full border border-line px-5 font-semibold hover:border-muted"
            >
              Read the code
            </a>
          </div>
        </div>
        <StatGrid stats={labHeadline} />
      </section>

      {/* 2 · One question, end to end */}
      <section aria-labelledby="pipeline" className="flex flex-col gap-8">
        <SectionTitle
          id="pipeline"
          eyebrow="How it answers"
          title="Four steps, each one measured"
          intro={`A tiny model will make things up if you let it, so it never answers alone. Numbers are from the ${m.test.questions}-question test set.`}
        />
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {labPipeline.map((s, i) => (
            <li key={s.step} className="relative flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
              <span className="font-mono text-xs uppercase text-accent">
                {String(i + 1).padStart(2, "0")} · {s.step}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted">{s.description}</p>
              </div>
              <p className="mt-auto flex items-baseline gap-2 border-t border-line pt-3">
                <span className="font-display text-2xl font-bold">{s.stat}</span>
                <span className="text-xs text-muted">{s.statLabel}</span>
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* 3 · Architecture */}
      <section aria-labelledby="model" className="flex flex-col gap-8">
        <SectionTitle
          id="model"
          eyebrow="Inside the model"
          title={`A ${(m.model.parameters / 1e6).toFixed(1)}M-parameter transformer`}
          intro="The same decoder-only design as GPT, scaled down about 32× from GPT-2 so it trains on one GPU and runs in a browser tab."
        />
        <ModelDiagram />
      </section>

      {/* 4 · Training */}
      <section aria-labelledby="training" className="flex flex-col gap-8">
        <SectionTitle
          id="training"
          eyebrow="Training"
          title="Six versions to get here"
          intro={`First ${m.training.pretrainSteps.toLocaleString("en-US")} steps of general English (WikiText-2, loss ${m.training.pretrainLoss[0]} → ${m.training.pretrainLoss[1]}), then ${m.training.epochs} epochs on ${m.data.train.toLocaleString("en-US")} questions about my work, with new phrasings and made-up projects every epoch so it learns to read, not memorize.`}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h3 className="mb-4 font-semibold">Final run: loss per epoch</h3>
            <LossChart curve={m.training.curve} />
          </div>
          <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h3 className="font-semibold">What changed between runs</h3>
            <VersionBars versions={labVersions} />
          </div>
        </div>
        <ul className="grid gap-3 md:grid-cols-3">
          {labLessons.map((l) => (
            <li key={l.title} className="flex flex-col gap-1.5 rounded-2xl border border-line p-5">
              <h3 className="font-semibold">{l.title}</h3>
              <p className="text-sm text-muted">{l.body}</p>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-2" aria-label="Training techniques">
          {labTechniques.map((t) => (
            <li key={t}>
              <Chip>{t}</Chip>
            </li>
          ))}
        </ul>
      </section>

      {/* 5 · Results and shipping */}
      <section aria-labelledby="results" className="flex flex-col gap-8">
        <SectionTitle
          id="results"
          eyebrow="Results"
          title={`Tested once, on ${m.test.questions} questions it never saw`}
          intro="The test set was locked away until the final model was chosen, so these numbers weren't tuned to look good."
        />
        <StatGrid
          stats={[
            { value: pct(m.test.keyFacts), label: "of answers contain every key fact" },
            { value: pct(m.test.tokenF1), label: "word overlap (F1) with the reference answer" },
            { value: pct(m.test.recallAt1), label: "of questions find the right chunk first" },
            { value: pct(m.test.declined), label: "said “I'm not sure” instead of guessing" },
          ]}
        />
        <div className="flex flex-col gap-4">
          <h3 className="font-semibold">Shipped for $0</h3>
          <StatGrid stats={labShipping} />
          <p className="text-sm text-muted">
            The weights, tokenizer and retrieval run in a Web Worker in your browser. A test suite checks that the
            TypeScript version produces the same tokens, retrieval and answers as PyTorch on 86 reference questions.
          </p>
        </div>
      </section>

      {/* 6 · Honesty, and what's next */}
      <section aria-labelledby="limits" className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
          <h2 id="limits" className="font-display text-2xl font-bold tracking-tight">
            Honest limitations
          </h2>
          <ul className="flex list-disc flex-col gap-2.5 pl-5 text-[15px] text-muted marker:text-line">
            {labLimits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-line p-6">
          <p className="font-mono text-[13px] uppercase tracking-[0.06em] text-accent">Also in the Lab</p>
          {labTools.map((t) => (
            <div key={t.name} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{t.name}</h3>
                <Chip>{t.status === "live" ? "Live" : t.status === "in-progress" ? "In progress" : "Coming soon"}</Chip>
              </div>
              <p className="text-[15px] text-muted">{t.description}</p>
              <p className="font-mono text-xs text-muted">Built on: {t.builtOn}</p>
              {t.href && t.status === "live" ? (
                <Link
                  href={t.href}
                  className="mt-1 inline-flex min-h-11 items-center self-start rounded-full bg-accent px-5 font-semibold text-on-accent hover:opacity-90"
                >
                  Try {t.name}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </Container>
  );
}
