"""A decoder-only transformer (GPT-style), written from scratch in PyTorch.

Reading order, top to bottom:
    GPTConfig            → the hyperparameters
    CausalSelfAttention  → how each token looks at the tokens before it
    MLP                  → how each token "thinks" about what it gathered
    Block                → attention + MLP, with layer norm and residual connections
    GPT                  → embeddings → N blocks → logits over the vocabulary
    GPT.generate         → turns the model into a text generator, one token at a time

Shapes are written as comments. Letters used:
    B = batch size, T = sequence length (tokens), C = n_embd (vector size per token),
    H = n_head (attention heads), D = C // H (size of each head), V = vocab size.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F

# Loss positions labeled with this value are skipped (padding, and the prompt during fine-tuning).
IGNORE_INDEX = -100


@dataclass
class GPTConfig:
    vocab_size: int = 2053  # from the tokenizer: 256 bytes + merges + special tokens
    block_size: int = 768  # max tokens the model can read at once (its context window)
    n_layer: int = 4  # how many transformer blocks are stacked
    n_head: int = 4  # attention heads per block
    n_embd: int = 256  # size of the vector that represents each token
    dropout: float = 0.1  # regularization (Improving Deep Neural Networks, week 1)
    bias: bool = False  # biases in Linear/LayerNorm; modern LLMs drop them with no loss in quality

    def to_dict(self) -> dict:
        return asdict(self)


class CausalSelfAttention(nn.Module):
    """Multi-head *causal* self-attention.

    For every token, attention answers: "which earlier tokens matter to me, and
    what information should I take from them?"

        Q = x·Wq   (query: what am I looking for?)
        K = x·Wk   (key:   what do I contain?)
        V = x·Wv   (value: what do I hand over if chosen?)

        attention(Q, K, V) = softmax(Q·Kᵀ / √D + mask) · V

    • Q·Kᵀ scores every pair of tokens (how well a query matches a key).
    • Dividing by √D keeps those scores from growing with the head size;
      otherwise softmax saturates and gradients vanish.
    • The causal mask sets scores for *future* tokens to −∞, so after softmax
      their weight is exactly 0: a token can't peek at the answer it must predict.
    • Several heads run in parallel, each with its own Wq/Wk/Wv, so one head can
      track "which project is this about?" while another tracks grammar.
    """

    def __init__(self, cfg: GPTConfig):
        super().__init__()
        if cfg.n_embd % cfg.n_head != 0:
            raise ValueError("n_embd must be divisible by n_head")
        self.n_head = cfg.n_head
        self.head_dim = cfg.n_embd // cfg.n_head
        # One matrix computes Q, K and V for all heads at once (3 × C outputs) — same math, faster.
        self.qkv = nn.Linear(cfg.n_embd, 3 * cfg.n_embd, bias=cfg.bias)
        self.proj = nn.Linear(cfg.n_embd, cfg.n_embd, bias=cfg.bias)  # mixes the heads back together
        self.attn_dropout = nn.Dropout(cfg.dropout)
        self.resid_dropout = nn.Dropout(cfg.dropout)
        # Lower-triangular matrix of ones: position i may look at positions 0..i.
        mask = torch.tril(torch.ones(cfg.block_size, cfg.block_size, dtype=torch.bool))
        self.register_buffer("causal_mask", mask.view(1, 1, cfg.block_size, cfg.block_size), persistent=False)
        self.last_attention: torch.Tensor | None = None  # filled when keep_attention=True (Lab visualizer)

    def forward(self, x: torch.Tensor, keep_attention: bool = False) -> torch.Tensor:
        B, T, C = x.shape
        q, k, v = self.qkv(x).split(C, dim=2)  # each (B, T, C)

        # Split C into H heads of size D and move heads next to the batch: (B, H, T, D).
        q = q.view(B, T, self.n_head, self.head_dim).transpose(1, 2)
        k = k.view(B, T, self.n_head, self.head_dim).transpose(1, 2)
        v = v.view(B, T, self.n_head, self.head_dim).transpose(1, 2)

        scores = (q @ k.transpose(-2, -1)) / math.sqrt(self.head_dim)  # (B, H, T, T)
        scores = scores.masked_fill(~self.causal_mask[:, :, :T, :T], float("-inf"))
        weights = F.softmax(scores, dim=-1)  # each row sums to 1
        if keep_attention:
            self.last_attention = weights.detach()
        weights = self.attn_dropout(weights)

        out = weights @ v  # (B, H, T, D): a weighted average of the values
        out = out.transpose(1, 2).contiguous().view(B, T, C)  # concatenate the heads back
        return self.resid_dropout(self.proj(out))


class MLP(nn.Module):
    """Position-wise feed-forward network: the same 2-layer net applied to every token.

    Attention moves information *between* tokens; the MLP processes it *within*
    each token. Expanding to 4×C gives it room to compute, GELU adds non-linearity.
    """

    def __init__(self, cfg: GPTConfig):
        super().__init__()
        self.fc = nn.Linear(cfg.n_embd, 4 * cfg.n_embd, bias=cfg.bias)
        self.proj = nn.Linear(4 * cfg.n_embd, cfg.n_embd, bias=cfg.bias)
        self.dropout = nn.Dropout(cfg.dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.dropout(self.proj(F.gelu(self.fc(x))))


class Block(nn.Module):
    """One transformer block: x + Attention(LN(x)), then x + MLP(LN(x)).

    • Residual connections ("x + …") give gradients a straight path back through
      every layer, the same idea that lets ResNets train deep networks.
    • LayerNorm normalizes each token's vector to mean 0 / variance 1 before each
      sub-layer ("pre-norm", as in GPT-2), which keeps training stable — it's
      the per-token cousin of batch norm from Improving Deep Neural Networks.
    """

    def __init__(self, cfg: GPTConfig):
        super().__init__()
        self.ln1 = nn.LayerNorm(cfg.n_embd, bias=cfg.bias)
        self.attn = CausalSelfAttention(cfg)
        self.ln2 = nn.LayerNorm(cfg.n_embd, bias=cfg.bias)
        self.mlp = MLP(cfg)

    def forward(self, x: torch.Tensor, keep_attention: bool = False) -> torch.Tensor:
        x = x + self.attn(self.ln1(x), keep_attention)
        x = x + self.mlp(self.ln2(x))
        return x


class GPT(nn.Module):
    def __init__(self, cfg: GPTConfig):
        super().__init__()
        self.cfg = cfg
        self.tok_emb = nn.Embedding(cfg.vocab_size, cfg.n_embd)  # token id → vector (what)
        self.pos_emb = nn.Embedding(cfg.block_size, cfg.n_embd)  # position → vector (where)
        self.dropout = nn.Dropout(cfg.dropout)
        self.blocks = nn.ModuleList([Block(cfg) for _ in range(cfg.n_layer)])
        self.ln_f = nn.LayerNorm(cfg.n_embd, bias=cfg.bias)
        self.lm_head = nn.Linear(cfg.n_embd, cfg.vocab_size, bias=False)  # vector → score per token

        # Weight tying: reading a token and writing a token use the same matrix.
        # Saves vocab×C parameters (~0.5M here) and usually improves small models.
        self.lm_head.weight = self.tok_emb.weight

        self.apply(self._init_weights)
        # Scale down the layers that write into the residual stream, so its variance
        # doesn't grow with depth (GPT-2 trick): std 0.02 / √(2·n_layer).
        for name, param in self.named_parameters():
            if name.endswith("proj.weight"):
                nn.init.normal_(param, mean=0.0, std=0.02 / math.sqrt(2 * cfg.n_layer))

    @staticmethod
    def _init_weights(module: nn.Module) -> None:
        if isinstance(module, (nn.Linear, nn.Embedding)):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
        if isinstance(module, nn.Linear) and module.bias is not None:
            nn.init.zeros_(module.bias)

    def num_params(self, include_embeddings: bool = True) -> int:
        n = sum(p.numel() for p in self.parameters())  # tied weights are counted once
        return n if include_embeddings else n - self.pos_emb.weight.numel() - self.tok_emb.weight.numel()

    def forward(
        self,
        idx: torch.Tensor,
        targets: torch.Tensor | None = None,
        keep_attention: bool = False,
    ) -> tuple[torch.Tensor, torch.Tensor | None]:
        """idx: (B, T) token ids. targets: (B, T) the next token at each position, or IGNORE_INDEX.

        Returns logits (B, T, V) — a score for every possible next token at every
        position — and, if targets are given, the average cross-entropy loss.
        """
        B, T = idx.shape
        if T > self.cfg.block_size:
            raise ValueError(f"Sequence of {T} tokens exceeds block_size {self.cfg.block_size}")

        positions = torch.arange(T, device=idx.device)
        x = self.dropout(self.tok_emb(idx) + self.pos_emb(positions))  # (B, T, C)
        for block in self.blocks:
            x = block(x, keep_attention)
        logits = self.lm_head(self.ln_f(x))  # (B, T, V)

        loss = None
        if targets is not None:
            # Cross-entropy = −log(probability the model gave to the correct next token).
            loss = F.cross_entropy(
                logits.view(-1, logits.size(-1)), targets.view(-1), ignore_index=IGNORE_INDEX
            )
        return logits, loss

    def attention_maps(self) -> list[torch.Tensor]:
        """Per-layer attention weights (B, H, T, T) from the last forward(keep_attention=True)."""
        return [b.attn.last_attention for b in self.blocks if b.attn.last_attention is not None]

    @torch.no_grad()
    def generate(
        self,
        idx: torch.Tensor,
        max_new_tokens: int,
        temperature: float = 1.0,
        top_k: int | None = None,
        stop_token: int | None = None,
    ) -> torch.Tensor:
        """Autoregressive generation: predict a token, append it, repeat.

        temperature < 1 makes the model more confident (0 → always the top token);
        top_k keeps only the k most likely tokens before sampling.
        Stops early when every sequence has produced `stop_token` (e.g. <|end|>).
        """
        self.eval()
        finished = torch.zeros(idx.size(0), dtype=torch.bool, device=idx.device)
        for _ in range(max_new_tokens):
            context = idx[:, -self.cfg.block_size :]  # never feed more than the window
            logits, _ = self(context)
            logits = logits[:, -1, :]  # only the last position predicts the *next* token
            if temperature == 0:
                next_id = logits.argmax(dim=-1, keepdim=True)
            else:
                logits = logits / temperature
                if top_k is not None:
                    kth = torch.topk(logits, min(top_k, logits.size(-1))).values[:, [-1]]
                    logits = logits.masked_fill(logits < kth, float("-inf"))
                next_id = torch.multinomial(F.softmax(logits, dim=-1), num_samples=1)
            if stop_token is not None:
                next_id = next_id.masked_fill(finished.unsqueeze(1), stop_token)  # keep finished rows padded
                finished |= next_id.squeeze(1) == stop_token
            idx = torch.cat([idx, next_id], dim=1)
            if stop_token is not None and finished.all():
                break
        return idx
