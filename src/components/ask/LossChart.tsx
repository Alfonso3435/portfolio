"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SERIES } from "@/components/ask/chartColors";

type Point = readonly [epoch: number, train: number, dev: number];

// Log scale: the first epoch starts at 2.5 and the last at 0.02, and on a linear axis
// everything after epoch 5 would be a flat line on the floor.
const PAD = { top: 16, right: 48, bottom: 36, left: 52 };
const Y_MIN = 0.015;
const Y_MAX = 3;
const Y_TICKS = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2];

/** Train vs. dev loss per fine-tuning epoch, with a crosshair readout. */
export function LossChart({ curve }: { curve: readonly Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  // Draw at the container's real width, so text stays 11px on a phone instead of shrinking.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 240 : 280;
  const last = curve[curve.length - 1][0];
  const xTicks = W < 480 ? [1, Math.round(last / 2), last] : [1, 0.25, 0.5, 0.75].map((f, i) => (i ? Math.round(last * f) : 1)).concat(last);
  const x = (epoch: number) => PAD.left + ((epoch - 1) / (last - 1)) * (W - PAD.left - PAD.right);
  const y = (loss: number) => {
    const t = (Math.log(loss) - Math.log(Y_MIN)) / (Math.log(Y_MAX) - Math.log(Y_MIN));
    return H - PAD.bottom - t * (H - PAD.top - PAD.bottom);
  };
  const path = (i: 1 | 2) => curve.map((p, k) => `${k ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[i]).toFixed(1)}`).join("");

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const k = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (last - 1));
    setActive(Math.max(0, Math.min(curve.length - 1, k)));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    setActive((a) => Math.max(0, Math.min(curve.length - 1, (a ?? curve.length - 1) + step)));
  };

  const p = active === null ? null : curve[active];
  const end = curve[curve.length - 1];

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted" aria-hidden="true">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full" style={{ background: SERIES[0] }} /> Training loss
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full" style={{ background: SERIES[1] }} /> Dev loss (held-out questions)
        </span>
      </div>
      <div ref={box} className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          role="img"
          aria-label={`Loss over ${last} fine-tuning epochs: training loss falls from ${curve[0][1]} to ${end[1]}, dev loss from ${curve[0][2]} to ${end[2]}. Use the arrow keys to read each epoch.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {Y_TICKS.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted font-mono text-[11px]">
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={H - PAD.bottom + 20} textAnchor="middle" className="fill-muted font-mono text-[11px]">
              {t}
            </text>
          ))}
          <text x={W - PAD.right} y={H - 2} textAnchor="end" className="fill-muted text-[11px]">
            epoch
          </text>
          <text x={8} y={PAD.top - 4} className="fill-muted text-[11px]">
            loss (log scale)
          </text>

          <path d={path(1)} fill="none" stroke={SERIES[0]} strokeWidth={2} strokeLinejoin="round" />
          <path d={path(2)} fill="none" stroke={SERIES[1]} strokeWidth={2} strokeLinejoin="round" />
          {/* Direct labels at the line ends */}
          <text x={x(last) + 6} y={y(end[1])} dy="0.32em" className="fill-fg text-[12px]">train</text>
          <text x={x(last) + 6} y={y(end[2])} dy="0.32em" className="fill-fg text-[12px]">dev</text>

          {p ? (
            <g>
              <line x1={x(p[0])} x2={x(p[0])} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-muted)" strokeWidth={1} />
              <circle cx={x(p[0])} cy={y(p[1])} r={4.5} fill={SERIES[0]} stroke="var(--color-surface)" strokeWidth={2} />
              <circle cx={x(p[0])} cy={y(p[2])} r={4.5} fill={SERIES[1]} stroke="var(--color-surface)" strokeWidth={2} />
            </g>
          ) : null}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={W - PAD.left - PAD.right}
            height={H - PAD.top - PAD.bottom}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        {p ? (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-line bg-bg/95 px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(x(p[0]) / W) * 100}%`,
              transform: `translateX(${p[0] > last * 0.6 ? "calc(-100% - 12px)" : "12px"})`,
            }}
            role="status"
          >
            <p className="font-mono text-muted">Epoch {p[0]}</p>
            <p className="mt-1 flex items-center gap-2">
              <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES[0] }} />
              <strong className="font-mono text-fg">{p[1].toFixed(3)}</strong>
              <span className="text-muted">train</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES[1] }} />
              <strong className="font-mono text-fg">{p[2].toFixed(3)}</strong>
              <span className="text-muted">dev</span>
            </p>
          </div>
        ) : null}
      </div>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none hover:text-fg">View as table</summary>
        <div className="mt-2 max-h-56 overflow-y-auto">
          <table className="w-full font-mono">
            <thead>
              <tr className="text-left">
                <th className="py-1 font-medium">Epoch</th>
                <th className="py-1 font-medium">Train loss</th>
                <th className="py-1 font-medium">Dev loss</th>
              </tr>
            </thead>
            <tbody>
              {curve.map(([e, t, d]) => (
                <tr key={e} className="border-t border-line">
                  <td className="py-0.5">{e}</td>
                  <td className="py-0.5">{t}</td>
                  <td className="py-0.5">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
