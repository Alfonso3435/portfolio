import type { ReactNode } from "react";

interface PageIntroProps {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}

/** The label + big title + intro paragraph that opens every page. */
export function PageIntro({ eyebrow, title, children }: PageIntroProps) {
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <p className="font-mono text-[13px] uppercase tracking-[0.06em] text-accent">{eyebrow}</p>
      <h1 className="font-display text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl">{title}</h1>
      {children ? <div className="text-lg text-muted">{children}</div> : null}
    </div>
  );
}
