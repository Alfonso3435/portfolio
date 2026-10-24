import { profile } from "@/data/profile";

/**
 * Structured data (schema.org Person) so Google understands who this site is
 * about and can link it to your GitHub and LinkedIn profiles.
 */
export function PersonJsonLd() {
  const uw = profile.education[0];
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    url: profile.siteUrl,
    email: `mailto:${profile.email}`,
    jobTitle: "Computer Science Student & Founder",
    description: profile.tagline,
    sameAs: [profile.links.github, profile.links.linkedin],
    knowsAbout: profile.focusAreas,
    affiliation: { "@type": "CollegeOrUniversity", name: uw.school },
    address: { "@type": "PostalAddress", addressRegion: "WA", addressCountry: "US" },
  };

  return (
    <script
      type="application/ld+json"
      // Escaping "<" keeps the JSON from ever closing the <script> tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
