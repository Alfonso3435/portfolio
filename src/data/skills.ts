import type { SkillGroup } from "@/lib/types";

// Every skill points at the projects that prove it (slugs from projects.ts).
// An empty list means the skill comes from coursework, not a project yet.
export const skillGroups: SkillGroup[] = [
  {
    name: "Machine Learning & Deep Learning",
    skills: [
      { name: "TensorFlow / Keras", projectSlugs: ["ml-playground"] },
      { name: "scikit-learn", projectSlugs: ["can-ai-spot-a-lie", "identifeye"] },
      { name: "NumPy", projectSlugs: ["ml-playground", "can-ai-spot-a-lie"] },
      { name: "Pandas", projectSlugs: ["can-ai-spot-a-lie", "ml-playground", "csv-chatbot"] },
      { name: "Neural networks", projectSlugs: ["ml-playground"] },
      { name: "Recommender systems", projectSlugs: ["ml-playground"] },
      { name: "NLP (TF-IDF, NLTK)", projectSlugs: ["can-ai-spot-a-lie"] },
      { name: "Computer vision", projectSlugs: ["identifeye", "skysar"] },
      { name: "PyTorch", projectSlugs: ["pdf-chatbot"] },
    ],
  },
  {
    name: "LLM Applications",
    skills: [
      { name: "Claude API", projectSlugs: ["answr"] },
      { name: "OpenAI API", projectSlugs: ["identifeye", "financeai", "pdf-chatbot", "csv-chatbot", "blockcity"] },
      { name: "Gemini Vision", projectSlugs: ["skysar"] },
      { name: "LangChain", projectSlugs: ["financeai", "pdf-chatbot", "csv-chatbot"] },
      { name: "RAG", projectSlugs: ["pdf-chatbot"] },
      { name: "Embeddings & vector search", projectSlugs: ["identifeye", "financeai", "pdf-chatbot"] },
      { name: "Prompt engineering & structured outputs", projectSlugs: ["answr"] },
      { name: "LLM evaluation (TruLens)", projectSlugs: ["financeai"] },
      { name: "Hugging Face", projectSlugs: ["financeai", "pdf-chatbot"] },
    ],
  },
  {
    name: "Full-Stack Development",
    skills: [
      { name: "Next.js", projectSlugs: ["answr", "zaptap"] },
      { name: "React", projectSlugs: ["identifeye", "zaptap"] },
      { name: "TypeScript", projectSlugs: ["zaptap"] },
      { name: "Tailwind CSS", projectSlugs: ["zaptap"] },
      { name: "Node.js", projectSlugs: ["blockcity"] },
      { name: "ASP.NET Core MVC", projectSlugs: ["samla"] },
      { name: "Flask", projectSlugs: ["identifeye"] },
      { name: "Streamlit", projectSlugs: ["can-ai-spot-a-lie", "ml-playground", "financeai", "pdf-chatbot", "csv-chatbot", "ambient-detectors"] },
      { name: "Stripe", projectSlugs: ["samla"] },
    ],
  },
  {
    name: "Cloud, Data & Automation",
    skills: [
      { name: "Google Cloud (Vertex AI, Cloud Run)", projectSlugs: ["identifeye"] },
      { name: "AWS (Lambda, API Gateway, RDS, S3)", projectSlugs: ["blockcity"] },
      { name: "Vercel", projectSlugs: ["answr", "zaptap"] },
      { name: "Firebase", projectSlugs: ["identifeye"] },
      { name: "Supabase", projectSlugs: ["answr"] },
      { name: "SQL Server", projectSlugs: ["samla"] },
      { name: "MySQL", projectSlugs: ["blockcity", "ambient-detectors"] },
      { name: "n8n & webhooks", projectSlugs: ["answr"] },
      { name: "GitHub Actions (CI/CD)", projectSlugs: ["blockcity"] },
    ],
  },
  {
    name: "Languages",
    skills: [
      { name: "Python", projectSlugs: ["can-ai-spot-a-lie", "ml-playground", "identifeye", "skysar", "financeai"] },
      { name: "TypeScript / JavaScript", projectSlugs: ["zaptap", "answr", "blockcity"] },
      { name: "C#", projectSlugs: ["samla", "blockcity"] },
      { name: "C / C++", projectSlugs: ["ambient-detectors"] },
      { name: "SQL", projectSlugs: ["samla", "blockcity", "ambient-detectors"] },
      { name: "Java", projectSlugs: [] },
      { name: "PHP", projectSlugs: ["ambient-detectors"] },
    ],
  },
  {
    name: "Hardware & Game Dev",
    skills: [
      { name: "ESP32 / Arduino", projectSlugs: ["ambient-detectors"] },
      { name: "Onshape (3D design)", projectSlugs: ["ambient-detectors"] },
      { name: "Unity", projectSlugs: ["blockcity"] },
    ],
  },
];
