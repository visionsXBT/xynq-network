# Architecture

The job of XYNQ is to make a crowd of mismatched, part-time GPUs behave like one
dependable endpoint. The hard parts are deciding *where* a request runs, *how* a
model that's too big for any single card gets split, and *how* you trust a node
you don't own. Each of those maps to a module below.

## Where requests run — the coordinator

The coordinator is a small WebSocket service (`server/`, `lib/orchestrator/`).
It keeps the live worker table, accepts jobs, builds an execution plan, dispatches
the pieces, and relays streamed tokens back to whoever asked. The transport is
kept thin on purpose: the actual logic lives in `lib/orchestrator/index.ts` and
can run in-process, so the whole thing is testable without a network.

## How a model is split — sharding

A 27B model won't fit on a 12 GB card, so XYNQ spreads a model's transformer
layers across several nodes and runs them as a pipeline. `sharding.ts` hands each
node a contiguous *band* of layers sized to its VRAM; activations flow from one
band to the next and tokens emerge at the tail.

```
   request ─▶ band 0 ─▶ band 1 ─▶ band 2 ─▶ tokens
              ╿          ╿          ╿
           layers      layers     layers
            0–13       14–31      32–63
           node A      node B     node C
          (10 GB)     (12 GB)    (24 GB)   ◀ larger VRAM, wider band
```

If the combined VRAM of the available nodes can't hold the model, the planner
refuses the job rather than thrash — capacity is a precondition, not a hope.

## Which node gets the work — scheduling

For every band the scheduler (`scheduler.ts`) ranks candidate nodes on a blend of
throughput, latency, and reliability, then subtracts a penalty once a node passes
its load cap so the queue pushes back instead of piling onto a hot card. A pinch
of randomness breaks ties so equivalent nodes share load evenly rather than all
chasing the single highest score.

## Trusting a node you don't own — anti-cheat

Contributors are paid, so the incentive to fake work is real. `anticheat.ts`
defends with three independent, cheap-to-run checks:

- **Canaries** — deterministic prompts with known answers are slipped in at
  random; a miss decays the node's reliability via an exponential moving average.
- **Coherence** — sampled outputs are scored for the repetition and entropy
  collapse that fabricated text tends to show.
- **Throughput sanity** — a node can't claim more tokens/sec than its declared
  hardware could physically produce.

Reliability isn't a separate punishment system — it's the same number the
scheduler ranks on. A node that fails checks simply stops winning work, and stops
earning, until it behaves.

## Putting it together

```
  edge (app/) ──job──▶ coordinator ──bands──▶ fabric (xynq-worker/)
       ▲                    │                        │
       └──────tokens────────┴───────tokens───────────┘
                            │
                     ledger + reliability
                            │
                  settlement (lib/keeper/)
```

Nothing about the prompt is stored at any hop. The only state that outlives a
request is the anonymous token tally the settlement layer needs to pay
contributors.
