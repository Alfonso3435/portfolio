// The decoder-only transformer from ml/askalfonso/model.py, forward pass only, in plain
// TypeScript. No ML library: the same math the Python model does, written out by hand.
//
//   x = tok_emb[id] + pos_emb[position]
//   for each block:  x += Attention(LayerNorm(x));  x += MLP(LayerNorm(x))
//   logits = LayerNorm(x) · tok_embᵀ         (weight tying: the output layer *is* tok_emb)
//
// KV cache: when generating, each new token only needs its own query against the keys and
// values of every earlier token. Those don't change, so they're stored instead of
// recomputed — generating token n costs O(n) instead of re-running the whole prompt.

import type { ModelConfig, ModelJson } from "./types";

/** IEEE 754 half → float (model.bin stores float16 to halve the download). */
export function halfToFloat32(half: Uint16Array): Float32Array {
  const out = new Float32Array(half.length);
  for (let i = 0; i < half.length; i++) {
    const h = half[i];
    const sign = h & 0x8000 ? -1 : 1;
    const exp = (h >> 10) & 0x1f;
    const frac = h & 0x3ff;
    if (exp === 0) out[i] = sign * frac * 2 ** -24; // subnormal
    else if (exp === 31) out[i] = frac ? NaN : sign * Infinity;
    else out[i] = sign * (1 + frac / 1024) * 2 ** (exp - 15);
  }
  return out;
}

/** erf(x) with |error| < 1.2e-7 (Numerical Recipes' erfc Chebyshev fit) — for exact GELU. */
function erf(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? 1 - r : r - 1;
}

/** GELU as PyTorch's default F.gelu: x · Φ(x) with the exact normal CDF. */
function gelu(x: number): number {
  return 0.5 * x * (1 + erf(x * Math.SQRT1_2));
}

interface Layer {
  ln1: Float32Array;
  qkv: Float32Array; // (3C × C)
  attnProj: Float32Array; // (C × C)
  ln2: Float32Array;
  fc: Float32Array; // (4C × C)
  mlpProj: Float32Array; // (C × 4C)
}

/** out[t, j] = Σᵢ x[t, i] · W[j, i] — a PyTorch Linear (W stored out × in), for T rows.
 *  nIn must be a multiple of 4 (it's C or 4C). */
function linear(out: Float32Array, x: Float32Array, rows: number, w: Float32Array, nOut: number, nIn: number): void {
  for (let t = 0; t < rows; t++) {
    const xo = t * nIn;
    const oo = t * nOut;
    for (let j = 0; j < nOut; j++) {
      const wo = j * nIn;
      // 4 partial sums: lets the JIT pipeline independent multiply-adds (~2× faster).
      let s0 = 0;
      let s1 = 0;
      let s2 = 0;
      let s3 = 0;
      for (let i = 0; i < nIn; i += 4) {
        s0 += x[xo + i] * w[wo + i];
        s1 += x[xo + i + 1] * w[wo + i + 1];
        s2 += x[xo + i + 2] * w[wo + i + 2];
        s3 += x[xo + i + 3] * w[wo + i + 3];
      }
      out[oo + j] = s0 + s1 + s2 + s3;
    }
  }
}

/** LayerNorm without bias (bias=False in training), per row, biased variance like PyTorch. */
function layerNorm(out: Float32Array, x: Float32Array, rows: number, c: number, weight: Float32Array, eps: number) {
  for (let t = 0; t < rows; t++) {
    const o = t * c;
    let mean = 0;
    for (let i = 0; i < c; i++) mean += x[o + i];
    mean /= c;
    let variance = 0;
    for (let i = 0; i < c; i++) {
      const d = x[o + i] - mean;
      variance += d * d;
    }
    const inv = 1 / Math.sqrt(variance / c + eps);
    for (let i = 0; i < c; i++) out[o + i] = (x[o + i] - mean) * inv * weight[i];
  }
}

export class Model {
  readonly cfg: ModelConfig;
  private readonly eps: number;
  private readonly tokEmb: Float32Array;
  private readonly posEmb: Float32Array;
  private readonly layers: Layer[] = [];
  private readonly lnF: Float32Array;
  // KV cache: per layer, block_size × C floats each.
  private readonly kCache: Float32Array[];
  private readonly vCache: Float32Array[];
  private length = 0; // tokens currently in the cache

  constructor(meta: ModelJson, weights: Float32Array) {
    this.cfg = meta.config;
    this.eps = meta.layer_norm_eps;
    const get = (name: string) => {
      const t = meta.tensors.find((x) => x.name === name);
      if (!t) throw new Error(`model.bin has no tensor ${name}`);
      const size = t.shape.reduce((a, b) => a * b, 1);
      return weights.subarray(t.offset, t.offset + size);
    };
    this.tokEmb = get("tok_emb.weight");
    this.posEmb = get("pos_emb.weight");
    for (let i = 0; i < this.cfg.n_layer; i++) {
      const p = `blocks.${i}.`;
      this.layers.push({
        ln1: get(p + "ln1.weight"),
        qkv: get(p + "attn.qkv.weight"),
        attnProj: get(p + "attn.proj.weight"),
        ln2: get(p + "ln2.weight"),
        fc: get(p + "mlp.fc.weight"),
        mlpProj: get(p + "mlp.proj.weight"),
      });
    }
    this.lnF = get("ln_f.weight");
    const cacheSize = this.cfg.block_size * this.cfg.n_embd;
    this.kCache = this.layers.map(() => new Float32Array(cacheSize));
    this.vCache = this.layers.map(() => new Float32Array(cacheSize));
  }

