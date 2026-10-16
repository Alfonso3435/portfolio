import Link from "next/link";
import type { ReactNode } from "react";

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}

const base =
  "inline-flex min-h-11 items-center gap-2 rounded-[10px] px-5 text-[15px] transition-colors";

const variants = {
  primary: "bg-accent font-semibold text-on-accent hover:bg-accent/90",
  secondary: "border border-line text-fg hover:border-muted",
};

/**
 * A link styled as a button. Internal paths use next/link (client-side
 * navigation); http(s), mailto: and files like /resume.pdf use a plain <a>.
 */
export function ButtonLink({ href, children, variant = "primary", className = "" }: ButtonLinkProps) {
  const classes = `${base} ${variants[variant]} ${className}`;
  const isExternal = /^(https?:|mailto:)/.test(href);
  const isFile = /\.[a-z0-9]+$/i.test(href);

  if (isExternal || isFile) {
    const newTab = href.startsWith("http");
    return (
      <a href={href} className={classes} {...(newTab ? { target: "_blank", rel: "noreferrer" } : {})}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
