// Byte-level BPE, the TypeScript twin of ml/askalfonso/tokenizer.py.
// Same pre-tokenizer regex, same merges, same order → the same token ids (tested).

import type { ModelJson } from "./types";

// Python's `re` and JavaScript disagree on what \w and \d mean for non-ASCII text, so the
// pattern is spelled out with Unicode classes. Python \w = letters + any numeric + "_",
// \d = decimal digits (Nd), so [^\W\d_] = letters + non-decimal numerals.
const WORD = "[\\p{L}\\p{Nl}\\p{No}]";
const SPLIT_PATTERN =
  "'(?:s|t|re|ve|m|ll|d)| ?" + WORD + "+| ?\\p{Nd}{1,3}| ?(?:[^\\s\\p{L}\\p{N}_]|_)+|\\s+(?!\\S)|\\s+";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8"); // invalid bytes → "�", like Python's errors="replace"

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class Tokenizer {
  private readonly ranks = new Map<number, number>(); // pair (a·65536 + b) → merged id; lower id = learned first
  private readonly vocab: Uint8Array[] = [];
  private readonly special = new Map<string, number>();
  private readonly specialById = new Map<number, string>();
  private readonly specialRe: RegExp;
  private readonly cache = new Map<string, number[]>();

  constructor(data: ModelJson["tokenizer"]) {
    for (let i = 0; i < 256; i++) this.vocab.push(Uint8Array.of(i));
    data.merges.forEach(([a, b], i) => {
      const id = 256 + i;
      this.ranks.set(a * 65536 + b, id);
      const merged = new Uint8Array(this.vocab[a].length + this.vocab[b].length);
      merged.set(this.vocab[a]);
      merged.set(this.vocab[b], this.vocab[a].length);
      this.vocab.push(merged);
    });
    for (const [token, id] of Object.entries(data.special_tokens)) {
      this.special.set(token, id);
      this.specialById.set(id, token);
    }
    this.specialRe = new RegExp("(" + [...this.special.keys()].map(escapeRegex).join("|") + ")");
  }

  tokenId(token: string): number {
    const id = this.special.get(token);
    if (id === undefined) throw new Error(`Unknown special token ${token}`);
    return id;
  }

  /** Apply merges to one pre-token, earliest-learned merge first (like tokenizer.py). */
  private encodePiece(piece: string): number[] {
    const cached = this.cache.get(piece);
    if (cached) return cached;
    let ids = Array.from(encoder.encode(piece));
    while (ids.length >= 2) {
      let best = Infinity;
      let bestKey = -1;
      for (let i = 0; i < ids.length - 1; i++) {
        const key = ids[i] * 65536 + ids[i + 1];
        const rank = this.ranks.get(key);
        if (rank !== undefined && rank < best) {
          best = rank;
          bestKey = key;
        }
      }
      if (bestKey < 0) break;
      const a = Math.floor(bestKey / 65536);
      const b = bestKey % 65536;
      const merged: number[] = [];
      for (let i = 0; i < ids.length; ) {
        if (i < ids.length - 1 && ids[i] === a && ids[i + 1] === b) {
          merged.push(best);
          i += 2;
        } else {
          merged.push(ids[i]);
          i += 1;
        }
      }
      ids = merged;
    }
    if (this.cache.size < 50_000) this.cache.set(piece, ids);
    return ids;
  }

  encode(text: string): number[] {
    const ids: number[] = [];
    for (const part of text.split(this.specialRe)) {
      if (!part) continue;
      const special = this.special.get(part);
      if (special !== undefined) {
        ids.push(special);
        continue;
      }
      for (const match of part.matchAll(new RegExp(SPLIT_PATTERN, "gu"))) {
        ids.push(...this.encodePiece(match[0]));
      }
    }
    return ids;
  }

  decode(ids: number[]): string {
    const parts: Uint8Array[] = [];
    let length = 0;
    for (const id of ids) {
      const special = this.specialById.get(id);
      const bytes = special !== undefined ? encoder.encode(special) : this.vocab[id];
      parts.push(bytes);
      length += bytes.length;
    }
    const all = new Uint8Array(length);
    let offset = 0;
    for (const p of parts) {
      all.set(p, offset);
      offset += p.length;
    }
    return decoder.decode(all);
  }
}
