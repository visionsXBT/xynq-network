# Changelog

All notable changes to xynq-network are documented here.

## [0.4.2] — 2026-06-22

### Fixed
- Scheduler now applies hard-ceiling backpressure: fully saturated workers are
  excluded from dispatch so jobs wait for real capacity instead of queueing on a
  hot node.

### Added
- `withinCapacity()` helper and worker-reconnect handling notes.

## [0.4.0] — 2026-06-21

### Added
- Technical reference docs (architecture, contribute, API, token).
- Docker + fly.io deploy configuration.

## [0.3.0] — 2026-06-16

### Added
- Keeper: pump.fun creator-fee claim, $XYNQ buyback + burn, and treasury split.
- Anchor staking program for $XYNQ.
- Solana payout + reward ledger.

## [0.2.0] — 2026-06-11

### Added
- Worker anti-cheat (canary probes, coherence scoring, throughput plausibility).
- Native (Ollama) and browser (WebGPU) contributor workers.

## [0.1.0] — 2026-06-08

### Added
- Orchestrator core: worker registry, scheduler, pipeline sharding.
- OpenAI-compatible chat completions + models API.
- WebSocket orchestrator entrypoint.
