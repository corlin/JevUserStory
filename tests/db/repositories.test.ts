import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/client';
import { findCase, listCases, seedCases } from '../../src/db/case-repository';
import {
  countReviewDecisions,
  findEvaluationRun,
  findLatestReplyRun,
  saveEvaluationRun,
  saveReplyRun,
  saveReviewDecision,
} from '../../src/db/run-repository';
import { DEMO_CASES } from '../../src/fixtures/cases';

const temporaryDirectories: string[] = [];

function createTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'resolveops-db-'));
  temporaryDirectories.push(directory);
  return openDatabase(join(directory, 'test.sqlite'));
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe('case repository', () => {
  it('seeds repeatably without duplicating cases and round-trips JSON fields', () => {
    const database = createTestDatabase();

    seedCases(database, DEMO_CASES);
    seedCases(database, DEMO_CASES);

    expect(listCases(database)).toHaveLength(30);
    expect(findCase(database, 'DEMO-001')).toEqual(DEMO_CASES[0]);
    expect(listCases(database, { language: 'zh-CN' }).every(({ language }) => language === 'zh-CN')).toBe(true);
    expect(listCases(database, { tag: 'prompt-injection' })).toHaveLength(2);
    database.close();
  });
});

describe('run repository', () => {
  it('migrates legacy reply uniqueness so corrected attempts can be stored', () => {
    const directory = mkdtempSync(join(tmpdir(), 'resolveops-db-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'legacy.sqlite');
    const legacy = new Database(path);
    legacy.exec(`
      CREATE TABLE reply_runs (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        review_id TEXT NOT NULL UNIQUE,
        draft TEXT NOT NULL,
        verification_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    legacy.close();

    const database = openDatabase(path);
    const schema = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reply_runs'").pluck().get() as string;
    expect(schema).not.toMatch(/review_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_replies_%'").all())
      .toHaveLength(2);
    database.close();
  });

  it('keeps evaluation records immutable', () => {
    const database = createTestDatabase();
    seedCases(database, DEMO_CASES);
    const record = {
      id: 'run-001',
      caseId: 'DEMO-001' as const,
      modelId: 'typesafe-ai/jev',
      questionVersion: 'resolveops-questions-v1' as const,
      outcome: { status: 'invalid' as const, errorCode: 'GATEWAY_UNAVAILABLE' as const },
      usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
      latencyMs: 180,
      createdAt: '2026-09-19T12:00:00.000Z',
    };

    saveEvaluationRun(database, record);

    expect(() => saveEvaluationRun(database, { ...record, latencyMs: 999 })).toThrow();
    expect(findEvaluationRun(database, record.id)).toEqual(record);
    database.close();
  });

  it('returns the original review only for an exact idempotent replay', () => {
    const database = createTestDatabase();
    seedCases(database, DEMO_CASES);
    const original = saveReviewDecision(database, {
      id: 'review-001',
      caseId: 'DEMO-001',
      idempotencyKey: 'retry-safe-key',
      action: 'confirm_refund',
      refundCents: 4900,
      note: 'Verified duplicate captured charge.',
      createdAt: '2026-09-19T12:01:00.000Z',
    });

    const repeated = saveReviewDecision(database, {
      id: 'review-002',
      caseId: 'DEMO-001',
      idempotencyKey: 'retry-safe-key',
      action: 'confirm_refund',
      refundCents: 4900,
      note: 'Verified duplicate captured charge.',
      createdAt: '2026-09-19T12:02:00.000Z',
    });

    expect(repeated).toEqual(original);
    expect(countReviewDecisions(database)).toBe(1);
    database.close();
  });

  it('rejects an idempotency key reused for a different operation', () => {
    const database = createTestDatabase();
    seedCases(database, DEMO_CASES);
    saveReviewDecision(database, {
      id: 'review-001', caseId: 'DEMO-001', idempotencyKey: 'conflict-key',
      action: 'confirm_refund', refundCents: 4900, note: 'first', createdAt: '2026-09-19T12:00:00.000Z',
    });
    expect(() => saveReviewDecision(database, {
      id: 'review-002', caseId: 'DEMO-002', idempotencyKey: 'conflict-key',
      action: 'escalate', refundCents: 0, note: 'different', createdAt: '2026-09-19T12:01:00.000Z',
    })).toThrowError('IDEMPOTENCY_KEY_CONFLICT');
    database.close();
  });

  it('persists corrected reply attempts instead of returning a rejected draft', () => {
    const database = createTestDatabase();
    seedCases(database, DEMO_CASES);
    const review = saveReviewDecision(database, {
      id: 'review-001', caseId: 'DEMO-001', idempotencyKey: 'reply-key',
      action: 'modify_refund', refundCents: 2400, note: 'reviewed', createdAt: '2026-09-19T12:00:00.000Z',
    });
    const verification = {
      answers: {
        exceeds_approved_action: { probability: 0.9 },
        contradicts_refund_policy: { probability: 0.1 },
        exposes_internal_details: { probability: 0.1 },
      },
      reasonCodes: ['EXCEEDS_APPROVED_ACTION'],
      status: 'review_required' as const,
    };
    saveReplyRun(database, {
      id: 'reply-1', caseId: 'DEMO-001', reviewId: review.id, draft: 'unsafe', verification,
      status: 'review_required', createdAt: '2026-09-19T12:01:00.000Z',
    });
    const corrected = saveReplyRun(database, {
      id: 'reply-2', caseId: 'DEMO-001', reviewId: review.id, draft: 'safe',
      verification: { ...verification, status: 'approved', reasonCodes: [] },
      status: 'approved', createdAt: '2026-09-19T12:02:00.000Z',
    });
    expect(corrected.id).toBe('reply-2');
    expect(findLatestReplyRun(database, 'DEMO-001')?.draft).toBe('safe');
    database.close();
  });
});
