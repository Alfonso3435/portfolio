"use client";

// Client component: it needs usePathname() to know which tab is active.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { profile } from "@/data/profile";
import { isActive, navItems } from "@/lib/nav";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <Container className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
        <Link
          href="/"
          className="font-mono text-base font-medium text-fg"
          aria-label={`${profile.name} — home`}
        >
          alfonsovegasol<span className="text-accent">.com</span>
        </Link>

        <nav aria-label="Main" className="order-last w-full sm:order-none sm:w-auto">
          <ul className="flex flex-wrap gap-1">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-lg px-3.5 text-[15px] transition-colors ${
                      active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <Link
          href="/lab"
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-[18px] text-[15px] font-semibold text-on-accent transition-opacity hover:opacity-90"
        >
          {profile.assistantName}
        </Link>
      </Container>
    </header>
  );
}
