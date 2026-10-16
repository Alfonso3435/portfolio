import Link from "next/link";

interface SectionHeadingProps {
  id: string;
  title: string;
  /** Optional "see all" link on the right. */
  link?: { href: string; label: string };
}

export function SectionHeading({ id, title, link }: SectionHeadingProps) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 id={id} className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {link ? (
        <Link href={link.href} className="text-[15px] font-semibold text-accent hover:text-fg">
          {link.label} →
        </Link>
      ) : null}
    </div>
  );
}
