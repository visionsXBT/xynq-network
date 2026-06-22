# Deploy the coordinator (Railway)

The coordinator is the service workers connect to and the one that exposes
`/stats` and `/v1/chat`. It runs from `server/index.ts` via `tsx` — no compile
step. This guide deploys it on Railway.

## 1. Create the service

1. In Railway, **New Project → Deploy from GitHub repo** and pick
   `visionsXBT/xynq-network`.
2. Railway reads `railway.json` + `nixpacks.toml` automatically:
   - install: `npm ci --include=dev`
   - start: `npm run start:server`
   - healthcheck: `GET /healthz`

No build/start configuration is needed in the dashboard; it's in the repo.

## 2. Environment variables

| Variable             | Required | Purpose |
| -------------------- | -------- | ------- |
| `PORT`               | auto     | Injected by Railway; the coordinator binds to it. Don't set manually. |
| `DATABASE_PATH`      | recommended | Where the SQLite ledger lives. Set to `/data/xynq.sqlite` and attach a volume (next step) so payout history survives redeploys. |
| `USDC_PER_1K_TOKENS` | optional | If set (e.g. `0.02`), `/stats` shows estimated USDC owed per worker. |
| `INTERNAL_API_SECRET`| optional | Reserved for protecting internal endpoints. |

## 3. Persist the ledger (volume)

Railway's filesystem is ephemeral, so the payout ledger would reset on each
redeploy unless you attach a volume:

1. Service → **Variables**: set `DATABASE_PATH=/data/xynq.sqlite`.
2. Service → **Volumes**: add a volume mounted at `/data`.

The ledger (`worker_id → tokens` per epoch) now persists, so you never lose track
of what each contributor is owed.

## 4. Get the public URL

Service → **Settings → Networking → Generate Domain**. You'll get something like
`https://xynq-network-production.up.railway.app`. Railway terminates TLS and
proxies both HTTP and WebSocket traffic to the service on `PORT`, so the same URL
serves `/stats`, `/v1/chat`, and the worker WebSocket.

Verify:

```bash
curl https://<your-domain>/healthz   # {"ok":true}
curl https://<your-domain>/stats     # live mesh snapshot
```

## 5. Connect workers

Contributors point the worker at the deployed coordinator:

```bash
npm start -- --wallet <SOLANA_ADDRESS> --orch https://<your-domain> --models jaguar
```

They should now appear in `/stats` with their wallet and token count.

## 6. Show the live count on the website

On the **xynq website** service, set:

```
MESH_COORDINATOR_URL=https://<your-domain>
```

The worker page will then display the real number of connected nodes (it proxies
only aggregate counts; worker wallets never leave the coordinator).

## 7. Settling contributors (MVP)

Until the automated keeper is live, you settle manually:

- Read balances from `/stats` (`workers[].tokensServed`, and `usdcOwed` if
  `USDC_PER_1K_TOKENS` is set), or query the SQLite ledger directly
  (`workerTotals()` / `epochLedger()` in `lib/db.ts`).
- Send USDC on Solana to each worker's wallet.

## Notes

- **better-sqlite3** is a native module; `python3` and `gcc` are included in the
  Nixpacks setup so it builds if no prebuilt binary is available.
- Scale to a single instance for now: the registry and in-memory job state live
  in one process. Horizontal scaling needs shared state and is future work.
