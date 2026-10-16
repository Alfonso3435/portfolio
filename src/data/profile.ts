import type { Profile } from "@/lib/types";

export const profile: Profile = {
  name: "Juan Alfonso Vega Sol",
  shortName: "Alfonso",
  headline: "AI/ML Engineer & Builder",
  tagline:
    "AI/ML engineer and builder. 2× 1st-place hackathon winner and founder of Answr and ZapTap. I take ideas from model to deployed product.",
  summary:
    "I'm a Computer Science student at the University of Washington's Paul G. Allen School, specializing in AI and machine learning. I've won 1st place at HackMX's Liverpool AI Challenge and Atrato's Financial Hackathon with products built on computer vision, LLMs and embeddings, and I founded Answr and ZapTap, where I ship real software to real customers.",
  location: "Seattle Area, WA",
  email: "ponchovegasol@gmail.com",
  siteUrl: "https://alfonsovegasol.com",
  // TODO(Alfonso): add your resume as public/resume.pdf
  resumeUrl: "/resume.pdf",
  assistantName: "Ask Alfonso",
  links: {
    github: "https://github.com/Alfonso3435",
    linkedin: "https://www.linkedin.com/in/juan-alfonso-vega-sol-752284285/",
  },
  lookingFor: {
    short:
      "Seeking Summer 2027 internships in AI, ML & LLMs · open to software engineering",
    long: "I'm looking for a Summer 2027 internship in AI, ML or LLMs, and I'm also open to software engineering roles.",
  },
  focusAreas: [
    "Machine Learning",
    "Deep Learning",
    "Neural Networks",
    "LLM Applications",
    "Full-Stack Development",
  ],
  spokenLanguages: [
    { language: "Spanish", level: "Native" },
    { language: "English", level: "Fluent" },
    { language: "German", level: "Basic" },
  ],
  education: [
    {
      school: "University of Washington — Paul G. Allen School of Computer Science & Engineering",
      short: "UW Allen School · B.S. CS",
      degree: "B.S. Computer Science",
      location: "Seattle, WA",
      dates: { start: "2026-09" },
      expectedGraduation: "2028-06",
      coursework: [
        "Data Structures & Parallelism",
        "Hardware/Software Interface",
        "Foundations of Computing",
        "Systems Programming",
        "Software Design & Implementation",
      ],
      notes: ["Transferred in Autumn 2026 with credits from Tecnológico de Monterrey and Bellevue College"],
    },
    {
      school: "Bellevue College",
      degree: "AI/ML coursework (non-degree)",
      location: "Bellevue, WA",
      dates: { start: "2025", end: "2026" },
      coursework: [
        "Machine Learning",
        "Supervised & Unsupervised Learning",
        "Optimization",
        "AI for Business",
      ],
      notes: [
        "ThinkCity 2026 Community Impact Award",
        "Presented “Can AI Spot a Lie?” at Making Learning Visible (Dec 2025)",
      ],
    },
    {
      school: "Tecnológico de Monterrey",
      degree: "B.S. Computer Science and Technology (2 years, transferred)",
      location: "Mexico City, Mexico",
      dates: { start: "2023-08", end: "2025-06" },
      gpa: "4.0",
      coursework: [
        "Data Structures and Algorithms",
        "Operating Systems",
        "Computer Networks",
        "Databases",
        "Computer Architecture",
        "Object-Oriented Programming",
        "Machine Learning",
      ],
      notes: ["Academic Talent Scholarship", "1st place at HackMX VI and the Atrato Financial Hackathon"],
    },
  ],
};
