import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/client';
import { listExperiments } from '../../src/db/experiment-repository';
import { SCHEMA_SQL } from '../../src/db/schema';

const temporaryDirectories: string[] = [];

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe('database migrations', () => {
  it('relabels legacy synthetic live experiments as baseline evidence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'resolveops-migration-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'legacy.sqlite');
    const legacyDatabase = new Database(path);
    legacyDatabase.exec(SCHEMA_SQL);
    legacyDatabase.prepare(`
      INSERT INTO experiments (
        id, model_id, question_version, policy_version, dataset_slice,
        status, source_type, total_cases, completed_cases, created_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'EXP-LEGACY-LIVE',
      'typesafe-ai/jev',
      'resolveops-questions-v1',
      'resolveops-policy-v1',
      'all',
      'completed',
      'live',
      30,
      30,
      '2026-09-19T00:00:00.000Z',
      '2026-09-19T00:01:00.000Z',
    );
    legacyDatabase.close();

    const migratedDatabase = openDatabase(path);
    expect(listExperiments(migratedDatabase)[0].sourceType).toBe('baseline');
    migratedDatabase.close();
  });
});
