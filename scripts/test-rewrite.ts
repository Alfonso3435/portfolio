// Tests for the query rewriter (src/lib/ask-alfonso/rewrite.ts).
//   npm run test:rewrite
// Cases come from real conversations with the deployed chat.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QueryRewriter } from "../src/lib/ask-alfonso/rewrite";
import type { KnowledgeJson } from "../src/lib/ask-alfonso/types";

const knowledge = JSON.parse(
  readFileSync(join(__dirname, "..", "public", "ask-alfonso", "knowledge.json"), "utf-8"),
) as KnowledgeJson;
const r = new QueryRewriter(knowledge.query);

// [question, previous question (already rewritten) or "", expected rewrite]
const cases: [string, string, string][] = [
  // follow-ups
  ["what about Net Core?", "Does he have any experience with React?", "Does he have any experience with ASP.NET Core MVC?"],
  ["I refer to Asp. Net Core", "Does he have any experience with ASP.NET Core MVC?", "Does he have any experience with ASP.NET Core MVC?"],
  ["and machine learning?", "Does he have any experience with React?", "What are his machine learning & deep learning skills?"],
  ["what about Skysar?", "What did he win at HackMX?", "What is SkySAR?"],
  ["what about ZapTap?", "What is SkySAR?", "What is ZapTap?"],
  ["what about ThinkCity?", "What did he win at HackMX?", "What did he win at ThinkCity?"],
  ["and what did he build at HackMX?", "Does he know React?", "What did he build at HackMX?"],
  ["what about Python?", "", "Does he know Python?"],
  // other names
  ["Does he know .NET?", "", "Does he know ASP.NET Core MVC?"],
  ["Has he used sklearn?", "", "Has he used scikit-learn?"],
  ["Does he know Node.js?", "", "Does he know Node.js?"],
  ["Does he know C#?", "", "Does he know C#?"],
  // bare names
  ["tell me about hackmx", "", "What did he win at HackMX?"],
  ["Tell me about SkySAR", "", "What is SkySAR?"],
  ["Answr?", "", "What is Answr?"],
  // skill groups
  ["What are his AI skills?", "", "What are his machine learning & deep learning skills?"],
  ["Is he good at web development?", "", "What are his full-stack development skills?"],
  // events by other names
  ["when he won the liverpool hackathon?", "", "What did he win at HackMX?"],
  ["Did he win the Atrato hackathon?", "", "What did he win at Atrato?"],
  ["when did he win ThinkCity?", "", "What did he win at ThinkCity?"],
  ["What did he build at the Liverpool hackathon?", "", "What did he build at HackMX?"],
  ["Who was on his team at the Atrato hackathon?", "", "Who was on his team at Atrato?"],
  ["when he won a hackathon?", "", "when he won a hackathon?"],
  // left alone
  ["What is machine learning?", "", "What is machine learning?"], // a definition: off-topic, the model refuses
  ["What is React?", "", "What is React?"],
  ["What did he build at HackMX?", "", "What did he build at HackMX?"],
  ["Does he know PyTorch?", "", "Does he know PyTorch?"],
  ["Tell me a joke.", "", "Tell me a joke."],
  ["Who is Juan Alfonso Vega Sol?", "", "Who is Juan Alfonso Vega Sol?"],
  ["What AI projects has he built?", "", "What AI projects has he built?"],
];

let failed = 0;
for (const [q, prev, expected] of cases) {
  const got = r.rewrite(q, prev || undefined).question;
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${q}${prev ? `  (after: ${prev})` : ""}\n    → ${got}${ok ? "" : `\n    expected: ${expected}`}`);
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
if (failed) process.exit(1);
