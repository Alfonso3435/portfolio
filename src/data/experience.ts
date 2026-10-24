import type { Experience } from "@/lib/types";

// Newest first — the order here is the order on the site.
export const experience: Experience[] = [
  {
    id: "answr",
    company: "Answr",
    role: "Founder & Software Engineer",
    url: "https://answr.info",
    location: "Bellevue, WA",
    dates: { start: "2025", display: "Late 2025 — Present" },
    summary:
      "AI automation agency for local service businesses on Seattle's Eastside (Bellevue, Redmond, Sammamish, Kirkland).",
    short: "AI voice agent · <30 s response",
    highlights: [
      "Built an AI voice and SMS agent that answers missed calls, cutting first-response time from hours to under 30 seconds and recovering leads that were previously lost.",
      "Architected an event-driven automation stack on n8n, Supabase and the Claude API, orchestrating 20+ webhook-triggered workflows across lead capture, qualification, booking and follow-up.",
      "Engineered a structured-JSON prompting layer with input sanitization and a post-booking state lock, eliminating malformed responses and duplicate outreach.",
      "Designed and deployed the client-facing site and interactive demo in Next.js on Vercel, plus a two-tier plan architecture and a repeatable onboarding checklist.",
    ],
    stack: ["Claude API", "n8n", "Supabase", "Next.js", "Vercel", "GoHighLevel", "Airtable"],
    projectSlug: "answr",
  },
  {
    id: "zaptap",
    company: "ZapTap",
    role: "Founder",
    url: "https://zaptap.shop",
    dates: { start: "2026-08" },
    summary:
      "Custom NFC review cards and tabletop displays that let local businesses collect Google reviews with one tap.",
    short: "NFC review cards",
    highlights: [
      "Built the full e-commerce site in Next.js 16 (App Router), TypeScript and Tailwind CSS v4, deployed on Vercel.",
      "Implemented a React Context + localStorage cart with WhatsApp-based checkout.",
      "Designed a direct-response landing page where the section order is the persuasion sequence.",
    ],
    stack: ["Next.js", "TypeScript", "Tailwind CSS", "React", "Vercel"],
    projectSlug: "zaptap",
  },
  {
    id: "fitness-tech",
    company: "Fitness Tech",
    role: "Software & AI Team Member (AI/ML)",
    // TODO(Alfonso): club website or LinkedIn page
    location: "Seattle, WA",
    dates: { start: "2026-10" },
    summary:
      "Student-led Engineering Student Organization at UW (40+ members, 6 projects) that builds wearable technology to streamline athletic training metrics. Faculty advisor: Prof. Sep Makhsous (ECE).",
    highlights: [
      "Joined the Software & AI team on the AI/ML track.",
      "Working across the full stack of MyFitnessTech, the club's Flutter app on iOS and Android that brings workouts, nutrition, sleep, hydration and biometrics into one profile with an AI coaching layer.",
    ],
    stack: ["Flutter"],
  },
  {
    id: "samla",
    company: "SAMLA",
    role: "Software Engineer",
    dates: { start: "2023-08", end: "2024-01" },
    summary: "Financial web platform for inventory, profitability and payments.",
    highlights: [
      "Built a financial platform with ASP.NET Core MVC and SQL Server: inventory tracking, profit analysis, break-even and ROI/ROCE dashboards.",
      "Integrated secure payments with Stripe and user authentication with role management.",
    ],
    stack: ["C#", "ASP.NET Core MVC", "SQL Server", "Stripe"],
    projectSlug: "samla",
  },
];
