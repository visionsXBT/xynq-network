# xynq-worker

Turn an idle GPU into a node on the XYNQ mesh and earn **$XYNQ** for the tokens it serves.

There are two ways to contribute:

- **Native** (recommended) — runs models through [Ollama](https://ollama.com). Best throughput; auto-pulls the model weights it's assigned.
- **Browser** — runs smaller models in-tab over WebGPU. Zero install; just keep the tab open.

## Native worker

```bash
npx xynq-worker --wallet <YOUR_SOLANA_ADDRESS>
```

The worker will:

1. fingerprint your GPU (VRAM, throughput class),
2. connect to the orchestrator,
3. pull the model shard it's assigned,
4. serve tokens and check in with heartbeats.

Your machine is only enlisted while it's idle — start using the GPU and the
worker yields immediately.

## Flags

| flag           | default            | description                          |
| -------------- | ------------------ | ------------------------------------ |
| `--wallet`     | (required)         | Solana address rewards are sent to   |
| `--orch`       | `wss://xynq.ai/ws` | orchestrator endpoint                |
| `--models`     | auto               | comma-separated model allowlist      |
| `--max-vram`   | auto               | cap the VRAM the worker may use (MB) |

## Privacy

The worker never sees who sent a prompt and never writes prompts or outputs to
disk. It receives a shard + activations, computes, and streams tokens back.
