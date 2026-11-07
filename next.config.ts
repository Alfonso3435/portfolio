import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: false,
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
