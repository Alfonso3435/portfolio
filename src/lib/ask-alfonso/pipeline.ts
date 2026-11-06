// The whole Ask Alfonso pipeline, in the browser — the TypeScript twin of
// ml/askalfonso/pipeline.py:
//
//   question → private-topic guard → TF-IDF retrieval (τ) → transformer reads the
//   chunks and answers → guardrails check the answer → reply (or a safe fallback)
//
// Environment-agnostic: give it the parsed JSON files and the float32 weights. The Web
// Worker (worker.ts) does that with fetch(); the tests do it with the file system.

import { Guardrails } from "./guardrails";
import { Model } from "./model";
import { Retriever, selectHits, type Hit } from "./retrieval";
import { QueryRewriter } from "./rewrite";
import { Tokenizer } from "./tokenizer";
import type { KnowledgeJson, ModelJson, Reply } from "./types";

const ABOUT_ASSISTANT =
  /\b(?:how (?:do|did|does) (?:you|it|this) (?:work|answer|know|decide)|how (?:were|was|are) (?:you|it|this) (?:built|made|trained|programmed)|who (?:made|built|created|trained) (?:you|this|it)|are you (?:an? )?(?:ai|bot|llm|gpt|chatgpt|chatbot)|what model are you)\b|^how (?:it|you) answered\??$/i;

export class AskAlfonso {
  readonly tokenizer: Tokenizer;
  readonly model: Model;
  private readonly retriever: Retriever;
  private readonly guard: Guardrails;
  private readonly k: KnowledgeJson;
  private readonly texts: Map<string, string>;
  private readonly titles: Map<string, string>;
  private readonly facts: Map<string, string>;
  private readonly prompt: ModelJson["tokenizer"]["prompt"];
  private readonly endId: number;
  private readonly rewriter: QueryRewriter;
  private readonly aboutAssistant: string;

  constructor(modelJson: ModelJson, weights: Float32Array, knowledge: KnowledgeJson) {
    this.tokenizer = new Tokenizer(modelJson.tokenizer);
    this.model = new Model(modelJson, weights);
    this.retriever = new Retriever(knowledge.retrieval);
    this.guard = new Guardrails(knowledge.guardrails);
    this.k = knowledge;
    const chunks = knowledge.retrieval.chunks;
    this.texts = new Map(chunks.map((c) => [c.id, c.text]));
    this.titles = new Map(chunks.map((c) => [c.id, c.title]));
    this.facts = new Map(chunks.map((c) => [c.id, c.facts]));
    this.prompt = modelJson.tokenizer.prompt;
    this.endId = this.tokenizer.tokenId(this.prompt.end);
    this.rewriter = new QueryRewriter(knowledge.query);
    const params = (modelJson.parameters / 1e6).toFixed(1);
    this.aboutAssistant =
      `I'm a ${params}M-parameter language model Alfonso built from scratch: tokenizer, transformer, training and ` +
      `retrieval. For each question I find the most relevant parts of his profile, read them and answer only from ` +
      `them; guardrails block anything that isn't in his data. Open "How it answered" under any reply to see those ` +
      `steps, or read the full story at ${knowledge.site}/lab.`;
  }

  /**
   * For the chat: rewrite the visitor's message into a question the model knows how to
   * read (follow-ups, other names — see rewrite.ts), then answer it. `previous` is the
   * last question that was answered, so "what about X?" can be resolved.
   */
  chat(message: string, previous?: string): Reply {
    // Questions about the assistant itself aren't in Alfonso's data, so the model would
    // (correctly) refuse them. A fixed, factual answer about how it works is more useful.
    if (ABOUT_ASSISTANT.test(message.trim())) {
      return { answer: this.aboutAssistant, status: "answered", sources: [], question: message.trim(),
        rewritten: false, debug: { reason: "about_assistant" } };
    }
    const { question, changed } = this.rewriter.rewrite(message, previous);
    return { ...this.ask(question), question, rewritten: changed };
  }

