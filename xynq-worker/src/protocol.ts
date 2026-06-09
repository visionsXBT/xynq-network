// Wire protocol shared with the orchestrator. Kept dependency-free so it can be
// reused by the browser build.

export interface WorkerHello {
  id: string;
  kind: "browser" | "native";
  models: string[];
  vramMb: number;
  tflops: number;
  region: string;
}

export type ToServer =
  | { t: "hello"; info: WorkerHello }
  | { t: "heartbeat"; loadPct: number }
  | { t: "token"; jobId: string; delta: string }
  | { t: "done"; jobId: string }
  | { t: "error"; jobId: string; message: string };

export type FromServer =
  | { t: "dispatch"; jobId: string; shard: { layerStart: number; layerEnd: number }; spec: unknown }
  | { t: "probe"; nonce: string }
  | { t: "drain" };

export function makeWorkerId(wallet: string): string {
  const suffix = Math.random().toString(16).slice(2, 8);
  return `w_${wallet.slice(0, 6)}_${suffix}`;
}
