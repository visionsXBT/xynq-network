import type { WorkerInfo } from "@/types";

/**
 * In-memory table of connected workers. The scheduler reads from here; the
 * WebSocket layer keeps it up to date via hello/heartbeat/disconnect events.
 */
export class WorkerRegistry {
  private workers = new Map<string, WorkerInfo>();
  private modelFirstSeen = new Map<string, number>();

  upsert(info: WorkerInfo) {
    this.workers.set(info.id, info);
    for (const m of info.models) {
      if (!this.modelFirstSeen.has(m)) this.modelFirstSeen.set(m, Date.now());
    }
  }

  markOffline(id: string) {
    const w = this.workers.get(id);
    if (w) w.online = false;
  }

  touch(id: string, patch: Partial<WorkerInfo>) {
    const w = this.workers.get(id);
    if (w) Object.assign(w, patch, { lastSeen: Date.now() });
  }

  online(): WorkerInfo[] {
    return [...this.workers.values()].filter((w) => w.online);
  }

  forModel(modelId: string): WorkerInfo[] {
    return this.online().filter((w) => w.models.includes(modelId));
  }

  replicaCount(modelId: string): number {
    return this.forModel(modelId).length;
  }

  firstSeen(modelId: string): number {
    return Math.floor((this.modelFirstSeen.get(modelId) ?? Date.now()) / 1000);
  }

  totals() {
    const on = this.online();
    return {
      nodes: on.length,
      vramMb: on.reduce((s, w) => s + w.vramMb, 0),
      tflops: on.reduce((s, w) => s + w.tflops, 0),
    };
  }
}
