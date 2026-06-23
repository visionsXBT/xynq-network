#!/usr/bin/env node
// Interactive chat client for the XYNQ network coordinator.
// Sends each turn to POST /v1/chat, which dispatches the job to a connected
// worker and streams the worker's tokens back. Use this to drive real jobs
// onto your worker while watching it process them in another terminal.
//
//   node scripts/netchat.mjs                       # defaults to the public coordinator
//   node scripts/netchat.mjs --model jaguar
//   node scripts/netchat.mjs --orch http://localhost:8787
import readline from "node:readline";

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const ORCH = (arg("--orch", process.env.XYNQ_ORCH || "https://xynq-network-production.up.railway.app")).replace(/\/$/, "");
const MODEL = arg("--model", "jaguar");

const c = { reset: "\x1b[0m", dim: "\x1b[2m", green: "\x1b[32m", cyan: "\x1b[36m", red: "\x1b[31m", gray: "\x1b[90m" };
const messages = [];

console.log(`${c.green}XYNQ network chat${c.reset}  ${c.gray}→ ${ORCH} (model: ${MODEL})${c.reset}`);
console.log(`${c.gray}Type a message. Ctrl+C to quit.${c.reset}\n`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = () => { rl.setPrompt(`${c.cyan}you ${c.dim}› ${c.reset}`); rl.prompt(); };

async function send(text) {
  messages.push({ role: "user", content: text });
  let res;
  try {
    res = await fetch(`${ORCH}/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages }),
    });
  } catch (err) {
    console.log(`${c.red}network error: ${err.message}${c.reset}`);
    messages.pop();
    return;
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch {}
    if (res.status === 503) msg += " (no worker is online for this model — start one in the other terminal)";
    console.log(`${c.red}${msg}${c.reset}`);
    messages.pop();
    return;
  }

  process.stdout.write(`${c.green}xynq ${c.dim}› ${c.reset}`);
  let full = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    const t = decoder.decode(chunk, { stream: true });
    full += t;
    process.stdout.write(t);
  }
  process.stdout.write("\n\n");
  if (full) messages.push({ role: "assistant", content: full });
  else messages.pop();
}

rl.on("line", async (line) => {
  const text = line.trim();
  if (!text) return prompt();
  await send(text);
  prompt();
});
rl.on("close", () => { console.log(`${c.gray}\nbye.${c.reset}`); process.exit(0); });
prompt();
