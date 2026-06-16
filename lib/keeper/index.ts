import { connection } from "@/lib/onchain-staking";
import { claimCreatorFees, splitFees, buybackAndBurn, fundTreasury } from "./buyback";
import { distributeEpochRewards, currentEpoch } from "./rewards";

/**
 * One keeper tick:
 *   - claim pump.fun creator fees,
 *   - buy back + burn $XYNQ with the burn split,
 *   - fund the public treasury with the remainder,
 *   - distribute the previous epoch's rewards to contributors.
 */
export async function runKeeperTick(): Promise<void> {
  const conn = connection();

  const claim = await claimCreatorFees(conn);
  if (claim.lamports > 0n) {
    const { burn, treasury } = splitFees(claim.lamports);
    const burnSig = await buybackAndBurn(conn, burn);
    const treasurySig = await fundTreasury(conn, treasury);
    console.log(`[keeper] claimed ${claim.lamports} lamports — burn ${burnSig}, treasury ${treasurySig}`);
  } else {
    console.log("[keeper] no creator fees to claim this tick");
  }

  const epoch = currentEpoch() - 1; // settle the epoch that just closed
  const { payouts, signatures } = await distributeEpochRewards(conn, epoch);
  console.log(`[keeper] epoch ${epoch}: ${payouts.length} payouts, ${signatures.length} txs`);
}
