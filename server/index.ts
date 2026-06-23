/**
 * Orchestrator entrypoint.
 *
 * Hosts:
 *  - the WebSocket the contributor workers connect to (hello/heartbeat/token/done),
 *  - a small HTTP API: GET /healthz, GET /stats (live mesh + settlement ledger),
 *    and POST /v1/chat (a real inference round-trip through a connected worker).
 *
 * Dispatch and anti-cheat are wired into the transport-agnostic core in
 * lib/orchestrator. Token accounting is persisted so the operator can settle
 * contributors in USDC from the ledger.
 */
import { Server } from "socket.io";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { getOrchestrator } from "@/lib/orchestrator";
import { applyCanary, plausibleThroughput } from "@/lib/orchestrator/anticheat";
import { resolveModel } from "@/lib/models";
import { workerTotals } from "@/lib/db";
import type { WorkerMessage, ServerMessage, WorkerInfo, ChatJobSpec } from "@/types";

// Railway (and most PaaS) inject PORT; fall back to a fixed port locally.
const PORT = Number(process.env.PORT ?? process.env.ORCHESTRATOR_WS_PORT ?? 8787);
const SECRET = process.env.INTERNAL_API_SECRET ?? "";
// Optional: lets /stats show an estimated USDC amount owed per worker.
const USDC_PER_1K_TOKENS = Number(process.env.USDC_PER_1K_TOKENS ?? 0);

// Billing: when XYNQ_API_BASE + INTERNAL_API_SECRET are set, /v1/chat requires a
// valid xynq_sk_ key and meters token usage against the account's credit balance
// (same free allowance + USDC credits as the hosted API). Unset = open/keyless.
const BILLING_BASE = (process.env.XYNQ_API_BASE ?? "").replace(/\/$/, "");
const BILLING_ON = Boolean(BILLING_BASE && SECRET);

type AuthResult = { ok: true } | { ok: false; code: number; error: string };

/** Ask the XYNQ account backend whether this key may run a job right now. */
async function authorizeKey(key: string): Promise<AuthResult> {
  if (!BILLING_ON) return { ok: true };
  if (!key) return { ok: false, code: 401, error: 'Missing API key. Pass "Authorization: Bearer xynq_sk_...".' };
  try {
    const r = await fetch(`${BILLING_BASE}/internal/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": SECRET },
      body: JSON.stringify({ key }),
    });
    if (r.ok) return { ok: true };
    let error = `Authorization failed (${r.status}).`;
    try {
      error = ((await r.json()) as { error?: string }).error || error;
    } catch {
      /* keep default */
    }
    return { ok: false, code: r.status, error };
  } catch {
    // Fail closed: if we can't confirm the account, don't burn worker time.
    return { ok: false, code: 503, error: "Billing service is unreachable — try again shortly." };
  }
}

/** Report token usage so the account backend can deduct credits. Best-effort. */
async function meterKey(key: string, inputTokens: number, outputTokens: number): Promise<void> {
  if (!BILLING_ON || !key) return;
  try {
    await fetch(`${BILLING_BASE}/internal/meter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": SECRET },
      body: JSON.stringify({ key, inputTokens, outputTokens }),
    });
  } catch {
    /* metering is best-effort; never block the response on it */
  }
}

const orch = getOrchestrator();

// ---------- HTTP API ----------
const http = createServer((req, res) => handleHttp(req, res));

function cors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res: ServerResponse, code: number, body: unknown) {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  res.statusCode = code;
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1_000_000) req.destroy(); // 1MB cap
    });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

/** Live mesh snapshot + per-worker settlement totals. */
function buildStats() {
  const online = orch.registry.online();
  const live = orch.earnings(); // in-memory tokens since process start
  const durable = new Map(workerTotals().map((r) => [r.worker_id, r.tokens]));

  const workers = online.map((w) => {
    const tokens = durable.get(w.id) ?? live[w.id] ?? 0;
    return {
      id: w.id,
      wallet: w.wallet,
      kind: w.kind,
      region: w.region,
      models: w.models,
      vramMb: w.vramMb,
      tflops: w.tflops,
      reliability: w.reliability,
      tokensServed: tokens,
      usdcOwed: USDC_PER_1K_TOKENS ? +((tokens / 1000) * USDC_PER_1K_TOKENS).toFixed(6) : undefined,
    };
  });

  const totals = orch.registry.totals();
  return {
    online: totals.nodes,
    vramMb: totals.vramMb,
    tflops: +totals.tflops.toFixed(1),
    queue: 0,
    workers,
    updatedAt: Date.now(),
  };
}

async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/healthz") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/stats") {
    return sendJson(res, 200, buildStats());
  }

  if (req.method === "POST" && url.pathname === "/v1/chat") {
    try {
      const body = JSON.parse((await readBody(req)) || "{}");
      const model: string = String(body.model ?? "jaguar");
      const messages = Array.isArray(body.messages) ? body.messages : null;
      if (!messages || messages.length === 0) {
        return sendJson(res, 400, { error: 'A non-empty "messages" array is required.' });
      }

      // Authorize the API key (no-op when billing is disabled) before doing work.
      const authHeader = String(req.headers["authorization"] ?? "");
      const keyMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      const apiKey = keyMatch ? keyMatch[1].trim() : "";
      const auth = await authorizeKey(apiKey);
      if (!auth.ok) return sendJson(res, auth.code, { error: auth.error });

      const resolved = resolveModel(model);
      if (!resolved) return sendJson(res, 400, { error: `Unknown model: ${model}` });
      // Require live capacity before accepting — don't queue into the void.
      if (orch.registry.forModel(resolved.id).length === 0) {
        return sendJson(res, 503, { error: "No workers are currently serving this model." });
      }

      const spec: ChatJobSpec = {
        kind: "chat",
        model: resolved.id,
        messages,
        params: { temperature: Number(body.temperature ?? 0.7), maxTokens: Number(body.maxTokens ?? 512) },
      };
      const jobId = await orch.enqueue(spec);

      // Rough input-token estimate (~4 chars/token); output tokens counted live.
      const inputChars = messages.reduce(
        (n: number, m: { content?: unknown }) => n + (typeof m?.content === "string" ? m.content.length : 0),
        0
      );
      const inputTokens = Math.ceil(inputChars / 4);
      let outputTokens = 0;

      cors(res);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.statusCode = 200;
      for await (const delta of orch.subscribe(jobId)) {
        outputTokens++;
        res.write(delta);
      }
      res.end();
      await meterKey(apiKey, inputTokens, outputTokens);
      return;
    } catch (err) {
      return sendJson(res, 500, { error: String(err) });
    }
  }

  sendJson(res, 404, { error: "Not found" });
}

// ---------- WebSocket (workers) ----------
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
        console.log(`[orchestrator] worker online: ${info.id} (${info.wallet}) — ${info.models.join(", ")}`);
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
    if (workerId) {
      orch.registry.markOffline(workerId);
      console.log(`[orchestrator] worker offline: ${workerId}`);
    }
  });
});

// Periodic canary probes.
setInterval(() => {
  const nonce = Math.random().toString(36).slice(2);
  const probe: ServerMessage = { t: "probe", nonce };
  io.emit("server", probe);
}, 30_000);

http.listen(PORT, () => {
  console.log(`[orchestrator] http+ws listening on :${PORT} (secret ${SECRET ? "set" : "MISSING"})`);
  console.log(`[orchestrator] billing: ${BILLING_ON ? `ON → ${BILLING_BASE}` : "OFF (keyless)"}`);
  console.log(`[orchestrator] GET /stats · GET /healthz · POST /v1/chat`);
});
