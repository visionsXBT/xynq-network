# xynq-network

**Open AI inference, powered by the world's idle GPUs.**

XYNQ is an inference network built on *borrowed idle time* rather than rented data centers. People connect a machine, the network uses its GPU only while it would otherwise sit idle, and they earn $XYNQ for the work it does. Users, in turn, get an OpenAI-compatible endpoint with no account gate and no prompt logging. Coordination is handled by a lightweight scheduler; value settles on **Solana** via the **$XYNQ** token, launched on [pump.fun](https://pump.fun).

What makes XYNQ different from a hosted API:

- **Borrowed, not bought** — capacity comes from idle community hardware that yields the instant its owner needs it back, not from always-on rented clusters.
- **Zero-retention by design** — prompts and outputs are never written to disk; the only persisted record is the anonymous token tally used to pay contributors.
- **Open endpoint** — anonymous free chat for everyone, plus a drop-in OpenAI-compatible API; rewards and accounting settle on-chain.

---

## How it works

XYNQ is a four-layer stack. A request enters at the edge and falls through each layer until tokens stream back up:

```
   ╔══════════════════════════════════════════════════════════╗
 1 ║  EDGE        web terminal + OpenAI-compatible API         ║  app/
   ╟──────────────────────────────────────────────────────────╢
 2 ║  COORDINATOR scheduler · pipeline sharding · anti-cheat   ║  lib/orchestrator, server/
   ╟──────────────────────────────────────────────────────────╢
 3 ║  FABRIC      idle contributor GPUs — Ollama / WebGPU      ║  xynq-worker/
   ╟──────────────────────────────────────────────────────────╢
 4 ║  SETTLEMENT  $XYNQ on Solana — rewards · buyback · burn   ║  lib/keeper, lib/payout
   ╚══════════════════════════════════════════════════════════╝
```

**The lifecycle of one request:**

1. A prompt hits the **edge** (`app/`) — the web terminal or the `/api/v1` REST surface.
2. The **coordinator** (`lib/orchestrator/`, `server/`) plans a shard layout, scores idle workers, and dispatches the work over a WebSocket.
3. The **fabric** (`xynq-worker/`) — contributors' GPUs running Ollama natively or a model in-tab over WebGPU — computes its assigned layers and streams tokens back up the stack.
4. Independently, the **settlement** layer (`lib/keeper/`) tallies served tokens, pays contributors in `$XYNQ`, and recycles pump.fun creator fees into buyback-and-burn plus a public treasury.

Anti-cheat (canary probes, coherence scoring, throughput plausibility) runs inside layer 2 so dishonest workers route themselves out before they ever get paid.

## Models

The network serves a rotating catalog of open and in-house models. The default routing alias is `xynq`.

| Model alias        | Notes                                          |
| ------------------ | ---------------------------------------------- |
| `jaguar`           | In-house low-latency chat model (default)      |
| `qwen-3.5-27b`     | Multilingual general model, sharded            |
| `supergemma-4-26b` | Fast instruction-tuned model                   |

`GET /api/v1/models` lists what is currently live across the mesh.

## API

OpenAI-compatible. Point any OpenAI client at the XYNQ base URL.

```bash
curl https://xynq.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "xynq",
    "messages": [{"role": "user", "content": "explain entropy in one line"}],
    "stream": true
  }'
```

Image generation is exposed at `POST /api/images/generate`.

## Running it

Requirements: Node 20+, a Solana RPC URL, and a Privy app for the contributor dashboard.

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev:all              # Next.js web + orchestrator together
```

| script                 | what it runs                              |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Next.js web/API only                      |
| `npm run dev:server`   | orchestrator (WebSocket) only             |
| `npm run dev:all`      | both, concurrently                        |
| `npm run start:keeper` | the $XYNQ buyback/burn/treasury keeper    |
| `npm run seed`         | seed a local dev mesh                      |
| `npm run build`        | production build                          |

Core environment variables (see `.env.example` for the full list):

| var                                               | purpose                                            |
| ------------------------------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_PRIVY_APP_ID` / `PRIVY_APP_SECRET`   | contributor auth                                   |
| `SOLANA_RPC_URL`                                  | Solana RPC endpoint                                |
| `XYNQ_TOKEN_MINT`                                 | the $XYNQ mint                                      |
| `PUMPFUN_CREATOR_VAULT`                           | pump.fun creator-fee vault for the keeper          |
| `TREASURY_WALLET_KEY` / `KEEPER_WALLET_KEY`       | custodial treasury + keeper wallets (keep off-repo)|
| `INTERNAL_API_SECRET`                             | web↔orchestrator trust                             |

> Secrets live in `.env.local` (gitignored). Never commit a wallet key.

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · socket.io · better-sqlite3 · Solana (`@solana/kit`, `@coral-xyz/anchor`, `@pump-fun/pump-swap-sdk`) · Privy auth · web-llm (WebGPU) · Ollama (native workers).

## Repository layout

```
app/                Next.js routes + API (app/api/v1 is the OpenAI-compatible surface)
server/             orchestrator entrypoint
lib/                core logic: orchestrator, keeper, staking, payouts, db, crypto
lib/orchestrator/   job routing, sharding, worker anti-cheat
lib/keeper/         pump.fun fee claim + buyback/burn + treasury
xynq-worker/        the contributor worker (browser + native)
scripts/            keeper, db backup, seed
docs-site/          documentation
```

## Token

`$XYNQ` is launched on pump.fun. Creator fees accrued by the token are claimed by the keeper and split:

- **50%** → buy back and burn `$XYNQ`
- **50%** → a public treasury that funds the coordination layer and contributor incentives

The split is configurable via `KEEPER_BURN_SPLIT_BPS`.

## License

MIT — see [LICENSE](./LICENSE).
