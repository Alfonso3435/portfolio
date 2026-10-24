import type { Project } from "@/lib/types";

// Order here = order on the Projects page. `featured: true` puts a project on Home.
// Images go in public/projects/<slug>/ (e.g. cover.jpg) — add them to `images` later.
export const projects: Project[] = [
  {
    slug: "identifeye",
    title: "IdentifEye",
    pitch:
      "Snap a photo of any product and get the closest match from Liverpool's catalog, plus LLM-powered recommendations.",
    categories: ["ai-ml", "hackathon"],
    featured: true,
    status: "prototype",
    year: 2025,
    teamSize: 5,
    role: "Computer vision & AI",
    problem:
      "Liverpool asked teams to let customers find a product with nothing but a photo. Text search fails when you don't know what something is called, and the catalog was large and full of near-duplicate images.",
    built: [
      "Image-embedding search on Vertex AI that matches any photo to catalog items.",
      "Recommendations for related products using GPT-4 Vision.",
      "Embedding-based duplicate removal for a catalog of any size.",
      "Concurrent microservices on Google Cloud, so one failure never takes down the web app.",
      "Live embedding storage in a database to optimize resources.",
      "React + Vite front end hosted on Firebase and Google Cloud Run.",
    ],
    stack: ["Vertex AI", "GPT-4 Vision", "OpenCV", "Flask", "React", "Vite", "Google Cloud Run", "Firebase", "scikit-learn"],
    results: [
      "1st place in the El Puerto de Liverpool AI Challenge at HackMX VI, out of 100+ competing teams.",
      "Liverpool publicly congratulated the team on LinkedIn.",
    ],
    awardId: "hackmx-2025",
    images: [
      { src: "/projects/identifeye/cover.webp", alt: "IdentifEye title slide: product identification with embeddings and LLM recommendations, by team HanLovers for Liverpool" },
      { src: "/projects/identifeye/1.webp", alt: "Team HanLovers with their 1st-place prizes at HackMX 6th edition" },
    ],
    videos: [
      { kind: "file", title: "HackMX VI recap, including the winning teams", src: "/projects/identifeye/recap.mp4", poster: "/projects/identifeye/recap-poster.webp", credit: "Video by El Puerto de Liverpool" },
    ],
    links: {
      // TODO(Alfonso): repo URL
    },
  },
  {
    slug: "skysar",
    title: "SkySAR",
    pitch:
      "AI drone-swarm concept for search and rescue that flags people, vehicles and smoke in aerial imagery on a live dashboard.",
    categories: ["ai-ml", "hackathon"],
    featured: true,
    status: "prototype",
    year: 2026,
    teamSize: 6,
    role: "Developer & presenter",
    problem:
      "Search and rescue in forests and national parks is slow and sequential, and often happens in dense terrain without cellular coverage.",
    built: [
      "An intelligence layer that uses Gemini Vision and computer-vision models to detect people, backpacks, vehicles and smoke in aerial imagery.",
      "A real-time, operator-friendly dashboard that prioritizes alerts for rescue coordination.",
      "A swarm design that searches large areas in parallel instead of sequentially.",
      "Ethics by design: data is collected only during active missions, with no continuous surveillance.",
    ],
    stack: ["Python", "Gemini Vision", "Computer vision", "Web dashboard"],
    results: ["Community Impact Award at the ThinkCity 2026 Smart City Hackathon, representing Bellevue College."],
    awardId: "thinkcity-2026",
    images: [
      { src: "/projects/skysar/cover.webp", alt: "SkySAR title slide: AI swarm drone search and rescue" },
      { src: "/projects/skysar/1.webp", alt: "SkySAR mission panel detecting three people on a forest trail, with a confidence and urgency log" },
      { src: "/projects/skysar/2.webp", alt: "SkySAR business model and a comparison with traditional search and rescue" },
      { src: "/projects/skysar/3.webp", alt: "The SkySAR team celebrating the Community Impact Award at ThinkCity 2026" },
    ],
    links: {},
  },
  {
    slug: "answr",
    title: "Answr AI Agent",
    pitch:
      "Voice and SMS agent that texts back missed calls and books appointments, cutting first response from hours to under 30 seconds.",
    categories: ["ai-ml", "full-stack"],
    featured: true,
    status: "shipped",
    year: 2025,
    role: "Founder & software engineer",
    problem:
      "Local service businesses like plumbers, HVAC companies, dentists and salons lose customers every time they miss a call.",
    built: [
      "An AI voice/SMS agent with missed-call text-back, AI conversation and appointment booking.",
      "20+ webhook-triggered automation workflows on n8n, Supabase and the Claude API, integrated with GoHighLevel and Airtable.",
      "A structured-JSON prompting layer with input sanitization and a post-booking state lock.",
      "Starter and Growth plan workflows, plus the client-facing site and interactive demo in Next.js.",
    ],
    stack: ["Claude API", "n8n", "Supabase", "Next.js", "Vercel", "GoHighLevel", "Airtable"],
    results: [
      "First response to missed calls went from hours to under 30 seconds.",
      "Eliminated malformed responses and duplicate outreach in the conversation pipeline.",
    ],
    images: [
      { src: "/projects/answr/cover.webp", alt: "Answr landing page: “Stop losing customers to missed calls”, next to a sample SMS conversation" },
      { src: "/projects/answr/1.webp", alt: "Answr interactive demo: a missed call becomes an SMS conversation, a booked appointment and a lead in the pipeline" },
    ],
    links: { site: "https://answr.info" },
  },
  {
    slug: "can-ai-spot-a-lie",
    title: "Can AI Spot a Lie?",
    pitch:
      "Fake-news classifier trained on 44,000+ labeled articles, with a dashboard of its metrics and the words behind each prediction.",
    categories: ["ai-ml"],
    featured: true,
    status: "shipped",
    year: 2025,
    teamSize: 1,
    role: "Solo project",
    problem:
      "Misinformation spreads through emotional language, sensationalism and missing sources. Can a simple, explainable model catch those patterns?",
    built: [
      "A text pipeline: cleaning, stopword removal and lemmatization with NLTK.",
      "TF-IDF features (unigrams + bigrams) and a Logistic Regression classifier trained on the Kaggle Fake and Real News dataset.",
      "A multi-page Streamlit dashboard with accuracy, precision, recall, F1, a confusion matrix and the most influential words per class.",
      "In-app model retraining from the sidebar.",
    ],
    stack: ["Python", "scikit-learn", "NLTK", "Pandas", "NumPy", "Matplotlib", "Seaborn", "Streamlit"],
    results: ["Presented at Making Learning Visible, Bellevue College's college-wide showcase (Dec 2025)."],
    awardId: "mlv-2025",
    images: [
      { src: "/projects/can-ai-spot-a-lie/cover.webp", alt: "Can AI Spot a Lie? home page: the algorithm vs. the clickbait crisis", position: "top" },
      { src: "/projects/can-ai-spot-a-lie/1.webp", alt: "Top words that predict fake and real news, and a test article classified as fake" },
      { src: "/projects/can-ai-spot-a-lie/2.webp", alt: "The “Can AI Spot a Lie?” poster and live demo at Making Learning Visible, Bellevue College" },
    ],
    links: {
      // TODO(Alfonso): repo URL
    },
  },
  {
    slug: "ask-alfonso",
    title: "Ask Alfonso",
    pitch:
      "A small language model built from scratch (BPE tokenizer, decoder-only transformer and retrieval) that answers questions about my work.",
    categories: ["ai-ml"],
    featured: false,
    status: "in-progress",
    year: 2026,
    teamSize: 1,
    role: "Solo project",
    problem:
      "Recruiters have specific questions. A chatbot can answer them, but only if it never makes things up.",
    built: [
      "A byte-pair-encoding tokenizer written from scratch.",
      "A decoder-only transformer: embeddings, causal multi-head self-attention, layer norm, MLP and residuals.",
      "TF-IDF retrieval that grounds every answer in this site's data, with a fallback when confidence is low.",
    ],
    stack: ["Python", "PyTorch", "NumPy", "TF-IDF"],
    links: {},
  },
  {
    slug: "financeai",
    title: "FinanceAI",
    pitch:
      "AI assistant that answers questions about financial products and routes users to the right expert, with embedding-based cost optimization.",
    categories: ["ai-ml", "hackathon"],
    featured: false,
    status: "prototype",
    year: 2024,
    teamSize: 4,
    // TODO(Alfonso): your specific role in the team
    role: "Team member",
    problem:
      "Atrato wanted an AI virtual assistant that automates workflows by answering customer questions about its financial products.",
    built: [
      "A question-answering assistant that also matches users to the right problem-solver from an uploaded employee database.",
      "Real-time API cost metrics, with costs reduced through embeddings and vectorized datasets.",
      "SQL-injection prevention on prompt input and hate-speech filtering on LLM output.",
      "A TruLens feedback loop to evaluate and improve answers.",
      "A responsive Streamlit app with light/dark mode, deployed on Streamlit Cloud.",
    ],
    stack: ["OpenAI API", "LangChain", "Hugging Face", "TruLens", "Streamlit"],
    results: ["1st place at Atrato's Financial Hackathon, 1st Edition."],
    awardId: "atrato-2024",
    images: [
      { src: "/projects/financeai/cover.webp", alt: "FinancialAI title slide by team Silly Ducks for the Atrato Financial Hackathon" },
      { src: "/projects/financeai/1.webp", alt: "FinanceAI answering a question about personal loans from an uploaded document, with live API cost metrics" },
      { src: "/projects/financeai/2.webp", alt: "Announcement of team Silly Ducks as the hackathon winners" },
    ],
    links: {},
  },
  {
    slug: "ml-playground",
    title: "Machine Learning Playground",
    pitch:
      "Logistic regression from scratch, an MNIST neural network and a collaborative-filtering recommender in one interactive app.",
    categories: ["ai-ml"],
    featured: false,
    status: "shipped",
    year: 2025,
    teamSize: 1,
    role: "Solo project",
    problem:
      "After Andrew Ng's Machine Learning Specialization, I wanted to prove I could implement the core ideas myself, not just pass the quizzes.",
    built: [
      "Logistic regression from scratch in NumPy, predicting heart-disease risk on the Framingham Heart Study dataset.",
      "An MNIST digit classifier in TensorFlow/Keras with training progress and sample predictions.",
      "A recommender system using user and movie embeddings in a neural network (collaborative filtering).",
    ],
    results: ["The MNIST classifier reached 97.33% test accuracy after 10 epochs."],
    stack: ["Python", "NumPy", "Pandas", "TensorFlow/Keras", "scikit-learn", "Matplotlib", "Streamlit"],
    images: [
      { src: "/projects/ml-playground/cover.webp", alt: "MNIST classifier evaluation: test accuracy, loss and accuracy curves, and sample predictions", position: "top" },
      { src: "/projects/ml-playground/1.webp", alt: "Recommender module: MovieLens-style ratings and the top recommended movies for a user" },
    ],
    links: {},
  },
  {
    slug: "pdf-chatbot",
    title: "PDF Chatbot (RAG)",
    pitch:
      "Chat with any PDF: smart chunking, sentence embeddings, ChromaDB vector search and conversational memory.",
    categories: ["ai-ml"],
    featured: false,
    status: "shipped",
    role: "Developer",
    problem: "Long documents are hard to search. Retrieval-augmented generation lets you ask them questions instead.",
    built: [
      "PDF text extraction and smart chunking.",
      "Hugging Face sentence embeddings stored in ChromaDB for vector search.",
      "Conversational memory and a Streamlit UI, with automatic CUDA/CPU handling in PyTorch.",
    ],
    stack: ["Python", "LangChain", "OpenAI API", "Hugging Face", "ChromaDB", "PyTorch", "Streamlit"],
    links: {},
  },
  {
    slug: "csv-chatbot",
    title: "CSV Chatbot",
    pitch: "Upload a CSV and ask questions in plain English; a LangChain agent runs the Pandas queries.",
    categories: ["ai-ml"],
    featured: false,
    status: "shipped",
    role: "Developer",
    problem: "Not everyone can write Pandas code to explore a dataset.",
    built: [
      "A LangChain agent powered by GPT-4 with full Pandas DataFrame manipulation.",
      "A Streamlit UI with one-command setup.",
    ],
    stack: ["Python", "LangChain", "GPT-4", "Pandas", "Streamlit"],
    links: {},
  },
  {
    slug: "zaptap",
    title: "ZapTap",
    pitch: "E-commerce site for NFC review cards, with a React Context cart and WhatsApp checkout.",
    categories: ["full-stack"],
    featured: false,
    status: "shipped",
    year: 2026,
    role: "Founder & developer",
    problem: "Local businesses need more Google reviews, and asking customers to search and type is too much friction.",
    built: [
      "The full site in Next.js 16 (App Router), TypeScript and Tailwind CSS v4.",
      "A React Context + localStorage cart and WhatsApp checkout with a pre-filled order message.",
      "A catalog in typed data files and a short, search-focused landing page for Google review cards.",
    ],
    stack: ["Next.js", "TypeScript", "Tailwind CSS", "React", "Vercel"],
    images: [
      { src: "/projects/zaptap/cover.webp", alt: "ZapTap landing page: “Your happy customers meant to leave you a review.”" },
    ],
    videos: [
      { kind: "file", title: "Tapping a phone on a ZapTap card opens the Google review page", src: "/projects/zaptap/demo.mp4", poster: "/projects/zaptap/demo-poster.webp", loop: true },
    ],
    links: { site: "https://zaptap.shop" },
  },
  {
    slug: "samla",
    title: "SAMLA Financial Platform",
    pitch:
      "Financial platform with inventory, break-even and ROI/ROCE analytics, Stripe payments and role-based auth.",
    categories: ["full-stack"],
    featured: false,
    status: "shipped",
    year: 2023,
    role: "Software engineer",
    problem: "The business needed one place to track inventory, profitability and payments.",
    built: [
      "Inventory tracking and profit analysis with break-even, ROI and ROCE metrics.",
      "Dynamic dashboards.",
      "Secure payments with Stripe and user authentication with role management.",
    ],
    stack: ["C#", "ASP.NET Core MVC", "SQL Server", "Stripe"],
    images: [
      { src: "/projects/samla/cover.webp", alt: "SAMLA financial dashboard with income, costs, balance, cost categories and transactions" },
      { src: "/projects/samla/1.webp", alt: "SAMLA sign-in page" },
    ],
    links: {},
  },
  {
    slug: "blockcity",
    title: "BlockCity",
    pitch:
      "Unity game that teaches blockchain, AI and Web3, plus a companion site with an OpenAI-powered assistant.",
    categories: ["full-stack"],
    featured: false,
    status: "shipped",
    teamSize: 5,
    role: "Developer",
    problem: "Blockchain, AI and Web3 concepts are hard to learn from text alone.",
    built: [
      "A Unity (C#) game with thematic modules, quizzes, mini-games, rewards, cloud save and login.",
      "A companion website with a progress dashboard, profile management and an OpenAI-powered assistant.",
      "A serverless backend: Node.js on AWS Lambda + API Gateway, MySQL on AWS RDS, static hosting on S3.",
      "JWT auth with password encryption, CI/CD with GitHub Actions and unit tests with MSTest.",
    ],
    stack: ["Unity", "C#", "Node.js", "AWS Lambda", "API Gateway", "MySQL", "AWS RDS", "S3", "GitHub Actions", "OpenAI API"],
    images: [
      { src: "/projects/blockcity/cover.webp", alt: "BlockCity Module 1: a pixel-art city map with levels and stars" },
      { src: "/projects/blockcity/1.webp", alt: "Module selection screen with locked and unlocked cities" },
      { src: "/projects/blockcity/2.webp", alt: "Admin dashboard with registered users, users per nationality and progress per module" },
      { src: "/projects/blockcity/3.webp", alt: "The OpenAI-powered assistant suggesting user-retention strategies by country" },
    ],
    videos: [
      { kind: "youtube", title: "BlockCity demo", youtubeId: "BZy_tlWKUmU" },
    ],
    links: { video: "https://youtu.be/BZy_tlWKUmU" },
  },
  {
    slug: "ambient-detectors",
    title: "Ambient-Detectors",
    pitch:
      "ESP32 device that streams temperature, humidity, CO₂, air quality and light into a live dashboard with alerts.",
    categories: ["iot"],
    featured: false,
    status: "shipped",
    teamSize: 2,
    role: "Developer",
    problem: "Indoor air quality and comfort are invisible until something is already wrong.",
    built: [
      "An ESP32-WROOM device with DHT11, MQ135, BH1750 and SCD30 sensors in a 3D-printed enclosure designed in Onshape.",
      "Arduino (C++) firmware sending readings over WiFi (HTTP POST) and I2C.",
      "A PHP API and MySQL database, plus a Streamlit dashboard with historical graphs and configurable alerts.",
    ],
    stack: ["ESP32", "C++", "PHP", "MySQL", "Python", "Streamlit", "Onshape"],
    images: [
      { src: "/projects/ambient-detectors/cover.webp", alt: "Ambient-Detectors Streamlit app: welcome screen, live station status and historical datasets" },
      { src: "/projects/ambient-detectors/1.webp", alt: "Architecture: DHT11, MQ135 and BH1750 sensors feed an ESP32 that posts to a PHP API and SQL database, visualized in Streamlit" },
    ],
    videos: [
      { kind: "youtube", title: "Ambient-Detectors demo", youtubeId: "H2oz0zqGWlA" },
    ],
    links: { video: "https://youtu.be/H2oz0zqGWlA" },
  },
];
