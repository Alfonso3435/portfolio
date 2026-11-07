import Link from "next/link";
import { profile } from "@/data/profile";

// Each one is answerable from src/data; clicking one opens the chat and asks it.
const sampleQuestions = [
  "What did he build at HackMX?",
  "Does he know TensorFlow?",
  "What is Answr?",
];

/**
 * Entry point to the chatbot from the hero. The model itself (7.7 MB) only downloads
 * on /ask, so the home page stays light.
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
          LLM built from scratch · live
        </span>
      </div>
      <p className="rounded-xl bg-surface-2 px-4 py-3.5 text-[15px] leading-relaxed">
        Hi! I&apos;m a small language model {profile.shortName} built from scratch, and I run right in your browser.
        Ask me about his projects, skills and experience, like:
      </p>
      <ul className="flex flex-col gap-2">
        {sampleQuestions.map((q) => (
          <li key={q}>
            <Link
              href={`/ask?q=${encodeURIComponent(q)}`}
              className="block rounded-lg border border-line px-3.5 py-2.5 text-sm text-muted hover:border-muted hover:text-fg"
            >
              “{q}”
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/ask" className="text-[15px] font-semibold text-accent hover:text-fg">
          Open the chat →
        </Link>
        <Link href="/ask#how-it-works" className="text-[15px] text-muted hover:text-fg">
          How it&apos;s built
        </Link>
      </div>
    </aside>
  );
}
