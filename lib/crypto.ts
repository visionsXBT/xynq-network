import { Keypair } from "@solana/web3.js";

/**
 * Loads a custodial wallet from an env var. The value is a base64-encoded
 * 64-byte secret key. These are read at runtime only and must never be
 * committed (see .gitignore / .env.example).
 */
export function loadKeypair(envVar: string): Keypair {
  const raw = process.env[envVar];
  if (!raw) throw new Error(`missing wallet env: ${envVar}`);
  const bytes = Uint8Array.from(Buffer.from(raw, "base64"));
  if (bytes.length !== 64) {
    throw new Error(`${envVar} must decode to 64 bytes, got ${bytes.length}`);
  }
  return Keypair.fromSecretKey(bytes);
}

export function shortAddr(addr: string): string {
  return addr.length <= 8 ? addr : `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
