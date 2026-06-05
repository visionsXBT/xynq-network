import type { WorkerInfo } from "@/types";

/**
 * Picks the best worker for a shard. Scoring blends throughput, latency, and
 * reliability, with a small random jitter to spread load across equivalent
 * nodes. Workers that are over a soft load threshold are penalized so the
 * queue applies backpressure instead of piling onto a hot node.
 */
export interface Candidate extends WorkerInfo {
  loadPct: number;
}

const W_THROUGHPUT = 1.0;
const W_LATENCY = 0.6;
const W_RELIABILITY = 1.4;
const LOAD_SOFT_CAP = 0.85;

export function scoreWorker(w: Candidate): number {
  const throughput = w.throughputTps / 50; // normalize around ~50 tps
  const latency = 1 / (1 + w.latencyMs / 100);
  const reliability = w.reliability;
  const loadPenalty = w.loadPct > LOAD_SOFT_CAP ? (w.loadPct - LOAD_SOFT_CAP) * 4 : 0;
  const jitter = Math.random() * 0.05;

  return (
    W_THROUGHPUT * throughput +
    W_LATENCY * latency +
    W_RELIABILITY * reliability -
    loadPenalty +
    jitter
  );
}

export function pickBest(candidates: Candidate[]): Candidate | null {
  // Apply backpressure: drop nodes that are fully saturated so the job waits
  // for capacity instead of being dispatched to a node that will queue it.
  const eligible = candidates.filter(withinCapacity);
  const pool = eligible.length > 0 ? eligible : candidates;
  if (pool.length === 0) return null;

  let best = pool[0];
  let bestScore = scoreWorker(best);
  for (let i = 1; i < pool.length; i++) {
    const s = scoreWorker(pool[i]);
    if (s > bestScore) {
      best = pool[i];
      bestScore = s;
    }
  }
  return best;
}

/** A worker has capacity if it is below the hard load ceiling. */
export function withinCapacity(w: Candidate): boolean {
  return w.loadPct < 0.98;
}
