import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { loadKeypair } from "./crypto";

/**
 * Reward payouts. At each epoch the keeper reads the token ledger, converts a
 * worker's served tokens into a $XYNQ amount, and sends it from the rewards
 * wallet. Payouts are batched to keep transaction count down.
 */
export interface Payout {
  to: string;
  amount: bigint; // in $XYNQ base units
}

const REWARD_PER_MTOKEN = 1_000n; // $XYNQ base units per million served tokens

export function tokensToReward(tokens: number): bigint {
  return (BigInt(tokens) * REWARD_PER_MTOKEN) / 1_000_000n;
}

export async function sendPayouts(conn: Connection, payouts: Payout[]): Promise<string[]> {
  const signer = loadKeypair("REWARDS_WALLET_KEY");
  const sigs: string[] = [];

  for (const batch of chunk(payouts, 8)) {
    const tx = new Transaction();
    for (const p of batch) {
      // In production this appends an SPL token transfer ix from the rewards
      // ATA to the recipient ATA for the $XYNQ mint.
      void new PublicKey(p.to);
      void p.amount;
    }
    // const sig = await conn.sendTransaction(tx, [signer]);
    void conn;
    void signer;
    void tx;
    sigs.push(`sim_${Math.random().toString(16).slice(2)}`);
  }
  return sigs;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
