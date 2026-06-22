# Contribute Compute

If your machine has a GPU that spends most of the day idle, you can lend that
idle time to XYNQ and get paid for the tokens it produces. The worker connects to
the coordinator, serves inference jobs from your GPU, and reports how many tokens
it produced so you can be paid for the work.

> **Status: early MVP.** The native worker, the coordinator, and token accounting
> are functional today. Rewards are settled **manually in USDC on Solana** by the
> operator from the ledger (see *What you earn* below) while the automated keeper
> is finished. The browser (WebGPU) worker is still in development.

## Run a native worker

You need [Ollama](https://ollama.com) installed and at least one model pulled
(e.g. `ollama pull llama3.1:8b`), plus Node.js 20+.

From the repo:

```bash
cd xynq-worker
npm install
npm run build
npm start -- \
  --wallet <YOUR_SOLANA_ADDRESS> \
  --orch  <COORDINATOR_URL> \
  --models jaguar
```

- `--wallet` — the Solana address your USDC rewards are sent to. Required.
- `--orch` — the coordinator URL (e.g. `http://localhost:8787` for a local test,
  or the deployed coordinator address). Defaults to `http://localhost:8787`, or
  the `XYNQ_ORCH` environment variable.
- `--models` — which model aliases to serve (`jaguar`, `qwen-3.5-27b`,
  `supergemma-4-26b`). Defaults to `jaguar`.
- `--max-vram` — optional cap (MB) on how much VRAM the worker may use.

On start it fingerprints your GPU, joins the coordinator, makes sure the model is
present in Ollama, and begins serving. Leave it running; the connection
reconnects automatically if it drops.

You can confirm you're connected by checking the coordinator's live stats:

```bash
curl <COORDINATOR_URL>/stats
```

Your worker id and wallet will appear in the `workers` array, and the public site
reflects the total number of connected workers.

## Model aliases

| Alias              | Runs locally as (Ollama) |
| ------------------ | ------------------------ |
| `jaguar`           | `llama3.1:8b`            |
| `qwen-3.5-27b`     | `qwen2.5:32b`            |
| `supergemma-4-26b` | `gemma2:27b`             |

## What you earn, and when

Work is measured in **tokens served**. The coordinator credits each completed
job's tokens to the serving worker and records them in a per-worker ledger keyed
by UTC-day epoch (`lib/db.ts`).

During the MVP, the operator reads that ledger and settles balances **manually in
USDC on Solana** to each worker's wallet. The automated on-chain keeper that will
do this every epoch is in `lib/keeper/` and is not yet live.

Payouts are gated on reliability. The coordinator continuously checks that nodes
are doing real work (canary probes, throughput sanity — see
[Architecture → anti-cheat](./architecture.md)). A node whose reliability drops
below the bar simply stops being scheduled and stops earning until it recovers.

| | |
| ------------------ | -------------------------------------- |
| Unit of credit     | tokens served                          |
| Accounting cadence | per UTC-day epoch                      |
| Reward asset       | USDC (Solana)                          |
| Settlement (MVP)   | manual, by the operator, from the ledger |
| Payout gate        | reliability above threshold            |

## Privacy, honestly

In the current MVP a worker runs the **whole** model for a request, so the node
that serves your job does process the prompt it was given. The pipeline-sharding
design in [Architecture](./architecture.md) — where a node only ever holds a band
of layers and sees activations rather than raw text — is the direction this is
headed, but it is not what runs today. We would rather state that plainly than
imply a privacy guarantee the MVP does not yet provide.