  private buildPrompt(context: string, question: string): string {
    const p = this.prompt;
    return `${p.context}${context.trim()}${p.question}${question.trim()}${p.answer}`;
  }

  private context(hits: Hit[]): string {
    return hits.map((h) => this.texts.get(h.id) ?? "").join(this.k.pipeline.context_separator);
  }

  retrieve(question: string): { hits: Hit[]; kept: Hit[] } {
    const { threshold, relative, max_chunks } = this.k.pipeline;
    const hits = this.retriever.search(question, Math.max(3, max_chunks));
    let kept = selectHits(hits, threshold, relative, max_chunks);
    if (!kept.length && this.retriever.aboutHim(question)) {
      const id = this.k.retrieval.profile_chunk;
      kept = [{ id, title: this.titles.get(id) ?? id, score: threshold }];
    }
    return { hits, kept };
  }

  /**
   * The model's text with the email it was trained on replaced by the current one
   * (see TRAINED_EMAIL in ml/askalfonso/pipeline.py): Alfonso's address changed after training.
   */
  private toVisitor(text: string): string {
    const { email, model_email } = this.k.contact;
    return model_email && model_email !== email ? text.replaceAll(model_email, email) : text;
  }

  /** Drop the weakest chunk until the prompt leaves room for the answer. */
  private fitContext(kept: Hit[], question: string): Hit[] {
    const budget = this.model.cfg.block_size - this.k.pipeline.max_new_tokens;
    let fitted = kept;
    while (fitted.length && this.tokenizer.encode(this.buildPrompt(this.context(fitted), question)).length > budget) {
      fitted = fitted.slice(0, -1);
    }
    return fitted;
  }

  private generate(context: string, question: string): { text: string; finished: boolean; promptTokens: number } {
    const maxNew = this.k.pipeline.max_new_tokens;
    let ids = this.tokenizer.encode(this.buildPrompt(context, question));
    ids = ids.slice(-(this.model.cfg.block_size - maxNew)); // leave room for the answer
    const { ids: out, finished } = this.model.generate(ids, maxNew, this.endId);
    return { text: this.tokenizer.decode(out).trim(), finished, promptTokens: ids.length };
  }

  ask(rawQuestion: string): Reply {
    const started = performance.now();
    const question = rawQuestion.trim();
    const g = this.k.guardrails;
    if (this.guard.isPrivate(question)) {
      return { answer: g.private_answer, status: "private", sources: [], debug: { reason: "private_guard" } };
    }

    const { hits, kept: retrieved } = this.retrieve(question);
    // A question that only names him is asked the way the model knows best (retrieval.ABOUT_QUESTION).
    const asked = this.retriever.aboutHim(question) ? this.k.retrieval.about_question : question;
    const kept = this.fitContext(retrieved, asked);
    const context = this.context(kept);
    const { text: raw, finished, promptTokens } = this.generate(context, asked);
    const grounding = [context, ...kept.map((h) => this.facts.get(h.id) ?? "")].join(" ");
    const check = this.guard.check(raw, finished, grounding, question);
    const debug: Reply["debug"] = {
      hits: hits.map((h) => [h.id, Math.round(h.score * 1000) / 1000]),
      contextIds: kept.map((h) => h.id),
      raw: this.toVisitor(raw),
      finished,
      reason: check.reason,
      ungrounded: check.ungrounded,
      promptTokens,
      ms: Math.round(performance.now() - started),
    };
    if (!check.ok) return { answer: g.fallback, status: "fallback", sources: [], debug };
    const answer = this.toVisitor(raw);
    if (this.guard.isRefusal(raw)) return { answer, status: "refused", sources: [], debug };
    const sources = this.guard.isGreeting(raw) ? [] : kept.map((h) => ({ id: h.id, title: h.title }));
    return { answer, status: "answered", sources, debug };
  }
}
