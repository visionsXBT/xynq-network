import ollama from "ollama";
import type { ToServer } from "./protocol.js";

/**
 * Native runtime: serves a chat job via Ollama and streams tokens back through
 * the provided sink. The orchestrator hands us a shard descriptor; for
 * single-node-capable models we run the whole thing locally, otherwise we run
 * our assigned layer band and forward activations (omitted in this scaffold).
 */
export async function serveChat(
  jobId: string,
  model: string,
  messages: { role: string; content: string }[],
  send: (m: ToServer) => void
): Promise<void> {
  try {
    const stream = await ollama.chat({
      model: mapModel(model),
      messages,
      stream: true,
    });
    for await (const part of stream) {
      const delta = part.message?.content ?? "";
      if (delta) send({ t: "token", jobId, delta });
    }
    send({ t: "done", jobId });
  } catch (err) {
    send({ t: "error", jobId, message: String(err) });
  }
}

/** Map XYNQ model aliases to local Ollama tags. */
function mapModel(model: string): string {
  switch (model) {
    case "jaguar":
      return "llama3.1:8b";
    case "qwen-3.5-27b":
      return "qwen2.5:32b";
    case "supergemma-4-26b":
      return "gemma2:27b";
    default:
      return "llama3.1:8b";
  }
}

/** Returns true if a local Ollama server is reachable. */
export async function ollamaUp(): Promise<boolean> {
  try {
    await ollama.list();
    return true;
  } catch {
    return false;
  }
}

export async function ensureModelPulled(model: string): Promise<void> {
  const tag = mapModel(model);
  try {
    await ollama.show({ model: tag });
  } catch {
    console.log(`[worker] pulling ${tag} …`);
    await ollama.pull({ model: tag });
  }
}
