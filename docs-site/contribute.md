# Contribute Compute

If your machine has a GPU that spends most of the day idle, you can lend that
idle time to XYNQ and get paid in $XYNQ for the tokens it produces. The worker
only ever runs when your card would otherwise be doing nothing, and it hands the
GPU straight back the moment you need it.

## Option A — native (best throughput)

Install [Ollama](https://ollama.com), then start the worker with the wallet you
want rewards sent to:

```bash
npx xynq-worker --wallet <YOUR_SOLANA_ADDRESS>
```

On first run it fingerprints your GPU, joins the coordinator, pulls whatever
model band it's assigned, and begins serving. Leave it running in the background;
it backs off automatically whenever you start using the GPU yourself.

## Option B — browser (zero install)

Open the **Contribute** page on the site and press *Start*. A compact model loads
into the tab over WebGPU and the tab becomes a node for as long as it stays open.
Closing it cleanly removes you from the pool. Great for laptops and quick tests.

## What you earn, and when

Work is measured in **tokens served** and settled once per **6-hour epoch**. At
the epoch boundary the keeper reads the anonymous token tally and pays each
contributor their share in $XYNQ.

Payouts are gated on reliability: the network constantly checks that nodes are
doing real work (see [Architecture → anti-cheat](./architecture.md)). A node
whose reliability dips below the bar simply earns nothing until it recovers — no
bans, no appeals, just "do the work to get paid."

| | |
| ------------------ | -------------------------------------- |
| Unit of credit     | tokens served                          |
| Settlement cadence | every 6 hours                          |
| Reward asset       | $XYNQ                                   |
| Payout gate        | reliability above threshold            |

## Good to know

- Nothing about a prompt is visible to you as a contributor, and nothing is
  written to disk — you receive a shard and activations, compute, and return
  tokens.
- You can cap how much VRAM the worker may touch with `--max-vram`, or restrict
  which models it will serve with `--models`.
