/**
 * Snapshots the sqlite ledger to ./backups with a timestamped name.
 * The ledger holds only anonymous reward accounting — no prompts.
 */
import { copyFileSync, mkdirSync } from "fs";
import { join } from "path";

const DB_PATH = process.env.DATABASE_PATH ?? "./data/xynq.sqlite";
const OUT_DIR = "./backups";

mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = join(OUT_DIR, `xynq-${stamp}.sqlite`);

try {
  copyFileSync(DB_PATH, dest);
  console.log(`[backup] wrote ${dest}`);
} catch (err) {
  console.error("[backup] failed:", err);
  process.exit(1);
}
