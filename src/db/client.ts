import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema';

export type ResolveOpsDatabase = Database.Database;

function migrateReplyRuns(database: ResolveOpsDatabase): void {
  const row = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reply_runs'").get() as { sql?: string } | undefined;
  if (!row?.sql || !/review_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(row.sql)) return;

  database.pragma('foreign_keys = OFF');
  try {
    database.transaction(() => {
      database.exec(`
        ALTER TABLE reply_runs RENAME TO reply_runs_legacy;
        CREATE TABLE reply_runs (
          id TEXT PRIMARY KEY,
          case_id TEXT NOT NULL,
          review_id TEXT NOT NULL,
          draft TEXT NOT NULL,
          verification_json TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (case_id) REFERENCES cases(id),
          FOREIGN KEY (review_id) REFERENCES review_decisions(id)
        );
        INSERT INTO reply_runs SELECT * FROM reply_runs_legacy;
        DROP TABLE reply_runs_legacy;
        CREATE INDEX IF NOT EXISTS idx_replies_review ON reply_runs(review_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_replies_case ON reply_runs(case_id, created_at);
      `);
    })();
  } finally {
    database.pragma('foreign_keys = ON');
  }
}

function migrateLegacyExperimentProvenance(database: ResolveOpsDatabase): void {
  const migrationId = '2026-09-20-real-live-experiments-v1';
  const applied = database.prepare('SELECT 1 FROM schema_migrations WHERE id = ?').get(migrationId);
  if (applied) return;

  database.transaction(() => {
    // Before this migration, the live code path generated deterministic baseline
    // answers. Preserve the rows while correcting their evidence label.
    database.prepare("UPDATE experiments SET source_type = 'baseline' WHERE source_type = 'live'").run();
    database.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)')
      .run(migrationId, new Date().toISOString());
  })();
}

export function openDatabase(path: string): ResolveOpsDatabase {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.exec(SCHEMA_SQL);
  migrateReplyRuns(database);
  migrateLegacyExperimentProvenance(database);
  return database;
}
