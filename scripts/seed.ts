/**
 * Seeds a local dev mesh: registers a few fake workers so the orchestrator can
 * plan shards and the dashboard has something to render without real GPUs.
 */
import { getRegistry } from "@/lib/orchestrator";
import type { WorkerInfo } from "@/types";

const FAKE: WorkerInfo[] = [
  mk("node-fra-01", "native", ["jaguar", "qwen-3.5-27b"], 24000, 82.6, "eu-central"),
  mk("node-aus-02", "native", ["jaguar"], 10000, 29.8, "na-south"),
  mk("node-sin-03", "browser", ["supergemma-4-26b"], 12000, 40.1, "apac-se"),
  mk("node-ams-04", "native", ["jaguar", "supergemma-4-26b"], 24000, 82.6, "eu-west"),
];

function mk(
  id: string,
  kind: WorkerInfo["kind"],
  models: string[],
  vramMb: number,
  tflops: number,
  region: string
): WorkerInfo {
  return {
    id,
    wallet: `DEV${id}`, // local-dev placeholder; real workers report a Solana address
    kind,
    models,
    vramMb,
    tflops,
    region,
    latencyMs: 60 + Math.random() * 40,
    throughputTps: 25 + Math.random() * 30,
    reliability: 0.9,
    online: true,
    lastSeen: Date.now(),
  };
}

const reg = getRegistry();
for (const w of FAKE) reg.upsert(w);
console.log(`[seed] registered ${FAKE.length} workers`, reg.totals());
