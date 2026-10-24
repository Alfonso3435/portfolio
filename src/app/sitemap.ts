import type { MetadataRoute } from "next";
import { profile } from "@/data/profile";
import { projects } from "@/data/projects";
import { navItems } from "@/lib/nav";

// Served at /sitemap.xml. Tells Google every page that exists, including each
// case study — new projects in projects.ts are added automatically.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = navItems.map((item) => ({
    url: `${profile.siteUrl}${item.href === "/" ? "" : item.href}`,
    priority: item.href === "/" ? 1 : 0.8,
  }));

  const caseStudies = projects.map((p) => ({
    url: `${profile.siteUrl}/projects/${p.slug}`,
    priority: p.featured ? 0.7 : 0.5,
  }));

  return [...pages, ...caseStudies];
}
