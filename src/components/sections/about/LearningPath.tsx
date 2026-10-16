import Link from "next/link";
import { certifications } from "@/data/certifications";
import { profile } from "@/data/profile";
import { formatYearMonth } from "@/lib/format";

export function LearningPath() {
  // Newest first; undated certificates go at the end.
  const sorted = [...certifications].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return (
    <section aria-labelledby="learning" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 id="learning" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Learning path
        </h2>
        <p className="text-muted">
          Each course fed the next project, all leading to a language model built from scratch.
        </p>
      </div>

      <ol className="ml-1.5 flex flex-col border-l-2 border-line">
        <li className="relative pb-6 pl-6">
          <span aria-hidden="true" className="absolute top-1.5 -left-[7px] size-3 rounded-full bg-accent" />
          <p className="font-mono text-xs text-accent">NOW</p>
          <p className="mt-0.5 font-medium">
            {profile.assistantName}: a transformer built from scratch{" "}
            <Link href="/lab" className="text-accent hover:text-fg">
              → see the Lab
            </Link>
          </p>
        </li>
        {sorted.map((cert) => (
          <li key={cert.title} className="relative pb-6 pl-6 last:pb-0">
            <span aria-hidden="true" className="absolute top-1.5 -left-[7px] size-3 rounded-full bg-line" />
            <p className="font-mono text-xs uppercase text-muted">
              {[cert.date ? formatYearMonth(cert.date) : null, cert.program].filter(Boolean).join(" · ") || "Completed"}
            </p>
            <p className="mt-0.5 font-medium">{cert.title}</p>
            <p className="text-sm text-muted">
              {cert.issuer}
              {cert.score ? ` · ${cert.score}` : ""}
              {cert.verifyUrl ? (
                <>
                  {" · "}
                  <a href={cert.verifyUrl} target="_blank" rel="noreferrer" className="text-accent hover:text-fg">
                    Verify
                  </a>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
