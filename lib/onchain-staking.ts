import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Staking surface for $XYNQ. Contributors and supporters can stake $XYNQ to
 * back the network; a share of treasury inflows is distributed to stakers
 * proportional to stake-weight at the epoch boundary.
 *
 * The on-chain program is an Anchor program; this module is the read/helper
 * layer the keeper and dashboard use.
 */
export interface StakeAccount {
  owner: string;
  amount: bigint;
  since: number;
}

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

export function connection(): Connection {
  return new Connection(RPC, "confirmed");
}

export function stakeProgramId(): PublicKey {
  // Placeholder program id; set at deploy time.
  return new PublicKey("Stake111111111111111111111111111111111111111");
}

/** Total staked across all accounts — used to weight reward distribution. */
export async function totalStaked(accounts: StakeAccount[]): Promise<bigint> {
  return accounts.reduce((s, a) => s + a.amount, 0n);
}

export function stakeWeight(account: StakeAccount, total: bigint): number {
  if (total === 0n) return 0;
  return Number((account.amount * 1_000_000n) / total) / 1_000_000;
}
