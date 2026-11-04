// Query rewriting: turn what a visitor typed into a question the model was trained to read.
//
// The model learned from standalone questions with the official names in Alfonso's data.
// Real visitors chat: "what about Net Core?", "and machine learning?", "tell me about
// hackmx". Search engines and assistants handle this *before* the model with a rewriting
// step, and so does Ask Alfonso. It never adds facts — it only rephrases the question;
// the answer still comes from the model reading the retrieved chunks, through the guardrails.
//
//   1. Follow-ups      "what about X?" after "Does he have experience with React?"
//                      → "Does he have experience with X?"
//   2. Other names     ".NET Core" → "ASP.NET Core MVC", "AI" → the ML skill group
//   3. Bare names      "tell me about hackmx" → "What did he win at HackMX?"
//   4. Skill groups    "What are his AI skills?" → "What are his machine learning & deep learning skills?"

import type { KnowledgeJson } from "./types";

type Kind = "tech" | "alias" | "group" | "project" | "company" | "event";

interface Entry {
  text: string; // as written in the data
  kind: Kind;
  canonical: string; // what to say instead (aliases → skill name, group aliases → group name)
  re: RegExp;
}

interface Match {
  entry: Entry;
  start: number;
  end: number;
}

/** Kinds that can stand in for each other in a follow-up. */
function family(kind: Kind): string {
  if (kind === "tech" || kind === "alias") return "tech";
  if (kind === "project" || kind === "company") return "thing";
  return kind;
}

export interface Rewrite {
  question: string;
  changed: boolean;
}

