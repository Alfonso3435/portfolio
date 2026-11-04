/// <reference lib="webworker" />
// Runs Ask Alfonso off the main thread. A forward pass takes ~0.5–2 s of pure math;
// doing it here keeps the page scrolling and typing smoothly while the model "thinks".

import { halfToFloat32 } from "./model";
import { AskAlfonso } from "./pipeline";
import type { KnowledgeJson, ModelJson } from "./types";

export type WorkerRequest = { type: "load"; base: string } | { type: "ask"; id: number; question: string };

export type WorkerResponse =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready"; parameters: number }
  | { type: "answer"; id: number; reply: import("./types").Reply }
  | { type: "error"; id?: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let bot: Promise<AskAlfonso> | null = null;

const post = (message: WorkerResponse) => ctx.postMessage(message);

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-cache" }); // revalidate (ETag), so a new export is picked up
  if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status})`);
  return (await res.json()) as T;
}

/** Download model.bin with progress (it's the only big file: ~7.7 MB, once, then cached). */
async function fetchWeights(url: string, expectedBytes: number): Promise<Uint16Array> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok || !res.body) throw new Error(`Couldn't load ${url} (${res.status})`);
  const total = Number(res.headers.get("content-length")) || expectedBytes;
  const reader = res.body.getReader();
  const buffer = new Uint8Array(expectedBytes);
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer.set(value, loaded);
    loaded += value.length;
    post({ type: "progress", loaded, total });
  }
  if (loaded !== expectedBytes) throw new Error("model.bin is incomplete");
  return new Uint16Array(buffer.buffer);
}

async function load(base: string): Promise<AskAlfonso> {
  const [modelJson, knowledge] = await Promise.all([
    fetchJson<ModelJson>(`${base}/model.json`),
    fetchJson<KnowledgeJson>(`${base}/knowledge.json`),
  ]);
  const half = await fetchWeights(`${base}/model.bin`, modelJson.parameters * 2);
  const instance = new AskAlfonso(modelJson, halfToFloat32(half), knowledge);
  post({ type: "ready", parameters: modelJson.parameters });
  return instance;
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === "load") {
    bot ??= load(msg.base);
    bot.catch((err: Error) => {
      bot = null; // let the user retry
      post({ type: "error", message: err.message });
    });
    return;
  }
  try {
    if (!bot) throw new Error("Model not loaded");
    const instance = await bot;
    post({ type: "answer", id: msg.id, reply: instance.ask(msg.question) });
  } catch (err) {
    post({ type: "error", id: msg.id, message: (err as Error).message });
  }
};