  reset(): void {
    this.length = 0;
  }

  /**
   * Run `ids` (the next tokens after what's already cached) through the model, append
   * their keys/values to the cache, and return the logits for the *last* one.
   * The prompt goes through in one call ("prefill"); then one token per call.
   */
  forward(ids: number[]): Float32Array {
    const { n_embd: C, n_head: H, vocab_size: V, block_size } = this.cfg;
    const T = ids.length;
    const start = this.length;
    if (start + T > block_size) throw new Error("Context window exceeded");
    const D = C / H;
    const scale = 1 / Math.sqrt(D);

    const x = new Float32Array(T * C);
    for (let t = 0; t < T; t++) {
      const e = ids[t] * C;
      const p = (start + t) * C;
      for (let i = 0; i < C; i++) x[t * C + i] = this.tokEmb[e + i] + this.posEmb[p + i];
    }

    const h = new Float32Array(T * C);
    const qkv = new Float32Array(T * 3 * C);
    const attn = new Float32Array(T * C);
    const proj = new Float32Array(T * C);
    const hidden = new Float32Array(T * 4 * C);
    const scores = new Float32Array(start + T);

    this.layers.forEach((layer, l) => {
      // ── attention ──
      layerNorm(h, x, T, C, layer.ln1, this.eps);
      linear(qkv, h, T, layer.qkv, 3 * C, C);
      const K = this.kCache[l];
      const Vc = this.vCache[l];
      for (let t = 0; t < T; t++) {
        // q = qkv[t, 0:C], k = qkv[t, C:2C], v = qkv[t, 2C:3C]; store k and v for later tokens.
        K.set(qkv.subarray(t * 3 * C + C, t * 3 * C + 2 * C), (start + t) * C);
        Vc.set(qkv.subarray(t * 3 * C + 2 * C, t * 3 * C + 3 * C), (start + t) * C);
      }
      // In the last layer only the final token's output is ever used (to predict the next
      // token), so the other positions stop here: their keys/values are already cached.
      const first = l === this.layers.length - 1 ? T - 1 : 0;
      const rows = T - first;
      for (let t = first; t < T; t++) {
        const pos = start + t; // causal mask: attend to positions 0..pos only
        for (let head = 0; head < H; head++) {
          const qo = t * 3 * C + head * D;
          let max = -Infinity;
          for (let s = 0; s <= pos; s++) {
            const ko = s * C + head * D;
            let dot = 0;
            for (let d = 0; d < D; d++) dot += qkv[qo + d] * K[ko + d];
            const score = dot * scale;
            scores[s] = score;
            if (score > max) max = score;
          }
          let sum = 0;
          for (let s = 0; s <= pos; s++) {
            const e = Math.exp(scores[s] - max); // softmax, shifted for numerical stability
            scores[s] = e;
            sum += e;
          }
          const oo = (t - first) * C + head * D;
          for (let d = 0; d < D; d++) attn[oo + d] = 0;
          for (let s = 0; s <= pos; s++) {
            const w = scores[s] / sum;
            const vo = s * C + head * D;
            for (let d = 0; d < D; d++) attn[oo + d] += w * Vc[vo + d];
          }
        }
      }
      const xs = x.subarray(first * C); // the rows still being computed
      linear(proj, attn, rows, layer.attnProj, C, C);
      for (let i = 0; i < rows * C; i++) xs[i] += proj[i];

      // ── MLP ──
      layerNorm(h, xs, rows, C, layer.ln2, this.eps);
      linear(hidden, h, rows, layer.fc, 4 * C, C);
      for (let i = 0; i < rows * 4 * C; i++) hidden[i] = gelu(hidden[i]);
      linear(proj, hidden, rows, layer.mlpProj, C, 4 * C);
      for (let i = 0; i < rows * C; i++) xs[i] += proj[i];
    });
    this.length = start + T;

    // Only the last position predicts the next token.
    const last = new Float32Array(C);
    layerNorm(last, x.subarray((T - 1) * C, T * C), 1, C, this.lnF, this.eps);
    const logits = new Float32Array(V);
    linear(logits, last, 1, this.tokEmb, V, C);
    return logits;
  }

  /** Greedy decoding (temperature 0), like inference.generate_answer in Python. */
  generate(prompt: number[], maxNewTokens: number, stopId: number): { ids: number[]; finished: boolean } {
    this.reset();
    const out: number[] = [];
    let logits = this.forward(prompt);
    for (let n = 0; n < maxNewTokens; n++) {
      let next = 0;
      for (let i = 1; i < logits.length; i++) if (logits[i] > logits[next]) next = i;
      if (next === stopId) return { ids: out, finished: true };
      out.push(next);
      if (n === maxNewTokens - 1) break;
      logits = this.forward([next]);
    }
    return { ids: out, finished: false };
  }
}
