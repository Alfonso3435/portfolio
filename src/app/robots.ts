import type { MetadataRoute } from "next";
import { profile } from "@/data/profile";

// Served at /robots.txt. Lets every search engine crawl the site and points it to the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${profile.siteUrl}/sitemap.xml`,
  };
}
