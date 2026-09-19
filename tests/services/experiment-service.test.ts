import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/client';
import { seedCases } from '../../src/db/case-repository';
import { DEMO_CASES } from '../../src/fixtures/cases';
import {
  createExperimentService,
} from '../../src/services/experiment-service';
import type { EvaluationRecord } from '../../src/domain/types';

const temporaryDirectories: string[] = [];

function createTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'resolveops-exp-serv-'));
  temporaryDirectories.push(directory);
  const database = openDatabase(join(directory, 'test.sqlite'));
  seedCases(database, DEMO_CASES);
  return database;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe('experiment service', () => {
  it('seeds default baseline experiment and returns metrics out-of-the-box', () => {
    const database = createTestDatabase();
    const service = createExperimentService(database);

    // Initial check: seeds baseline automatically
    const experiments = service.listExperiments();
    expect(experiments.length).toBeGreaterThanOrEqual(1);

    const baseline = experiments.find((e) => e.sourceType === 'baseline');
    expect(baseline).toBeDefined();
    expect(baseline?.status).toBe('completed');
    expect(baseline?.totalCases).toBe(30);

    const details = service.getExperimentDetails(baseline!.id);
    expect(details).toBeDefined();
    expect(details?.results).toHaveLength(30);
    expect(details?.metrics.totalCases).toBe(30);
    expect(details?.metrics.business.autoRate).toBeGreaterThan(0);
    expect(details?.metrics.choiceMetrics.department.accuracy).toBeGreaterThan(0.7);

    database.close();
  });

  it('runs a new experiment with custom slice', async () => {
    const database = createTestDatabase();
    const service = createExperimentService(database);

    const newExperiment = await service.runExperiment({
      datasetSlice: 'language:zh-CN',
      sourceType: 'baseline',
    });

    expect(newExperiment.status).toBe('completed');
    expect(newExperiment.datasetSlice).toBe('language:zh-CN');
    expect(newExperiment.totalCases).toBe(12); // 12 Chinese cases in 30 demo cases

    const details = service.getExperimentDetails(newExperiment.id);
    expect(details?.results).toHaveLength(12);
    expect(details?.metrics.totalCases).toBe(12);

    database.close();
  });

  it('uses measured Gateway answers for a live experiment', async () => {
    const database = createTestDatabase();
    const measuredRun: EvaluationRecord = {
      id: 'RUN-LIVE-001',
      caseId: 'DEMO-001',
      modelId: 'typesafe-ai/jev-measured',
      questionVersion: 'resolveops-questions-v1',
      outcome: {
        status: 'valid',
        answers: {
          department: { type: 'choice', choice: 'billing', probabilities: { billing: 0.81, logistics: 0.19 }, topProbability: 0.81, topTwoMargin: 0.62 },
          requested_resolution: { type: 'choice', choice: 'refund', probabilities: { refund: 0.84, replacement: 0.16 }, topProbability: 0.84, topTwoMargin: 0.68 },
          refund_requested: { type: 'boolean', probability: 0.83 },
          urgent: { type: 'boolean', probability: 0.71 },
          policy_supports_action: { type: 'boolean', probability: 0.79 },
          prompt_injection: { type: 'boolean', probability: 0.13 },
          frustration: { type: 'score', score: 3, probabilities: { 3: 0.77 } },
          severity: { type: 'score', score: 2, probabilities: { 2: 0.74 } },
          evidence_quality: { type: 'score', score: 3, probabilities: { 3: 0.8 } },
        },
      },
      usage: { inputTokens: 123, outputTokens: 17, totalTokens: 140 },
      latencyMs: 321,
      createdAt: '2026-09-20T01:00:00.000Z',
    };
    const service = createExperimentService(database, {
      evaluateCase: async (_state, options) => ({ ...measuredRun, caseId: options.caseId }),
    });

    const experiment = await service.runExperiment({
      datasetSlice: 'tag:prompt-injection',
      sourceType: 'live',
    });
    const details = service.getExperimentDetails(experiment.id)!;

    expect(experiment.sourceType).toBe('live');
    expect(experiment.modelId).toBe('typesafe-ai/jev-measured');
    expect(details.results).toHaveLength(2);
    expect(details.results[0].answers.refund_requested).toEqual({ type: 'boolean', probability: 0.83 });
    expect(details.results[0].usage).toEqual({ inputTokens: 123, outputTokens: 17, totalTokens: 140 });
    expect(details.results[0].latencyMs).toBe(321);

    database.close();
  });

  it('marks a live experiment failed when Gateway answers are invalid', async () => {
    const database = createTestDatabase();
    const service = createExperimentService(database, {
      evaluateCase: async (_state, options) => ({
        id: 'RUN-INVALID',
        caseId: options.caseId,
        modelId: 'typesafe-ai/jev',
        questionVersion: 'resolveops-questions-v1',
        outcome: { status: 'invalid', errorCode: 'INVALID_EVALUATION_RESPONSE' },
        usage: {},
        latencyMs: 10,
        createdAt: '2026-09-20T01:00:00.000Z',
      }),
    });

    await expect(service.runExperiment({
      datasetSlice: 'tag:prompt-injection',
      sourceType: 'live',
    })).rejects.toThrow('INVALID_EVALUATION_RESPONSE');

    expect(service.listExperiments()[0]).toMatchObject({
      sourceType: 'live',
      status: 'failed',
      completedCases: 0,
    });

    database.close();
  });
});
