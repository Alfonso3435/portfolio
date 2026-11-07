import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { profile } from "@/data/profile";
import { features } from "@/lib/features";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <Container className="flex flex-wrap items-center justify-between gap-4 py-6 text-sm text-muted">
        <p>
          © {profile.name} · Built with Next.js, deployed on Vercel
        </p>
        <ul className="flex flex-wrap gap-5">
          <li>
            <a href={profile.links.github} className="hover:text-fg" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </li>
          <li>
            <a href={profile.links.linkedin} className="hover:text-fg" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </li>
          <li>
            <a href={`mailto:${profile.email}`} className="hover:text-fg">
              Email
            </a>
          </li>
          {features.lab ? (
            <li>
              <Link href="/ask#how-it-works" className="text-accent hover:text-fg">
                How I built {profile.assistantName} →
              </Link>
            </li>
          ) : null}
        </ul>
      </Container>
    </footer>
  );
}
