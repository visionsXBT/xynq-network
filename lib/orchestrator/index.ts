import type { Job, JobSpec, WorkerInfo } from "@/types";
import { WorkerRegistry } from "./registry";
import { planShards } from "./sharding";
import { pickBest, type Candidate } from "./scheduler";
import { recordJobStart, recordJobTokens } from "@/lib/db";

/**
 * The orchestrator is the brain of the mesh. It accepts jobs from the web/API
 * layer, plans a shard layout, dispatches shards to the best workers, and
 * fans streamed tokens back to whoever is subscribed.
 *
 * The transport (WebSocket) lives in `server/index.ts`; this module is the
 * transport-agnostic core so it can also run in-process during dev.
 */
class Orchestrator {
  readonly registry = new WorkerRegistry();
  private jobs = new Map<string, Job>();
  private streams = new Map<string, AsyncQueue<string>>();
  private dispatchHook: ((job: Job) => void) | null = null;

  onDispatch(fn: (job: Job) => void) {
    this.dispatchHook = fn;
  }

  async enqueue(spec: JobSpec): Promise<string> {
    const id = `job_${crypto.randomUUID()}`;
    const workers = this.selectWorkers(spec.model);
    const shards = planShards(spec.model, workers) ?? [];

    const job: Job = {
      id,
      spec,
      createdAt: Date.now(),
      shards,
      state: shards.length ? "dispatched" : "queued",
    };
    this.jobs.set(id, job);
    this.streams.set(id, new AsyncQueue<string>());
    recordJobStart(id, spec.model, shards.length);

    if (shards.length) this.dispatchHook?.(job);
    return id;
  }

  /** Workers pipe tokens here; subscribers receive them in order. */
  ingestToken(jobId: string, delta: string) {
    recordJobTokens(jobId, 1);
    this.streams.get(jobId)?.push(delta);
  }

  finish(jobId: string) {
    const job = this.jobs.get(jobId);
    if (job) job.state = "done";
    this.streams.get(jobId)?.close();
  }

  fail(jobId: string, _message: string) {
    const job = this.jobs.get(jobId);
    if (job) job.state = "failed";
    this.streams.get(jobId)?.close();
  }

  async *subscribe(jobId: string): AsyncGenerator<string> {
    const q = this.streams.get(jobId);
    if (!q) return;
    yield* q.drain();
  }

  private selectWorkers(modelId: string): WorkerInfo[] {
    const pool = this.registry.forModel(modelId);
    // Greedily pick a pipeline of distinct best workers to cover the model.
    const chosen: WorkerInfo[] = [];
    const used = new Set<string>();
    const target = Math.min(pool.length, 4);
    for (let i = 0; i < target; i++) {
      const candidates: Candidate[] = pool
        .filter((w) => !used.has(w.id))
        .map((w) => ({ ...w, loadPct: 0 }));
      const best = pickBest(candidates);
      if (!best) break;
      used.add(best.id);
      chosen.push(best);
    }
    return chosen;
  }
}

/** Minimal async queue with backpressure-free push and async drain. */
class AsyncQueue<T> {
  private items: T[] = [];
  private resolvers: ((v: IteratorResult<T>) => void)[] = [];
  private closed = false;

  push(item: T) {
    if (this.closed) return;
    const r = this.resolvers.shift();
    if (r) r({ value: item, done: false });
    else this.items.push(item);
  }

  close() {
    this.closed = true;
    let r;
    while ((r = this.resolvers.shift())) r({ value: undefined as never, done: true });
  }

  async *drain(): AsyncGenerator<T> {
    while (true) {
      if (this.items.length) {
        yield this.items.shift() as T;
        continue;
      }
      if (this.closed) return;
      const next = await new Promise<IteratorResult<T>>((res) =>
        this.resolvers.push(res)
      );
      if (next.done) return;
      yield next.value;
    }
  }
}

// Singleton across hot reloads in dev.
const g = globalThis as unknown as { __xynqOrch?: Orchestrator };
export function getOrchestrator(): Orchestrator {
  if (!g.__xynqOrch) g.__xynqOrch = new Orchestrator();
  return g.__xynqOrch;
}

export function getRegistry(): WorkerRegistry {
  return getOrchestrator().registry;
}

export type { Orchestrator };
