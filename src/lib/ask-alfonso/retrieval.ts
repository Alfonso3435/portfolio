// TF-IDF retrieval — the TypeScript twin of ml/askalfonso/retrieval.py. The index itself
// (idf, chunk vectors, entities) is computed in Python and shipped in knowledge.json;
// this file only turns a question into a vector and scores it against the chunks.

import type { ChunkJson, KnowledgeJson } from "./types";

export interface Hit {
  id: string;
  title: string;
  score: number;
}

const TOKEN_RE = /[a-z0-9]+(?:[+#]+|(?:\.[a-z0-9]+)+)?/g;

/** Lowercase and strip accents: "Tecnológico" → "tecnologico" (non-ASCII is dropped, like Python). */
export function fold(text: string): string {
  return text.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase();
}

export class Retriever {
  private readonly stop: Set<string>;
  // Maps, not plain objects: a word like "constructor" must not hit Object.prototype.
  private readonly synonyms: Map<string, string>;
  private readonly vectors: Map<string, number>[];
  private readonly idf: Map<string, number>;
  private readonly chunks: ChunkJson[];
  private readonly entityBonus: number;
  private readonly nameWords: Set<string>;

  constructor(data: KnowledgeJson["retrieval"]) {
    this.stop = new Set(data.stopwords);
    this.synonyms = new Map(Object.entries(data.synonyms));
    this.vectors = data.chunks.map((c) => new Map(Object.entries(c.vector)));
    this.idf = new Map(Object.entries(data.idf));
    this.chunks = data.chunks;
    this.entityBonus = data.entity_bonus;
    this.nameWords = new Set(data.name_words);
  }

  /** "Does he know C++ and Next.js?" → ["c++", "next.js"] (stopwords removed). */
  words(text: string): string[] {
    return (fold(text).match(TOKEN_RE) ?? []).filter((w) => !this.stop.has(w));
  }

  /** Words (with synonyms) plus adjacent pairs: ["machine", "learning", "machine learning"]. */
  private terms(text: string): string[] {
    const ws = this.words(text).flatMap((w) => {
      const synonyms = this.synonyms.get(w);
      return synonyms ? [w, ...this.words(synonyms)] : [w];
    });
    const pairs = ws.slice(1).map((w, i) => `${ws[i]} ${w}`);
    return [...ws, ...pairs];
  }

  /** Sublinear tf × idf, L2-normalized. Map keeps insertion order, like Python's dict. */
  private vectorize(terms: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const t of terms) counts.set(t, (counts.get(t) ?? 0) + 1);
    const vec = new Map<string, number>();
    for (const [t, c] of counts) {
      const idf = this.idf.get(t);
      if (idf !== undefined) vec.set(t, (1 + Math.log(c)) * idf);
    }
    let norm = 0;
    for (const v of vec.values()) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    for (const [t, v] of vec) vec.set(t, v / norm);
    return vec;
  }

  search(question: string, k: number): Hit[] {
    const q = this.vectorize(this.terms(question));
    const qWords = new Set(this.words(question));
    const contains = (name: string[]) => name.every((w) => qWords.has(w));
    const scored = this.chunks.map((chunk, i) => {
      const vector = this.vectors[i];
      let score = 0;
      for (const [t, w] of q) score += w * (vector.get(t) ?? 0);
      if (chunk.entities.some(contains)) score += this.entityBonus;
      else if (chunk.techs.some(contains)) score += chunk.tech_bonus;
      return { id: chunk.id, title: chunk.title, score };
    });
    scored.sort((a, b) => b.score - a.score); // stable, like Python's sort
    return scored.slice(0, k);
  }

  /** A question that names him and asks nothing else ("Who is Juan Alfonso Vega Sol?"). */
  aboutHim(question: string): boolean {
    const all = fold(question).match(TOKEN_RE) ?? [];
    const content = this.words(question).filter((w) => w.length > 1);
    return all.some((w) => this.nameWords.has(w)) && content.length === 0;
  }
}

/** The hits confident enough to show the model (best first) — retrieval.select_hits. */
export function selectHits(hits: Hit[], threshold: number, relative: number, maxChunks: number): Hit[] {
  if (!hits.length || hits[0].score < threshold) return [];
  const floor = Math.max(threshold, relative * hits[0].score);
  return hits.filter((h) => h.score >= floor).slice(0, maxChunks);
}
