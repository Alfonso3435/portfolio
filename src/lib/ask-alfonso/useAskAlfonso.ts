"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Reply } from "./types";
import type { WorkerRequest, WorkerResponse } from "./worker";

export type ModelStatus = "idle" | "loading" | "ready" | "error";

/** Where export_web.py puts the files (served statically from /public). */
const ASSETS = "/ask-alfonso";

/**
 * The chat's connection to the model. The worker is created on first use, so pages
 * that never chat never download anything.
 */
export function useAskAlfonso() {
  const worker = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void }>());
  const nextId = useRef(1);
  const [status, setStatus] = useState<ModelStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const ensureWorker = useCallback(() => {
    if (worker.current) return worker.current;
    const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "progress") setProgress(msg.total ? msg.loaded / msg.total : 0);
      else if (msg.type === "ready") {
        setStatus("ready");
        setProgress(1);
      } else if (msg.type === "answer") {
        pending.current.get(msg.id)?.resolve(msg.reply);
        pending.current.delete(msg.id);
      } else if (msg.type === "error") {
        if (msg.id !== undefined) {
          pending.current.get(msg.id)?.reject(new Error(msg.message));
          pending.current.delete(msg.id);
        } else {
          setStatus("error");
          setError(msg.message);
        }
      }
    };
    worker.current = w;
    return w;
  }, []);

  /** Start downloading the model (safe to call more than once). */
  const load = useCallback(() => {
    setStatus((s) => (s === "ready" || s === "loading" ? s : "loading"));
    setError(null);
    ensureWorker().postMessage({ type: "load", base: ASSETS } satisfies WorkerRequest);
  }, [ensureWorker]);

  const ask = useCallback(
    /** `previous`: the last question answered, so follow-ups ("what about X?") make sense. */
    (question: string, previous?: string) => {
      load();
      const id = nextId.current++;
      return new Promise<Reply>((resolve, reject) => {
        pending.current.set(id, { resolve, reject });
        ensureWorker().postMessage({ type: "ask", id, question, previous } satisfies WorkerRequest);
      });
    },
    [ensureWorker, load],
  );

  useEffect(() => {
    const requests = pending.current;
    return () => {
      worker.current?.terminate();
      worker.current = null;
      requests.clear();
    };
  }, []);

  return { status, progress, error, load, ask };
}
