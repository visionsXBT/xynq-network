// Shared types across the web app, orchestrator, and workers.

export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatJobSpec {
  kind: "chat";
  model: string;
  messages: ChatMessage[];
  params: { temperature: number; maxTokens: number };
}

export interface ImageJobSpec {
  kind: "image";
  model: string;
  prompt: string;
  params: { steps: number; width: number; height: number };
}

export type JobSpec = ChatJobSpec | ImageJobSpec;

export interface Job extends Record<string, unknown> {
  id: string;
  spec: JobSpec;
  createdAt: number;
  shards: ShardAssignment[];
  state: "queued" | "dispatched" | "streaming" | "done" | "failed";
}

export interface ShardAssignment {
  workerId: string;
  layerStart: number;
  layerEnd: number;
}

export interface WorkerInfo {
  id: string;
  wallet: string; // Solana address used to settle this worker's rewards
  kind: "browser" | "native";
  models: string[];
  vramMb: number;
  tflops: number;
  region: string;
  // exponential moving averages maintained by the scheduler
  latencyMs: number;
  throughputTps: number;
  reliability: number; // 0..1
  stakeBoost?: number; // 0..0.25 dispatch priority from $XYNQ holdings
  online: boolean;
  lastSeen: number;
}

export type WorkerMessage =
  | { t: "hello"; info: Omit<WorkerInfo, "latencyMs" | "throughputTps" | "reliability" | "online" | "lastSeen"> }
  | { t: "heartbeat"; loadPct: number }
  | { t: "token"; jobId: string; delta: string }
  | { t: "done"; jobId: string }
  | { t: "error"; jobId: string; message: string };

export type ServerMessage =
  | { t: "dispatch"; jobId: string; shard: ShardAssignment; spec: JobSpec }
  | { t: "probe"; nonce: string }
  | { t: "drain" };
