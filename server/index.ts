/**
 * Orchestrator entrypoint.
 *
 * Hosts the WebSocket the contributor workers connect to, wires their
 * hello/heartbeat/token/done messages into the core orchestrator, dispatches
 * shards, and runs periodic canary probes for anti-cheat.
 */
import { Server } from "socket.io";
import { createServer } from "http";
import { getOrchestrator } from "@/lib/orchestrator";
import { applyCanary, plausibleThroughput } from "@/lib/orchestrator/anticheat";
import type { WorkerMessage, ServerMessage, WorkerInfo } from "@/types";

const PORT = Number(process.env.ORCHESTRATOR_WS_PORT ?? 8787);
const SECRET = process.env.INTERNAL_API_SECRET ?? "";

const orch = getOrchestrator();
const http = createServer();
const io = new Server(http, { cors: { origin: "*" } });

orch.onDispatch((job) => {
  for (const shard of job.shards) {
    const msg: ServerMessage = { t: "dispatch", jobId: job.id, shard, spec: job.spec };
    io.to(`worker:${shard.workerId}`).emit("server", msg);
  }
});

io.on("connection", (socket) => {
  let workerId: string | null = null;

  socket.on("worker", (raw: WorkerMessage) => {
    switch (raw.t) {
      case "hello": {
        workerId = raw.info.id;
        socket.join(`worker:${workerId}`);
        const info: WorkerInfo = {
          ...raw.info,
          latencyMs: 80,
          throughputTps: 30,
          reliability: 0.9,
          online: true,
          lastSeen: Date.now(),
        };
        orch.registry.upsert(info);
        break;
      }
      case "heartbeat": {
        if (workerId) orch.registry.touch(workerId, {});
        break;
      }
      case "token": {
        const w = workerId && orch.registry.online().find((x) => x.id === workerId);
        if (w && !plausibleThroughput(w, w.throughputTps)) {
          orch.fail(raw.jobId, "implausible throughput");
          break;
        }
        orch.ingestToken(raw.jobId, raw.delta);
        break;
      }
      case "done":
        orch.finish(raw.jobId);
        break;
      case "error":
        orch.fail(raw.jobId, raw.message);
        break;
    }
  });

  socket.on("probe:result", (r: { expected: string; got: string }) => {
    const w = workerId && orch.registry.online().find((x) => x.id === workerId);
    if (w) orch.registry.upsert(applyCanary(w, { workerId: w.id, ...r }));
  });

  socket.on("disconnect", () => {
    if (workerId) orch.registry.markOffline(workerId);
  });
});

// Periodic canary probes.
setInterval(() => {
  const nonce = Math.random().toString(36).slice(2);
  const probe: ServerMessage = { t: "probe", nonce };
  io.emit("server", probe);
}, 30_000);

http.listen(PORT, () => {
  console.log(`[orchestrator] ws listening on :${PORT} (secret ${SECRET ? "set" : "MISSING"})`);
});
