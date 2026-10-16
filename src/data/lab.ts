import type { LabStep, LabTool } from "@/lib/types";

// How Ask Alfonso is built. Update `foundation` as you connect steps to coursework.
export const labSteps: LabStep[] = [
  {
    label: "01 · Data",
    title: "Knowledge base",
    description: "A corpus and Q&A set generated from the same data files that build this site.",
  },
  {
    label: "02 · Tokenizer",
    title: "BPE from scratch",
    description: "Character-level first for intuition, then byte-pair-encoding merges.",
  },
  {
    label: "03 · Model",
    title: "Decoder-only transformer",
    description: "Embeddings, causal multi-head self-attention, layer norm, MLP and residual connections.",
    foundation: "Neural Networks and Deep Learning",
  },
  {
    label: "04 · Training",
    title: "Pretrain, then fine-tune",
    description: "Adam, learning-rate warmup and decay, dropout, weight decay and early stopping.",
    foundation: "Improving Deep Neural Networks",
  },
  {
    label: "05 · Grounding",
    title: "TF-IDF retrieval",
    description: "Injects the relevant fact into the context and falls back to “I'm not sure” when confidence is low.",
    foundation: "Can AI Spot a Lie?",
  },
  {
    label: "06 · Evaluation",
    title: "Honest metrics",
    description: "Accuracy on held-out questions, hallucination rate, refusal correctness and latency.",
    foundation: "Structuring Machine Learning Projects",
  },
];

// Interactive tools planned for the Lab. Flip `status` to "live" as each one ships.
export const labTools: LabTool[] = [
  {
    name: "Recruiter Match",
    description:
      "Paste a job description and see my projects and skills ranked by fit, with the evidence for each requirement.",
    builtOn: "TF-IDF from Can AI Spot a Lie?",
    priority: 1,
    status: "planned",
  },
  {
    name: "Tokenizer Playground",
    description: "Type any text and watch my BPE tokenizer split it into tokens, with their IDs.",
    builtOn: "Ask Alfonso's tokenizer",
    priority: 1,
    status: "planned",
  },
  {
    name: "Attention Visualizer",
    description: "Ask a question and see which words each attention head focused on while answering.",
    builtOn: "Ask Alfonso's attention weights",
    priority: 2,
    status: "planned",
  },
  {
    name: "Fake-News Detector",
    description: "Paste a headline and get a real/fake probability plus the words that pushed the prediction.",
    builtOn: "Can AI Spot a Lie?",
    priority: 2,
    status: "planned",
  },
  {
    name: "Draw a Digit",
    description: "Draw a number and my MNIST network classifies it, showing the probability for each digit.",
    builtOn: "Machine Learning Playground",
    priority: 3,
    status: "planned",
  },
  {
    name: "Embedding Explorer",
    description: "A 2D map of my projects and skills as embeddings; pick one to see its nearest neighbors.",
    builtOn: "The recommender in Machine Learning Playground",
    priority: 3,
    status: "planned",
  },
];
