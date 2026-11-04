import type { Metadata } from "next";
import Link from "next/link";
import { AskChat } from "@/components/ask/AskChat";
import { Container } from "@/components/ui/Container";
import { PageIntro } from "@/components/ui/PageIntro";
import { profile } from "@/data/profile";

export const metadata: Metadata = {
  title: profile.assistantName,
  description: `Ask questions about ${profile.name}'s projects, skills and experience. ${profile.assistantName} is a small language model he built from scratch; it runs entirely in your browser.`,
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
  return (
    <Container className="flex flex-col gap-10 py-16 pb-24">
      <PageIntro eyebrow="Ask" title={`${profile.assistantName}`}>
        A 3.9M-parameter language model I built from scratch (tokenizer, transformer, training and retrieval)
        that answers only from my real profile data. It runs entirely in your browser: nothing you type leaves your
        device.{" "}
        <Link href="/lab" className="text-accent hover:text-fg">
          How it works →
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
    </Container>
  );
}
