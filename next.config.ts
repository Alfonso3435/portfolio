import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: false,
  // The Lab page became the "How it works" half of the Ask Alfonso tab; keep old links working.
  async redirects() {
    return [{ source: "/lab", destination: "/ask#how-it-works", permanent: true }];
  },
  // The résumé PDF is drawn with these fonts at request time (Hire Me Maybe) and build time (/resume.pdf).
  outputFileTracingIncludes: {
    "/api/hire-me-maybe": ["./src/lib/resume/fonts/**"],
    "/resume.pdf": ["./src/lib/resume/fonts/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
