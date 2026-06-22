import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";

/**
 * The only thing XYNQ stores is anonymous job accounting needed for reward
 * math — never prompts, never outputs. A job row records which model ran, how
 * many shards served it, and a running token count used to credit workers.
 */
const DB_PATH = process.env.DATABASE_PATH ?? "./data/xynq.sqlite";

let db: Database.Database | null = null;

function get(): Database.Database {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id          TEXT PRIMARY KEY,
      model       TEXT NOT NULL,
      shards      INTEGER NOT NULL,
      tokens      INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ledger (
      worker_id   TEXT NOT NULL,
      epoch       INTEGER NOT NULL,
      tokens      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (worker_id, epoch)
    );
  `);
  return db;
}

export function recordJobStart(id: string, model: string, shards: number) {
  get()
    .prepare(`INSERT OR IGNORE INTO jobs (id, model, shards, created_at) VALUES (?, ?, ?, ?)`)
    .run(id, model, shards, Date.now());
}

export function recordJobTokens(id: string, n: number) {
  get().prepare(`UPDATE jobs SET tokens = tokens + ? WHERE id = ?`).run(n, id);
}

export function creditWorker(workerId: string, epoch: number, tokens: number) {
  get()
    .prepare(
      `INSERT INTO ledger (worker_id, epoch, tokens) VALUES (?, ?, ?)
       ON CONFLICT(worker_id, epoch) DO UPDATE SET tokens = tokens + excluded.tokens`
    )
    .run(workerId, epoch, tokens);
}

export function epochLedger(epoch: number): { worker_id: string; tokens: number }[] {
  return get()
    .prepare(`SELECT worker_id, tokens FROM ledger WHERE epoch = ?`)
    .all(epoch) as { worker_id: string; tokens: number }[];
}

/** Lifetime tokens credited per worker across all epochs (for settlement). */
export function workerTotals(): { worker_id: string; tokens: number }[] {
  return get()
    .prepare(`SELECT worker_id, SUM(tokens) AS tokens FROM ledger GROUP BY worker_id ORDER BY tokens DESC`)
    .all() as { worker_id: string; tokens: number }[];
}
