import { CONTEXT, SERIES } from "@/components/ask/chartColors";

interface Version {
  version: string;
  params: string;
  change: string;
  stress: number;
  test?: number;
  final?: boolean;
}

/**
 * Exact-match accuracy on the 453-question stress set (phrasings no run trained on), one
 * bar per training run. The final model is the only colored bar; the rest are context.
 */
export function VersionBars({ versions }: { versions: readonly Version[] }) {
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="text-sm text-muted">Exact answers on 453 rephrased questions, by training run</figcaption>
      <ul className="flex flex-col gap-3.5">
        {versions.map((v) => (
          <li
            key={v.version}
            className="group grid grid-cols-[3.25rem_1fr] items-center gap-x-3 gap-y-1 rounded-lg"
            tabIndex={0}
            aria-label={`${v.version}, ${v.params} parameters, ${v.change}: ${(v.stress * 100).toFixed(1)}% on the stress set${v.test ? `, ${(v.test * 100).toFixed(1)}% on the test set` : ""}`}
          >
            <span className={`font-mono text-sm ${v.final ? "font-semibold text-fg" : "text-muted"}`}>{v.version}</span>
            <div className="flex items-center gap-2.5">
              <div className="h-3 flex-1 rounded-r bg-surface-2">
                <div
                  className="h-full rounded-r transition-[filter] group-hover:brightness-125 group-focus:brightness-125"
                  style={{ width: `${v.stress * 100}%`, background: v.final ? SERIES[0] : CONTEXT }}
                />
              </div>
              <span className={`w-14 text-right font-mono text-sm ${v.final ? "font-semibold text-fg" : "text-muted"}`}>
                {(v.stress * 100).toFixed(1)}%
              </span>
            </div>
            <span />
            <p className="text-xs text-muted">
              {v.params} params · {v.change}
              {v.test ? <span className="text-fg"> · test {(v.test * 100).toFixed(1)}%</span> : null}
            </p>
          </li>
        ))}
      </ul>
    </figure>
  );
}
