// Guardrails — the TypeScript twin of ml/askalfonso/guardrails.py. The word lists and
// patterns come from knowledge.json (exported from Python); the logic is ported 1:1.

import type { KnowledgeJson } from "./types";

export interface Check {
  ok: boolean;
  reason: string;
  ungrounded: string[];
}

// Tokens with the symbols names use: Next.js, C++, C#, ESP32, alfonsovegasol.com/projects.
const TOKEN_RE = /[A-Za-z0-9][A-Za-z0-9_+#./@'’-]*/g;
const SKILL_CLAIM_RE = /^Yes\. (?:Alfonso has used (.+?) in |(.+?) comes from his coursework)/;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
  "november", "december"];
const MONTH_ABBR = new Map(MONTHS.map((m) => [m, m.slice(0, 3)]));

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Python's str.rstrip(chars) / lstrip(chars). */
function rstripChars(s: string, chars: string): string {
  let end = s.length;
  while (end > 0 && chars.includes(s[end - 1])) end--;
  return s.slice(0, end);
}
function lstripChars(s: string, chars: string): string {
  let start = 0;
  while (start < s.length && chars.includes(s[start])) start++;
  return s.slice(start);
}

function strip(token: string): string {
  const t = lstripChars(rstripChars(token, ".,;:!?'’-"), "'’");
  return t.replace(/['’]s$/, ""); // Alfonso's → Alfonso
}

/** Comparison form: lowercase, months abbreviated ("June" == "Jun"). */
function canon(token: string): string {
  const low = token.toLowerCase();
  return MONTH_ABBR.get(low) ?? low;
}

const isUpper = (ch: string) => ch >= "A" && ch <= "Z";
const isDigit = (ch: string) => ch >= "0" && ch <= "9";

export class Guardrails {
  private readonly privateRe: RegExp;
  private readonly cfg: KnowledgeJson["guardrails"];
  private readonly common: Set<string>;
  private readonly acronyms: Set<string>;
  private readonly namePatterns: [string, RegExp][];

  constructor(cfg: KnowledgeJson["guardrails"]) {
    this.cfg = cfg;
    this.privateRe = new RegExp(cfg.private_patterns.join("|"), "i");
    this.common = new Set(cfg.common_capitalized);
    this.acronyms = new Set(cfg.generic_acronyms);
    // Whole phrases: not preceded or followed by a letter, digit or "_" (Python's \w).
    this.namePatterns = cfg.known_names.map((name) => [
      name,
      new RegExp("(?<![\\p{L}\\p{N}_])" + escapeRegex(name.toLowerCase()) + "(?![\\p{L}\\p{N}_])", "u"),
    ]);
  }

  isPrivate(question: string): boolean {
    return this.privateRe.test(question);
  }

  isRefusal(answer: string): boolean {
    return this.cfg.refusal_prefixes.some((p) => answer.startsWith(p));
  }

  isGreeting(answer: string): boolean {
    return answer.startsWith(this.cfg.greeting_prefix);
  }

  private tokenSet(text: string): Set<string> {
    const set = new Set(this.acronyms);
    for (const m of text.matchAll(TOKEN_RE)) set.add(canon(strip(m[0])));
    return set;
  }

  /** Names and facts: digits, symbols, inner capitals, or a capital not starting a sentence. */
  nameLikeTokens(answer: string): string[] {
    const out: string[] = [];
    let sentenceStart = true;
    for (const m of answer.matchAll(TOKEN_RE)) {
      const raw = m[0];
      const token = strip(raw);
      if (!token) continue; // (Python's `continue` also skips the sentence-start update)
      const hasDigit = [...token].some(isDigit);
      const hasSymbol = [...token].some((ch) => "+#@/".includes(ch)) || (token.includes(".") && !token.endsWith("."));
      const innerCaps = [...token.slice(1)].some(isUpper);
      const capitalized = isUpper(token[0]) && !this.common.has(token.toLowerCase());
      if (hasDigit || hasSymbol || innerCaps || (capitalized && !sentenceStart)) out.push(token);
      const end = (m.index ?? 0) + raw.length;
      sentenceStart = /[.!?:]$/.test(raw) || ".!?:".includes(answer.slice(end, end + 1));
    }
    return out;
  }

  ungroundedTokens(answer: string, sources: string): string[] {
    const known = this.tokenSet(sources);
    return this.nameLikeTokens(answer).filter((t) => !known.has(canon(t)));
  }

  isRepetitive(answer: string, n = 4, maxRepeats = 2): boolean {
    const ws = answer.toLowerCase().split(/\s+/).filter(Boolean);
    const counts = new Map<string, number>();
    for (let i = 0; i + n <= ws.length; i++) {
      const gram = ws.slice(i, i + n).join(" ");
      const c = (counts.get(gram) ?? 0) + 1;
      counts.set(gram, c);
      if (c > maxRepeats) return true;
    }
    return false;
  }

  unsupportedNames(answer: string, sources: string): string[] {
    const a = answer.toLowerCase();
    const s = sources.toLowerCase();
    return this.namePatterns.filter(([, re]) => re.test(a) && !re.test(s)).map(([name]) => name);
  }

  check(answer: string, finished: boolean, context: string, question: string): Check {
    const fail = (reason: string, ungrounded: string[] = []): Check => ({ ok: false, reason, ungrounded });
    const pass: Check = { ok: true, reason: "", ungrounded: [] };
    if (!answer) return fail("empty");
    if (!finished) return fail("no_end");
    if (this.isRepetitive(answer)) return fail("repetitive");
    if (this.isRefusal(answer) || this.isGreeting(answer)) {
      // A refusal may name the thing it can't find ("…about Ruby…"): it must come from the question.
      const missing = this.ungroundedTokens(answer, [question, this.cfg.allowlist].join(" "));
      return missing.length ? fail("ungrounded_refusal", missing) : pass;
    }
    if (!context) return fail("fact_without_context");
    const claim = SKILL_CLAIM_RE.exec(answer);
    if (claim) {
      const skill = claim[1] ?? claim[2];
      const asked = this.tokenSet(question);
      const matches = [...skill.matchAll(TOKEN_RE)].some((m) => asked.has(canon(strip(m[0]))));
      if (!matches) return fail("off_question", [skill]);
    }
    const missing = this.ungroundedTokens(answer, [context, this.cfg.allowlist].join(" "));
    if (missing.length) return fail("ungrounded", missing);
    // A memorized "still in progress" about a project that has since shipped (guardrails.py: STATUS_CLAIMS).
    const lower = context.toLowerCase();
    const stale = this.cfg.status_claims.filter((c) => answer.toLowerCase().includes(c) && !lower.includes(c));
    if (stale.length) return fail("ungrounded", stale);
    const names = this.unsupportedNames(answer, context);
    return names.length ? fail("unsupported_name", names) : pass;
  }
}
