import { SERIES } from "@/components/ask/chartColors";
import { labMetrics } from "@/data/lab-metrics";

const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1000)}K`);
const fmt = (n: number) => n.toLocaleString("en-US");

function Box({ title, detail, params }: { title: string; detail: string; params?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
      {params ? <span className="shrink-0 font-mono text-xs text-muted">{params}</span> : null}
    </div>
  );
}

const Arrow = () => (
  <div aria-hidden="true" className="mx-auto h-4 w-px bg-line" />
);

/** The transformer, top to bottom, with where its 3.9M parameters live. */
export function ModelDiagram() {
  const m = labMetrics.model;
  const g = m.groups;
  const perBlock = { attention: g.attention / m.layers, mlp: g.mlp / m.layers };
  const parts = [
    { name: "MLP", n: g.mlp, color: SERIES[0] },
    { name: "Attention", n: g.attention, color: SERIES[1] },
    { name: "Embeddings", n: g.embeddings, color: SERIES[2] },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex flex-col" aria-label="Model architecture, from input text to next-token prediction">
        <Box title="BPE tokenizer" detail={`${fmt(m.vocab)} tokens, ~${m.charsPerToken.toFixed(0)} characters each`} />
        <Arrow />
        <Box title="Token + position embeddings" detail={`Each token becomes a ${m.embedding}-number vector`} params={k(g.embeddings)} />
        <Arrow />
        <div className="relative rounded-2xl border border-dashed border-accent/50 p-3 pt-7">
          <span className="absolute top-2 left-3 font-mono text-xs text-accent">Transformer block ×{m.layers}</span>
          <div className="flex flex-col">
            <Box
              title="Causal self-attention"
              detail={`${m.heads} heads × ${m.headSize} dims; each token only sees the past`}
              params={`${k(perBlock.attention)} / block`}
            />
            <Arrow />
            <Box
              title="MLP"
              detail={`${m.embedding} → ${fmt(m.mlpHidden)} → ${m.embedding}, GELU`}
              params={`${k(perBlock.mlp)} / block`}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted">pre-LayerNorm + residual connection around each</p>
        </div>
        <Arrow />
        <Box title="Output head" detail={`Scores all ${fmt(m.vocab)} tokens; reuses the embedding weights`} params="0 new" />
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Where the {fmt(m.parameters)} parameters live</p>
          <div className="flex h-4 gap-0.5 overflow-hidden rounded" role="img"
            aria-label={parts.map((p) => `${p.name} ${((p.n / m.parameters) * 100).toFixed(0)}%`).join(", ")}>
            {parts.map((p) => (
              <div key={p.name} style={{ width: `${(p.n / m.parameters) * 100}%`, background: p.color }} />
            ))}
          </div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {parts.map((p) => (
              <li key={p.name} className="flex items-center gap-2.5">
                <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: p.color }} />
                <span className="flex-1">{p.name}</span>
                <span className="font-mono text-muted">{k(p.n)}</span>
                <span className="w-10 text-right font-mono">{((p.n / m.parameters) * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
          {[
            ["Layers", m.layers],
            ["Attention heads", m.heads],
            ["Width", m.embedding],
            ["Context", `${m.context} tokens`],
            ["Vocabulary", fmt(m.vocab)],
            ["Weights shipped", `${m.downloadMB} MB`],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface px-4 py-3">
              <dt className="font-mono text-[11px] uppercase text-muted">{label}</dt>
              <dd className="mt-0.5 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted">
          Every layer, the attention math and the training loop are written by hand in PyTorch: no pretrained weights,
          no <code className="font-mono text-xs">nn.Transformer</code>, no Hugging Face. The browser version is a
          from-scratch TypeScript port.
        </p>
      </div>
    </div>
  );
}
