// Alfonso's résumé, as data.
//
// This file is the ONLY place résumé text comes from. The approved base résumé
// (/resume.pdf) is `baseSelection` below; Hire Me Maybe builds tailored résumés by
// choosing entries, bullets and extra skills from these banks by id. The model never
// writes résumé text, so a tailored résumé can't contain anything that isn't here.
//
// Rules for editing:
// - Every bullet must be true and checkable. No invented metrics, dates or roles.
// - `**text**` renders bold.
// - Keep ids stable: the API and its tests refer to them.
// - /resume.pdf is rendered from this file at build time (src/app/resume.pdf/route.ts).

export interface ResumeLink {
  text: string;
  href?: string;
}

export interface ResumeBullet {
  id: string;
  text: string;
}

export interface ResumeExperience {
  id: string;
  title: string;
  org: string;
  orgHref?: string;
  dates: string;
  location: string;
  bullets: ResumeBullet[];
  /** What it's about, for the model's eyes only (never printed). */
  about: string;
}

export interface ResumeProject {
  id: string;
  name: string;
  subtitle: string;
  stack: string;
  right?: string;
  rightHref?: string;
  bullets: ResumeBullet[];
  /** 1 = strongest work in his stack; 5 = generic coursework. Breaks ties and decides what gets cut first. */
  priority: 1 | 2 | 3 | 4 | 5;
  about: string;
}

export interface SkillLine {
  label: string;
  items: string[];
}

export interface ResumeSelection {
  experience: { id: string; bullets: string[] }[];
  projects: { id: string; bullets: string[] }[];
  /** Extra skills from `skillPool`, appended to their line. */
  extraSkills: string[];
}

export const resumeName = "Juan Alfonso Vega Sol";

export const resumeContact: ResumeLink[][] = [
  [
    { text: "Sammamish, WA" },
    { text: "(+1) 425-652-8532", href: "tel:+14256528532" },
    { text: "javs3@uw.edu", href: "mailto:javs3@uw.edu" },
  ],
  [
    { text: "alfonsovegasol.com", href: "https://alfonsovegasol.com" },
    {
      text: "linkedin.com/in/juan-alfonso-vega-sol-752284285",
      href: "https://www.linkedin.com/in/juan-alfonso-vega-sol-752284285",
    },
    { text: "github.com/Alfonso3435", href: "https://github.com/Alfonso3435" },
  ],
];

/** Education never changes between résumés. */
export const resumeEducation = [
  {
    school: "University of Washington",
    detail: "B.S. Computer Science, Paul G. Allen School",
    dates: "09 2026 - 06 2028",
    lines: [
      {
        label: "Coursework",
        text: "Data Structures & Parallelism, Hardware/Software Interface, Foundations of Computing, Systems Programming, Software Design & Implementation",
      },
    ],
  },
  {
    school: "Tecnológico de Monterrey",
    detail: "B.S. Computer Science and Technology",
    dates: "08 2023 - 06 2026",
    lines: [
      {
        label: "Coursework",
        text: "Data Structures and Algorithms, Operating Systems, Computer Networks, Databases, Computer Architecture, Object-Oriented Programming, Machine Learning",
      },
      {
        label: "Certifications",
        text: "Machine Learning Specialization (Stanford / DeepLearning.AI); Deep Learning Specialization (DeepLearning.AI)",
      },
    ],
  },
];

/** The skills on every résumé. */
export const resumeSkills: SkillLine[] = [
  { label: "Programming Languages", items: ["Python", "C++", "C", "C#", "Java", "JavaScript", "TypeScript", "SQL", "HTML/CSS"] },
  {
    label: "Machine Learning & AI",
    items: [
      "PyTorch", "TensorFlow", "Keras", "Scikit-learn", "NumPy", "Pandas", "Neural Networks", "Deep Learning",
      "Recommender Systems", "Embeddings", "Hyperparameter Tuning", "Feature Engineering", "Vertex AI", "Gemini API",
      "OpenAI API", "Claude API", "TruLens",
    ],
  },
  {
    label: "Full-Stack & Cloud",
    items: [
      "React", "Next.js", "Node.js", "ASP.NET Core MVC", "Flask", "Streamlit", "REST APIs", "Microservices", "AWS (EC2)",
      "Google Cloud", "Vercel", "Supabase", "SQL Server", "MySQL",
    ],
  },
  { label: "Tools", items: ["Git/GitHub", "Visual Studio", "VS Code", "n8n"] },
  { label: "Languages", items: ["Spanish (Native)", "English (Fluent)", "German (Basic)"] },
];

