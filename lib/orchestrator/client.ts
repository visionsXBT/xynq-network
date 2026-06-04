// Thin client the web layer uses to talk to the orchestrator process.
// In single-process dev the orchestrator runs in-band; in production this
// connects to the orchestrator WebSocket at ORCHESTRATOR_PUBLIC_URL.

import type { JobSpec } from "@/types";
import { getOrchestrator } from "./index";

export interface SubmittedJob {
  id: string;
}

export async function submitJob(spec: JobSpec): Promise<SubmittedJob> {
  const orch = getOrchestrator();
  const id = await orch.enqueue(spec);
  return { id };
}

/** Async iterator of streamed token deltas for a job. */
export async function* streamJob(jobId: string): AsyncGenerator<string> {
  const orch = getOrchestrator();
  yield* orch.subscribe(jobId);
}
