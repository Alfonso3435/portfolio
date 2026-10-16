import Link from "next/link";
import { profile } from "@/data/profile";

// Questions the finished assistant will answer. Each one is answerable from src/data.
const sampleQuestions = [
  "What did he build at HackMX?",
  "Does he know TensorFlow?",
  "What is Answr?",
];

/**
 * Preview of the chatbot in the hero. No fake input box: until the model
 * ships, this card is honest about its status and links to the Lab.
 */
export function AskTeaser() {
  return (
    <aside
      aria-labelledby="ask-teaser-title"
      className="flex min-w-0 flex-[1_1_380px] flex-col gap-4 rounded-2xl border border-line bg-surface p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ask-teaser-title" className="font-display text-lg font-semibold">
          {profile.assistantName}
        </h2>
        <span className="rounded-full border border-line px-2.5 py-1 font-mono text-xs text-muted">
          LLM built from scratch · in development
        </span>
      </div>
      <p className="rounded-xl bg-surface-2 px-4 py-3.5 text-[15px] leading-relaxed">
        Hi! I&apos;m a small language model {profile.shortName} is building from scratch. Soon you&apos;ll be able
        to ask me about his projects, skills and experience, like:
      </p>
      <ul className="flex flex-col gap-2">
        {sampleQuestions.map((q) => (
          <li key={q} className="rounded-lg border border-line px-3.5 py-2.5 text-sm text-muted">
            “{q}”
          </li>
        ))}
      </ul>
      <Link href="/lab" className="text-[15px] font-semibold text-accent hover:text-fg">
        See how it&apos;s being built →
      </Link>
    </aside>
  );
}