/**
 * Skills that are real (each is used in a project or job below) but only earn a spot
 * when a posting asks for them. Keyed by the line they join.
 */
export const skillPool: Record<string, string[]> = {
  "Machine Learning & AI": [
    "Large Language Models (LLMs)", "Transformers", "NLP", "Computer Vision", "Retrieval-Augmented Generation (RAG)",
    "Prompt Engineering", "Structured Outputs", "AI Agents", "LangChain", "Hugging Face", "ChromaDB", "NLTK", "OpenCV",
  ],
  "Full-Stack & Cloud": ["Tailwind CSS", "Web Workers", "Stripe", "Webhooks", "Airtable", "GoHighLevel"],
};

export const experienceBank: ResumeExperience[] = [
  {
    id: "answr",
    title: "Founder & Software Engineer",
    org: "Answr",
    orgHref: "https://answr.info",
    dates: "Late 2025 - Present",
    location: "Bellevue, WA",
    about: "AI automation agency for local service businesses: voice/SMS AI agents, LLM workflows, n8n, Supabase, Claude API, Next.js.",
    bullets: [
      {
        id: "answr-voice",
        text: "Built an AI voice and SMS agent that answers missed calls for local service businesses, cutting first-response time from hours to under 30 seconds and recovering leads that were previously lost.",
      },
      {
        id: "answr-automation",
        text: "Architected an event-driven automation stack on n8n, Supabase and the Claude API, orchestrating 20+ webhook-triggered workflows across lead capture, qualification, booking and follow-up.",
      },
      {
        id: "answr-json",
        text: "Engineered a structured-JSON prompting layer with input sanitization and a post-booking state lock, eliminating malformed responses and duplicate outreach across the conversation pipeline.",
      },
      {
        id: "answr-site",
        text: "Designed and deployed the client-facing product site and interactive demo in Next.js on Vercel, plus a two-tier plan architecture and a repeatable onboarding checklist for new accounts.",
      },
      {
        id: "answr-integrations",
        text: "Integrated the automation workflows with GoHighLevel CRM and Airtable through webhooks, debugging the integrations end to end.",
      },
    ],
  },
  {
    id: "zaptap",
    title: "Founder",
    org: "ZapTap",
    orgHref: "https://zaptap.shop",
    dates: "Aug 2026 - Present",
    // TODO(Alfonso): location for ZapTap
    location: "",
    about: "Business selling custom NFC review cards; built its e-commerce site in Next.js, TypeScript, Tailwind CSS. Optional entry for front-end/full-stack roles.",
    bullets: [
      {
        id: "zaptap-site",
        text: "Built and launched zaptap.shop, an e-commerce site for custom NFC review cards, with Next.js 16 (App Router), TypeScript and Tailwind CSS v4 on Vercel.",
      },
      {
        id: "zaptap-cart",
        text: "Implemented a persistent shopping cart with React Context and localStorage and a WhatsApp-based checkout that generates pre-filled orders.",
      },
    ],
  },
  {
    id: "thinkcity",
    title: "Computer Vision Developer & Presenter",
    org: "ThinkCity 2026 Smart City Hackathon",
    dates: "2026",
    location: "Bellevue, WA",
    about: "Hackathon award: SkySAR drone-swarm search and rescue, computer vision with Gemini Vision, real-time dashboard, presenting.",
    bullets: [
      {
        id: "thinkcity-award",
        text: "Won the **Community Impact Award** with SkySAR, a drone-swarm search-and-rescue concept, building a Gemini Vision pipeline that flags people, vehicles and smoke on a real-time dashboard.",
      },
      {
        id: "thinkcity-team",
        text: "Presented the solution to judges as developer and presenter in a six-person international, interdisciplinary team.",
      },
    ],
  },
  {
    id: "hackmx",
    title: "Computer Vision & AI Developer",
    org: "El Puerto de Liverpool AI Challenge, HackMX 6th Edition",
    dates: "2025",
    location: "Mexico City, Mexico",
    about: "Hackathon 1st place: IdentifEye visual product search, image embeddings, Vertex AI, vector storage, concurrency, LLM recommendations.",
    bullets: [
      {
        id: "hackmx-win",
        text: "Won **1st place** in Liverpool's challenge at a hackathon of **100+ teams** with IdentifEye, a visual product search that matches customer photos to the retailer's catalog with LLM-powered recommendations.",
      },
      {
        id: "hackmx-storage",
        text: "Built live embedding storage in a database, **optimized by 94% with concurrency and parallelism**, plus Vertex AI embedding search with deduplication.",
      },
      {
        id: "hackmx-cv",
        text: "Owned the computer vision components, matching product photos to catalog items with image embeddings using OpenCV, Pillow and Google Cloud Vision.",
      },
    ],
  },
  {
    id: "atrato",
    title: "LLM Application Developer",
    org: "Atrato Financial Hackathon, 1st Edition",
    dates: "2024",
    location: "Mexico City, Mexico",
    about: "Hackathon 1st place: FinanceAI LLM assistant, OpenAI API, LangChain, Hugging Face, embedding caching, security, LLM evaluation with TruLens.",
    bullets: [
      {
        id: "atrato-win",
        text: "Won **1st place** with FinanceAI, an LLM assistant that answers questions and routes users to the right in-house expert.",
      },
      {
        id: "atrato-cost",
        text: "Cut inference cost via embedding caching; added SQL-injection protection, hate-speech filtering and TruLens evaluation.",
      },
      {
        id: "atrato-stack",
        text: "Built the assistant with the OpenAI API, LangChain and Hugging Face, deployed on Streamlit Cloud.",
      },
    ],
  },
];

