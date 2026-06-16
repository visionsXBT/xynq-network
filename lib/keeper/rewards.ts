import { Connection } from "@solana/web3.js";
import { epochLedger } from "@/lib/db";
import { sendPayouts, tokensToReward, type Payout } from "@/lib/payout";

/**
 * Converts the epoch's served-token ledger into $XYNQ payouts and sends them.
 * Workers are credited proportionally to the tokens they actually served
 * (after anti-cheat has already adjusted their reliability upstream).
 */
export async function distributeEpochRewards(
  conn: Connection,
  epoch: number
): Promise<{ payouts: Payout[]; signatures: string[] }> {
  const rows = epochLedger(epoch);
  const payouts: Payout[] = rows
    .map((r) => ({ to: r.worker_id, amount: tokensToReward(r.tokens) }))
    .filter((p) => p.amount > 0n);

  if (payouts.length === 0) return { payouts: [], signatures: [] };

  const signatures = await sendPayouts(conn, payouts);
  return { payouts, signatures };
}

export function currentEpoch(): number {
  // 6-hour epochs.
  return Math.floor(Date.now() / (6 * 60 * 60 * 1000));
}
