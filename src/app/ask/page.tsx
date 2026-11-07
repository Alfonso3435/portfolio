import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AskChat } from "@/components/ask/AskChat";
import { AskStory } from "@/components/ask/AskStory";
import { Container } from "@/components/ui/Container";
import { PageIntro } from "@/components/ui/PageIntro";
import { profile } from "@/data/profile";
import { features } from "@/lib/features";

export const metadata: Metadata = {
  // Hidden until launch (src/lib/features.ts): keep it out of search results too.
  ...(features.lab ? {} : { robots: { index: false, follow: false } }),
  title: profile.assistantName,
  description: `Chat with ${profile.assistantName}, a 3.9M-parameter language model ${profile.name} built from scratch, and see how it works: architecture, training and test results.`,
};

// Every one of these is answered from src/data (the same data that builds the site).
const suggestions = [
  "What did he build at HackMX?",
  "Does he know PyTorch?",
  "What is Answr?",
  "Did SkySAR win anything?",
  "Is he looking for an internship?",
];

export default function AskPage() {
  if (!features.lab) notFound();
  return (
    <Container className="flex flex-col gap-10 py-16 pb-24">
      <PageIntro eyebrow="Language model" title={`${profile.assistantName}`}>
        Ask about my projects, skills or experience. It&apos;s a 3.9M-parameter language model I built from scratch,
        it answers only from my real data, and it runs entirely in your browser.{" "}
        <Link href="#how-it-works" className="text-accent hover:text-fg">
          How it works ↓
        </Link>
      </PageIntro>

      <div className="mx-auto w-full max-w-3xl">
        <AskChat
          assistantName={profile.assistantName}
          shortName={profile.shortName}
          email={profile.email}
          suggestions={suggestions}
        />
        <p className="mt-3 text-sm text-muted">
          Small models make mistakes. On questions it had never seen, it answered 78% exactly right and never invented a
          fact; when unsure, it says so. For anything important, email{" "}
          <a href={`mailto:${profile.email}`} className="text-accent hover:text-fg">
            {profile.email}
          </a>
          .
        </p>
      </div>

      <div className="mt-14 border-t border-line pt-16">
        <AskStory />
      </div>
    </Container>
  );
}
