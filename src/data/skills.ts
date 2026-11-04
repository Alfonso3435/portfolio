import type { SkillGroup } from "@/lib/types";

// Every skill points at the projects that prove it (slugs from projects.ts).
// An empty list means the skill comes from coursework, not a project yet.
// `aliases` are other names visitors type; Ask Alfonso maps them to the real name.
export const skillGroups: SkillGroup[] = [
  {
    name: "Machine Learning & Deep Learning",
    aliases: ["machine learning", "deep learning", "ML", "AI", "artificial intelligence"],
    skills: [
      { name: "TensorFlow / Keras", projectSlugs: ["ml-playground"] },
      { name: "scikit-learn", projectSlugs: ["can-ai-spot-a-lie", "identifeye", "ml-playground"], aliases: ["sklearn"] },
      { name: "NumPy", projectSlugs: ["ml-playground", "can-ai-spot-a-lie", "ask-alfonso"] },
      { name: "Pandas", projectSlugs: ["can-ai-spot-a-lie", "ml-playground", "csv-chatbot"] },
      { name: "Neural networks", projectSlugs: ["ml-playground"] },
      { name: "Recommender systems", projectSlugs: ["ml-playground"] },
      { name: "NLP (TF-IDF, NLTK)", projectSlugs: ["can-ai-spot-a-lie", "ask-alfonso"], aliases: ["natural language processing"] },
      { name: "Computer vision", projectSlugs: ["identifeye", "skysar"] },
      { name: "PyTorch", projectSlugs: ["pdf-chatbot", "ask-alfonso"], aliases: ["Torch"] },
    ],
  },
  {
    name: "LLM Applications",
    aliases: ["LLM", "LLMs", "large language models", "generative AI", "GenAI"],
    skills: [
      { name: "Claude API", projectSlugs: ["answr"], aliases: ["Claude", "Anthropic API"] },
      { name: "OpenAI API", projectSlugs: ["identifeye", "financeai", "pdf-chatbot", "csv-chatbot", "blockcity"], aliases: ["OpenAI", "GPT API", "ChatGPT API"] },
      { name: "Gemini Vision", projectSlugs: ["skysar"], aliases: ["Gemini", "Google Gemini"] },
      { name: "LangChain", projectSlugs: ["financeai", "pdf-chatbot", "csv-chatbot"] },
      { name: "RAG", projectSlugs: ["pdf-chatbot"], aliases: ["retrieval-augmented generation"] },
      { name: "Embeddings & vector search", projectSlugs: ["identifeye", "financeai", "pdf-chatbot"], aliases: ["vector databases", "semantic search"] },
      { name: "Prompt engineering & structured outputs", projectSlugs: ["answr"] },
      { name: "LLM evaluation (TruLens)", projectSlugs: ["financeai"] },
      { name: "Hugging Face", projectSlugs: ["financeai", "pdf-chatbot"], aliases: ["HuggingFace"] },
    ],
  },
  {
    name: "Full-Stack Development",
    aliases: ["full stack", "web development", "frontend", "front end", "backend", "back end"],
    skills: [
      { name: "Next.js", projectSlugs: ["answr", "zaptap"], aliases: ["NextJS"] },
      { name: "React", projectSlugs: ["identifeye", "zaptap"], aliases: ["ReactJS", "React.js"] },
      { name: "TypeScript", projectSlugs: ["zaptap"] },
      { name: "Tailwind CSS", projectSlugs: ["zaptap"], aliases: ["Tailwind"] },
      { name: "Node.js", projectSlugs: ["blockcity"], aliases: ["NodeJS", "Node"] },
      { name: "ASP.NET Core MVC", projectSlugs: ["samla"], aliases: ["ASP.NET Core", "ASP.NET", ".NET Core", ".NET"] },
      { name: "Flask", projectSlugs: ["identifeye"] },
      { name: "Streamlit", projectSlugs: ["can-ai-spot-a-lie", "ml-playground", "financeai", "pdf-chatbot", "csv-chatbot", "ambient-detectors"] },
      { name: "Stripe", projectSlugs: ["samla"] },
    ],
  },
  {
    name: "Cloud, Data & Automation",
    aliases: ["cloud", "databases", "automation", "DevOps"],
    skills: [
      { name: "Google Cloud (Vertex AI, Cloud Run)", projectSlugs: ["identifeye"], aliases: ["GCP", "Google Cloud Platform"] },
      { name: "AWS (Lambda, API Gateway, RDS, S3)", projectSlugs: ["blockcity"], aliases: ["Amazon Web Services"] },
      { name: "Vercel", projectSlugs: ["answr", "zaptap"] },
      { name: "Firebase", projectSlugs: ["identifeye"] },
      { name: "Supabase", projectSlugs: ["answr"] },
      { name: "SQL Server", projectSlugs: ["samla"], aliases: ["MSSQL", "Microsoft SQL Server"] },
      { name: "MySQL", projectSlugs: ["blockcity", "ambient-detectors"] },
      { name: "n8n & webhooks", projectSlugs: ["answr"] },
      { name: "GitHub Actions (CI/CD)", projectSlugs: ["blockcity"] },
    ],
  },
  {
    name: "Languages",
    aliases: ["programming languages", "coding languages"],
    skills: [
      {
        name: "Python",
        projectSlugs: [
          "can-ai-spot-a-lie",
          "ml-playground",
          "identifeye",
          "skysar",
          "financeai",
          "pdf-chatbot",
          "csv-chatbot",
          "ambient-detectors",
          "ask-alfonso",
        ],
      },
      { name: "TypeScript / JavaScript", projectSlugs: ["zaptap", "answr", "blockcity"], aliases: ["JS", "TS"] },
      { name: "C#", projectSlugs: ["samla", "blockcity"] },
      { name: "C / C++", projectSlugs: ["ambient-detectors"], aliases: ["CPP"] },
      { name: "SQL", projectSlugs: ["samla", "blockcity", "ambient-detectors"] },
      { name: "Java", projectSlugs: [] },
      { name: "PHP", projectSlugs: ["ambient-detectors"] },
    ],
  },
  {
    name: "Hardware & Game Dev",
    aliases: ["hardware", "IoT", "embedded", "game development"],
    skills: [
      { name: "ESP32 / Arduino", projectSlugs: ["ambient-detectors"] },
      { name: "Onshape (3D design)", projectSlugs: ["ambient-detectors"] },
      { name: "Unity", projectSlugs: ["blockcity"] },
    ],
  },
];
