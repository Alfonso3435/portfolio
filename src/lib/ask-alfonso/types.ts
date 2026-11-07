// Shapes of the files written by ml/export_web.py (public/ask-alfonso/*).
// Python owns the data; TypeScript only runs it, so the two can't disagree.

export interface ModelConfig {
  vocab_size: number;
  block_size: number;
  n_layer: number;
  n_head: number;
  n_embd: number;
}

export interface TensorInfo {
  name: string;
  shape: number[];
  /** Offset in float16 elements from the start of model.bin. */
  offset: number;
}

export interface ModelJson {
  format: "ask-alfonso/fp16-v1";
  config: ModelConfig;
  layer_norm_eps: number;
  tensors: TensorInfo[];
  parameters: number;
  tokenizer: {
    pattern: string;
    merges: [number, number][];
    special_tokens: Record<string, number>;
    prompt: { context: string; question: string; answer: string; end: string };
  };
  trained: string | null;
}

export interface ChunkJson {
  id: string;
  title: string;
  text: string;
  /** Normalized TF-IDF vector: term → weight. */
  vector: Record<string, number>;
  /** Each name as the set of its words, e.g. [["identifeye"], ["vertex", "ai"]]. */
  entities: string[][];
  techs: string[][];
  tech_bonus: number;
  /** Facts the grounding check accepts for this chunk (links, awards). */
  facts: string;
}

export interface KnowledgeJson {
  retrieval: {
    stopwords: string[];
    synonyms: Record<string, string>;
    entity_bonus: number;
    idf: Record<string, number>;
    name_words: string[];
    profile_chunk: string;
    about_question: string;
    chunks: ChunkJson[];
  };
  pipeline: {
    threshold: number;
    relative: number;
    max_chunks: number;
    max_new_tokens: number;
    context_separator: string;
  };
  guardrails: {
    private_patterns: string[];
    refusal_prefixes: string[];
    greeting_prefix: string;
    common_capitalized: string[];
    generic_acronyms: string[];
    /** Phrases like "in progress" that must appear in what the model read (guardrails.py). */
    status_claims: string[];
    allowlist: string;
    known_names: string[];
    private_answer: string;
    fallback: string;
  };
  /** Names for the query rewriter (rewrite.ts). */
  query: {
    skills: { name: string; aliases: string[] }[];
    groups: { name: string; aliases: string[] }[];
    techs: string[];
    names: { project: string[]; company: string[]; event: string[] };
    events: { name: string; aliases: string[] }[];
  };
  site: string;
  /** The model writes model_email (the address it was trained with); replies show email. */
  contact: { email: string; model_email: string };
  /** [trained wording, corrected wording] pairs applied to every reply. */
  corrections?: [string, string][];
}

export type ReplyStatus = "answered" | "refused" | "private" | "fallback";

export interface Source {
  id: string;
  title: string;
}

export interface Reply {
  /** The question that was actually answered, after rewriting (rewrite.ts). */
  question?: string;
  /** True when the rewriter changed what the visitor typed. */
  rewritten?: boolean;
  answer: string;
  status: ReplyStatus;
  sources: Source[];
  /** Why the pipeline did what it did (shown in the debug view and used by tests). */
  debug: {
    hits?: [string, number][];
    contextIds?: string[];
    raw?: string;
    finished?: boolean;
    reason?: string;
    ungrounded?: string[];
    promptTokens?: number;
    ms?: number;
  };
}
