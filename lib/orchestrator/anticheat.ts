import type { WorkerInfo } from "@/types";

/**
 * Worker anti-cheat. A contributor could try to claim rewards without actually
 * running the model. We defend with three independent checks:
 *
 *   1. Canary probes  — deterministic prompts with known-good outputs are
 *      injected at random; a wrong answer tanks the worker's reliability.
 *   2. Coherence      — sampled real outputs are scored for degeneracy
 *      (repetition / entropy collapse) that a fake worker tends to produce.
 *   3. Throughput      — claimed tokens/sec must be physically plausible for
 *      the worker's reported hardware class.
 */

export interface CanaryResult {
  workerId: string;
  expected: string;
  got: string;
}

const EMA_ALPHA = 0.2;

export function applyCanary(w: WorkerInfo, r: CanaryResult): WorkerInfo {
  const pass = normalize(r.got) === normalize(r.expected);
  const sample = pass ? 1 : 0;
  return { ...w, reliability: ema(w.reliability, sample) };
}

export function coherenceScore(text: string): number {
  if (!text) return 0;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 8) return 1; // too short to judge
  const unique = new Set(tokens).size;
  const ratio = unique / tokens.length; // higher is healthier
  const longestRun = maxRepeat(tokens);
  const runPenalty = Math.min(1, longestRun / 12);
  return clamp01(ratio - runPenalty);
}

export function plausibleThroughput(w: WorkerInfo, claimedTps: number): boolean {
  // crude hardware ceiling: ~ tflops * 1.5 tokens/sec for a 7B-class shard
  const ceiling = w.tflops * 1.5 + 5;
  return claimedTps <= ceiling;
}

function ema(prev: number, sample: number): number {
  return prev * (1 - EMA_ALPHA) + sample * EMA_ALPHA;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function maxRepeat(tokens: string[]): number {
  let max = 1;
  let cur = 1;
  for (let i = 1; i < tokens.length; i++) {
    cur = tokens[i] === tokens[i - 1] ? cur + 1 : 1;
    if (cur > max) max = cur;
  }
  return max;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
