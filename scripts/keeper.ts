/**
 * Standalone keeper loop. Run with `npm run start:keeper`.
 * Claims pump.fun creator fees, buys back + burns $XYNQ, funds the treasury,
 * and pays out contributor rewards on a fixed cadence.
 */
import { runKeeperTick } from "@/lib/keeper";

const INTERVAL_MS = Number(process.env.KEEPER_INTERVAL_MS ?? 15 * 60 * 1000);

async function main() {
  console.log(`[keeper] starting, tick every ${INTERVAL_MS / 1000}s`);
  // run once immediately, then on an interval
  await safeTick();
  setInterval(safeTick, INTERVAL_MS);
}

async function safeTick() {
  try {
    await runKeeperTick();
  } catch (err) {
    console.error("[keeper] tick failed:", err);
  }
}

main();
