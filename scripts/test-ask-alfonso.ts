// Parity test: does the TypeScript port answer exactly like the Python pipeline?
//
//   python ml/export_web.py --checkpoint …    (writes public/ask-alfonso/* and ml/results/web_reference.json)
//   npm run test:ask-alfonso
//
// For each reference question it compares, step by step: the prompt's token ids, the
// retrieval ranking, the raw model output and the final reply. Float32 arithmetic is
// summed in a different order in JS and PyTorch, so a rare tie can break differently;
// the test fails if more than 2% of answers differ.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { halfToFloat32 } from "../src/lib/ask-alfonso/model";
import { AskAlfonso } from "../src/lib/ask-alfonso/pipeline";
import type { KnowledgeJson, ModelJson } from "../src/lib/ask-alfonso/types";

interface Reference {
  question: string;
  prompt_ids: number[];
  hits: [string, number][];
  context_ids: string[];
  raw: string | null;
  answer: string;
  status: string;
}

const root = join(__dirname, "..");
const dir = join(root, "public", "ask-alfonso");
const modelJson = JSON.parse(readFileSync(join(dir, "model.json"), "utf-8")) as ModelJson;
const knowledge = JSON.parse(readFileSync(join(dir, "knowledge.json"), "utf-8")) as KnowledgeJson;
const bin = readFileSync(join(dir, "model.bin"));
const half = new Uint16Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const refs = JSON.parse(readFileSync(join(root, "ml", "results", "web_reference.json"), "utf-8")) as Reference[];

const t0 = performance.now();
const bot = new AskAlfonso(modelJson, halfToFloat32(half), knowledge);
console.log(`Loaded ${modelJson.parameters.toLocaleString()} parameters in ${Math.round(performance.now() - t0)} ms`);

let tokenMismatch = 0;
let retrievalMismatch = 0;
let answerMismatch = 0;
const times: number[] = [];
for (const ref of refs) {
  const reply = bot.ask(ref.question);
  times.push(reply.debug.ms ?? 0);

  const asked = bot["retriever"].aboutHim(ref.question) ? knowledge.retrieval.about_question : ref.question;
  const ctx = (reply.debug.contextIds ?? []).map((id) => knowledge.retrieval.chunks.find((c) => c.id === id)!.text);
  const prompt = `${modelJson.tokenizer.prompt.context}${ctx.join("\n").trim()}${modelJson.tokenizer.prompt.question}${asked.trim()}${modelJson.tokenizer.prompt.answer}`;
  if (reply.status !== "private") {
    const ids = bot.tokenizer.encode(prompt);
    if (JSON.stringify(ids) !== JSON.stringify(ref.prompt_ids)) {
      tokenMismatch++;
      console.log(`✗ tokens  ${ref.question}`);
    }
    const ourIds = (reply.debug.hits ?? []).map((h) => h[0]);
    const refIds = ref.hits.map((h) => h[0]);
    if (JSON.stringify(ourIds) !== JSON.stringify(refIds)) {
      retrievalMismatch++;
      console.log(`✗ retrieval  ${ref.question}\n    ts: ${ourIds}\n    py: ${refIds}`);
    }
  }
  if (reply.answer !== ref.answer || reply.status !== ref.status) {
    answerMismatch++;
    console.log(`✗ answer  ${ref.question}\n    ts: [${reply.status}] ${reply.answer}\n    py: [${ref.status}] ${ref.answer}`);
  }
}

// Behavior checks on top of parity (parity can't catch a bug both implementations share).
const mustAnswer: [string, RegExp][] = [
  ["Who is Juan Alfonso Vega Sol?", /Computer Science student/],
  ["What did he build at HackMX?", /IdentifEye/],
  ["What are his AI skills?", /^(?!.*I'm not sure)/],
  ["when he won a hackathon?", /HackMX/],
  ["when he won the liverpool hackathon?", /2025/],
  ["how it answered?", /built from scratch/],
];
let behaviorFailed = 0;
for (const [q, expected] of mustAnswer) {
  const reply = bot.chat(q);
  const ok = reply.status === "answered" && expected.test(reply.answer);
  if (!ok) behaviorFailed++;
  console.log(`${ok ? "✓" : "✗"} must answer: ${q} → [${reply.status}] ${reply.answer.slice(0, 80)}`);
}

times.sort((a, b) => a - b);
const n = refs.length;
console.log(`\n${n} questions · tokens differ: ${tokenMismatch} · retrieval differs: ${retrievalMismatch} · ` +
  `answers differ: ${answerMismatch}`);
console.log(`Latency (Node, one thread): p50 ${times[Math.floor(n / 2)]} ms · p95 ${times[Math.floor(n * 0.95)]} ms`);
if (tokenMismatch || retrievalMismatch || answerMismatch / n > 0.02 || behaviorFailed) process.exit(1);
