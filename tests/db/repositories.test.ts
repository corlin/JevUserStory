import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/client';
import { findCase, listCases, seedCases } from '../../src/db/case-repository';
import {
  countReviewDecisions,
  findEvaluationRun,
  saveEvaluationRun,
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

  it('returns the original review for a repeated idempotency key', () => {
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
      action: 'escalate',
      refundCents: 0,
      note: 'This retry must not replace the first decision.',
      createdAt: '2026-09-19T12:02:00.000Z',
    });

    expect(repeated).toEqual(original);
    expect(countReviewDecisions(database)).toBe(1);
    database.close();
  });
});
