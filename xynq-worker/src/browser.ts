// Browser worker: runs a small model in-tab over WebGPU using web-llm.
// Bundled separately for the "Contribute in your browser" button on the site.
//
// This module intentionally has no Node imports so it can be built for the web.

import type { ToServer } from "./protocol.js";

type Engine = {
  chat: {
    completions: {
      create: (args: unknown) => AsyncIterable<{ choices: { delta: { content?: string } }[] }>;
    };
  };
};

declare global {
  interface Navigator {
    gpu?: unknown;
  }
}

export async function hasWebGPU(): Promise<boolean> {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

/**
 * Loads a WebGPU engine and serves a chat job. `loadEngine` is injected so the
 * heavy web-llm dependency is only imported in the browser bundle.
 */
export async function serveChatBrowser(
  jobId: string,
  messages: { role: string; content: string }[],
  loadEngine: () => Promise<Engine>,
  send: (m: ToServer) => void
): Promise<void> {
  if (!(await hasWebGPU())) {
    send({ t: "error", jobId, message: "WebGPU unavailable" });
    return;
  }
  try {
    const engine = await loadEngine();
    const stream = await engine.chat.completions.create({ messages, stream: true });
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) send({ t: "token", jobId, delta });
    }
    send({ t: "done", jobId });
  } catch (err) {
    send({ t: "error", jobId, message: String(err) });
  }
}
