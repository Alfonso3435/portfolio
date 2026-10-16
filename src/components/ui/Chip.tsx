import type { ReactNode } from "react";

interface ChipProps {
  children: ReactNode;
  /** accent = awards/status; muted = categories. */
  tone?: "accent" | "muted";
}

export function Chip({ children, tone = "muted" }: ChipProps) {
  const styles =
    tone === "accent" ? "bg-accent-soft text-accent" : "border border-line text-muted";
  return (
    <span className={`inline-flex w-fit rounded-full px-2.5 py-1 font-mono text-xs leading-none ${styles}`}>
      {children}
    </span>
  );
}