/** "ASP.NET Core" also matches "Asp. Net Core", "asp net core" and "aspnet core"; "C#" is matched literally. */
function phraseRegex(name: string): RegExp {
  const words = name.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const body = /[+#]/.test(name) || !words.length
    ? name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    : words.join("[^a-z0-9]*");
  const dot = name.startsWith(".") ? "\\.?" : ""; // ".NET" should replace the dot too
  return new RegExp(`(?<![a-z0-9])${dot}${body}(?![a-z0-9+#])`, "gi");
}

const FOLLOW_UP =
  /^(?:(?:and|also|ok(?:ay)?|so)[\s,]+)?(?:what about|how about|what of|i mean|i meant|i'?m referring to|i am referring to|i refer to|referring to|same (?:for|with))\s+(.+?)[\s?.!]*$/i;
const AND_X = /^(?:and|also|plus)\s+(.+?)[\s?.!]*$/i;
const ABOUT_X =
  /^(?:tell me (?:more )?about|what is|what's|whats|what are|who is|explain|describe|info on|information (?:on|about)|more about)\s+(.+?)[\s?.!]*$/i;
const SKILL_WORDS =
  /\b(skills?|experience[ds]?|know|knows|familiar|background|good at|expertise|strong|proficient|work(?:ed)? with|used?|capable)\b/i;
const LEADING = /^(?:the|his|a|an)\s+/i;
// "and what did he build at HackMX?" is a new question, not a follow-up subject.
const QUESTION_START = /^(?:what|which|who|where|when|why|how|does|did|do|is|was|are|can|could|has|have|tell|list|show|give)\b/i;

export class QueryRewriter {
  private readonly entries: Entry[] = [];

  constructor(query: KnowledgeJson["query"]) {
    const add = (text: string, kind: Kind, canonical = text) => {
      if (text.length < 2) return; // "C" (from "C / C++") would match any stray letter
      this.entries.push({ text, kind, canonical, re: phraseRegex(text) });
    };
    query.techs.forEach((t) => add(t, "tech"));
    query.skills.forEach((s) => s.aliases.forEach((a) => add(a, "alias", s.name)));
    query.groups.forEach((g) => [g.name, ...g.aliases].forEach((a) => add(a, "group", g.name)));
    query.names.project.forEach((n) => add(n, "project"));
    query.names.company.forEach((n) => add(n, "company"));
    query.names.event.forEach((n) => add(n, "event"));
    // Longest first: "ASP.NET Core MVC" wins over its alias "ASP.NET", "Node.js" over "Node".
    this.entries.sort((a, b) => b.text.length - a.text.length);
  }

  /** Non-overlapping name matches, longest names first. */
  private matches(text: string): Match[] {
    const taken: Match[] = [];
    for (const entry of this.entries) {
      for (const m of text.matchAll(entry.re)) {
        const start = m.index ?? 0;
        const end = start + m[0].length;
        if (taken.every((t) => end <= t.start || start >= t.end)) taken.push({ entry, start, end });
      }
    }
    return taken.sort((a, b) => a.start - b.start);
  }

  /** The single name `text` consists of, if any ("hackmx" → HackMX). */
  private whole(text: string): Match | undefined {
    const t = text.trim().replace(LEADING, "");
    const ms = this.matches(t);
    return ms.length === 1 && ms[0].start === 0 && ms[0].end === t.length ? ms[0] : undefined;
  }

  /** Replace other names with the names the model knows (".NET Core" → "ASP.NET Core MVC"). */
  private canonicalize(text: string): string {
    let out = "";
    let last = 0;
    for (const m of this.matches(text)) {
      if (m.entry.kind !== "alias") continue;
      out += text.slice(last, m.start) + m.entry.canonical;
      last = m.end;
    }
    return out + text.slice(last);
  }

  /** A question about one name, in a phrasing the model was trained on. */
  private questionFor(m: Match, fallback: string): string {
    const name = m.entry.kind === "alias" ? m.entry.canonical : m.entry.text;
    switch (m.entry.kind) {
      case "tech":
      case "alias":
        return `Does he know ${name}?`;
      case "group":
        return `What are his ${m.entry.canonical.toLowerCase()} skills?`;
      case "project":
      case "company":
        return `What is ${name}?`;
      case "event":
        return `What did he win at ${name}?`;
      default:
        return fallback;
    }
  }

  rewrite(question: string, previous?: string): Rewrite {
    const original = question.trim();
    let q = original;

    // 1. Follow-up: put the new subject into the previous question.
    const follow = FOLLOW_UP.exec(q);
    const andX = AND_X.exec(q);
    const subjectText = (follow ?? andX)?.[1].trim();
    if (subjectText && QUESTION_START.test(subjectText)) {
      // "and what did he build at HackMX?" → just the question
      const rest = q.replace(/^(?:(?:and|also|plus|ok(?:ay)?|so)[\s,]+)+/i, "");
      q = rest.charAt(0).toUpperCase() + rest.slice(1);
    } else if (subjectText && (follow || q.split(/\s+/).length <= 6)) {
      const subject = subjectText.replace(LEADING, "");
      const named = this.whole(subject);
      const prevName = previous ? this.matches(previous)[0] : undefined;
      const sameFamily = (a: Kind, b: Kind) => family(a) === family(b);
      if (previous && prevName && (!named || sameFamily(named.entry.kind, prevName.entry.kind))) {
        // Same kind of thing (a technology for a technology…): reuse the previous question.
        const name = named ? named.entry.canonical : subject;
        q = previous.slice(0, prevName.start) + name + previous.slice(prevName.end);
      } else {
        // A different kind ("what about SkySAR?" after a hackathon question): ask about it directly.
        q = named ? this.questionFor(named, `${subject}?`) : `${subject}?`;
      }
    }

    // 2. Other names → the names in the data.
    q = this.canonicalize(q);

    // 3. "tell me about hackmx", "SkySAR?" → the trained phrasing for that kind of name.
    const about = ABOUT_X.exec(q);
    const bare = this.whole(q.replace(/[\s?.!]+$/, ""));
    const named = about ? this.whole(about[1]) : bare;
    if (named && named.entry.kind !== "group") {
      if (named.entry.kind !== "tech" || !about || bare) q = this.questionFor(named, q);
    }

    // 4. A skills question about a whole area ("AI", "web development") and nothing more specific.
    const found = this.matches(q);
    const specific = found.some((m) => m.entry.kind !== "group");
    const group = found.find((m) => m.entry.kind === "group");
    if (group && !specific && (SKILL_WORDS.test(q) || this.whole(q.replace(/[\s?.!]+$/, "")))) {
      q = this.questionFor(group, q);
    }

    return { question: q, changed: q !== original };
  }
}