export const projectBank: ResumeProject[] = [
  {
    id: "ask-alfonso",
    name: "Ask Alfonso",
    subtitle: "Language Model Built from Scratch",
    stack: "Python, PyTorch, TypeScript",
    right: "alfonsovegasol.com/ask",
    rightHref: "https://alfonsovegasol.com/ask",
    priority: 1,
    about: "His flagship: decoder-only transformer, BPE tokenizer, training, TF-IDF retrieval, guardrails, evaluation, browser deployment.",
    bullets: [
      {
        id: "ask-model",
        text: "Designed and trained a 3.9M-parameter decoder-only transformer from scratch in PyTorch (BPE tokenizer, causal multi-head attention, training loop), pretrained on WikiText-2 and fine-tuned on 4,497 Q&A examples.",
      },
      {
        id: "ask-results",
        text: "Grounded answers with from-scratch TF-IDF retrieval (99% recall@3) and guardrails that verify every name, date and number: **78.1% exact match on 254 unseen questions, 0 fabricated facts**.",
      },
      {
        id: "ask-data",
        text: "Lifted accuracy on rephrased questions from 62.7% to 75.5% with a paraphrase-generation pipeline after a 3× larger model scored lower.",
      },
      {
        id: "ask-deploy",
        text: "Ported inference to TypeScript with a KV cache in a Web Worker: 7.7 MB of weights, $0 to serve, answers identical to PyTorch on 86 reference questions.",
      },
    ],
  },
  {
    id: "portfolio",
    name: "alfonsovegasol.com",
    subtitle: "Portfolio Platform",
    stack: "Next.js, TypeScript, Tailwind CSS, Claude API",
    right: "alfonsovegasol.com",
    rightHref: "https://alfonsovegasol.com",
    priority: 2,
    about: "His portfolio site: Next.js App Router, typed data, static generation, and Hire Me Maybe (Claude API structured outputs that tailor this résumé from approved content).",
    bullets: [
      {
        id: "portfolio-site",
        text: "Built a Next.js and TypeScript portfolio where one set of typed data files generates every page, the chatbot's knowledge base and this résumé.",
      },
      {
        id: "portfolio-hmm",
        text: "Built Hire Me Maybe, which tailors this résumé to a job posting with the Claude API and structured outputs, selecting only pre-approved content.",
      },
    ],
  },
  {
    id: "can-ai-spot-a-lie",
    name: "Can AI Spot a Lie?",
    subtitle: "Explainable Fake-News Classifier",
    stack: "Python, Scikit-learn, NLTK, Streamlit",
    priority: 2,
    about: "NLP text classification: TF-IDF, logistic regression, preprocessing, model evaluation dashboard, presented at a college showcase.",
    bullets: [
      {
        id: "lie-main",
        text: "Classified 44,000+ labeled articles with NLTK preprocessing, TF-IDF and logistic regression, with a dashboard for precision, recall, F1 and the most influential words; presented at Bellevue College's Making Learning Visible.",
      },
    ],
  },
  {
    id: "myfitnesstech",
    name: "MyFitnessTech",
    subtitle: "All-in-One Fitness App, Fitness Tech at UW",
    stack: "Flutter, Full-Stack, AI",
    right: "Oct 2026 - Present",
    priority: 3,
    about: "In progress (student org): full-stack redesign of a fitness app, AI features like receipt scanning and weekly AI summaries.",
    bullets: [
      {
        id: "fit-stack",
        text: "Redesigning the app's full stack to unify workouts, nutrition, sleep, hydration and friend rankings in one profile.",
      },
      {
        id: "fit-ai",
        text: "Developing AI features: grocery-receipt scanning with goal-based recommendations and AI weekly progress summaries.",
      },
    ],
  },
  {
    id: "pdf-chatbot",
    name: "PDF Chatbot",
    subtitle: "Retrieval-Augmented Generation",
    stack: "LangChain, Hugging Face, ChromaDB, PyTorch",
    priority: 3,
    about: "RAG over PDFs: chunking, sentence embeddings, vector search, conversational memory.",
    bullets: [
      {
        id: "pdf-rag",
        text: "Built a RAG chatbot over PDF documents with chunking, Hugging Face sentence embeddings in ChromaDB vector search, conversational memory and a Streamlit UI.",
      },
    ],
  },
  {
    id: "samla",
    name: "Samla",
    subtitle: "Financial Web Platform",
    stack: "ASP.NET Core MVC, SQL Server, Stripe",
    priority: 3,
    about: "Full-stack C# web app: inventory, financial analytics dashboards, payments, role-based authentication, SQL Server.",
    bullets: [
      {
        id: "samla-main",
        text: "Built a financial platform with inventory, break-even and ROI/ROCE analytics, Stripe payments and role-based auth.",
      },
    ],
  },
  {
    id: "csv-chatbot",
    name: "CSV Chatbot",
    subtitle: "LLM Data Agent",
    stack: "LangChain, OpenAI API, Pandas, Streamlit",
    priority: 4,
    about: "LLM agent that answers plain-English questions about CSV data with Pandas.",
    bullets: [
      {
        id: "csv-agent",
        text: "Built a LangChain agent with GPT-4 that answers plain-English questions about any uploaded CSV by manipulating Pandas dataframes.",
      },
    ],
  },
  {
    id: "ml-fundamentals",
    name: "Machine Learning Fundamentals Showcase",
    subtitle: "Coursework Projects",
    stack: "Python, NumPy, TensorFlow, Streamlit",
    priority: 5,
    about: "Generic ML fundamentals: logistic regression from scratch, MNIST classifier, collaborative-filtering recommender.",
    bullets: [
      {
        id: "mlf-main",
        text: "Implemented logistic regression from scratch for heart-disease risk, an MNIST neural-network classifier and a collaborative-filtering recommender in a Streamlit app.",
      },
    ],
  },
];

/** The approved base résumé (/resume.pdf). Partial matches get exactly this. */
export const baseSelection: ResumeSelection = {
  experience: [
    { id: "answr", bullets: ["answr-voice", "answr-automation", "answr-json"] },
    { id: "thinkcity", bullets: ["thinkcity-award"] },
    { id: "hackmx", bullets: ["hackmx-win", "hackmx-storage"] },
    { id: "atrato", bullets: ["atrato-win", "atrato-cost"] },
  ],
  projects: [
    { id: "ask-alfonso", bullets: ["ask-model", "ask-results"] },
    { id: "can-ai-spot-a-lie", bullets: ["lie-main"] },
    { id: "myfitnesstech", bullets: ["fit-stack", "fit-ai"] },
  ],
  extraSkills: [],
};
