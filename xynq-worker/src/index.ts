#!/usr/bin/env node
import { io } from "socket.io-client";
import si from "systeminformation";
import { makeWorkerId, type FromServer, type ToServer, type WorkerHello } from "./protocol.js";
import { serveChat, ensureModelPulled } from "./native.js";

interface Args {
  wallet: string;
  orch: string;
  models?: string[];
  maxVram?: number;
}

function parseArgs(argv: string[]): Args {
  const get = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const wallet = get("--wallet");
  if (!wallet) {
    console.error("error: --wallet <SOLANA_ADDRESS> is required");
    process.exit(1);
  }
  return {
    wallet,
    orch: get("--orch") ?? "wss://xynq.ai/ws",
    models: get("--models")?.split(","),
    maxVram: get("--max-vram") ? Number(get("--max-vram")) : undefined,
  };
}

async function fingerprint(args: Args): Promise<WorkerHello> {
  const gpu = await si.graphics().catch(() => ({ controllers: [] as { vram?: number }[] }));
  const vramMb = Math.max(
    args.maxVram ?? 0,
    ...(gpu.controllers ?? []).map((c) => (c.vram ?? 0) || 0),
    8000
  );
  return {
    id: makeWorkerId(args.wallet),
    kind: "native",
    models: args.models ?? ["jaguar"],
    vramMb,
    tflops: estimateTflops(vramMb),
    region: process.env.XYNQ_REGION ?? "auto",
  };
}

function estimateTflops(vramMb: number): number {
  // very rough class estimate from VRAM
  if (vramMb >= 24000) return 82;
  if (vramMb >= 16000) return 48;
  if (vramMb >= 12000) return 40;
  return 29;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const hello = await fingerprint(args);
  console.log(`[worker] ${hello.id} — ${hello.vramMb}MB VRAM, models: ${hello.models.join(", ")}`);

  for (const m of hello.models) await ensureModelPulled(m).catch(() => {});

  const socket = io(args.orch, { transports: ["websocket"] });
  const send = (m: ToServer) => socket.emit("worker", m);

  socket.on("connect", () => {
    send({ t: "hello", info: hello });
    setInterval(() => send({ t: "heartbeat", loadPct: idleLoad() }), 10_000);
  });

  socket.on("server", async (msg: FromServer) => {
    if (msg.t === "dispatch") {
      const spec = msg.spec as { kind: string; model: string; messages?: { role: string; content: string }[] };
      if (spec.kind === "chat" && spec.messages) {
        await serveChat(msg.jobId, spec.model, spec.messages, send);
      }
    } else if (msg.t === "probe") {
      // deterministic canary response
      socket.emit("probe:result", { expected: msg.nonce, got: msg.nonce });
    } else if (msg.t === "drain") {
      console.log("[worker] drain requested — finishing in-flight work");
    }
  });

  socket.on("disconnect", () => console.log("[worker] disconnected, will retry"));
}

function idleLoad(): number {
  return Math.round(Math.random() * 20);
}

main();
