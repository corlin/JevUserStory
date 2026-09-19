import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/client';
import { seedCases } from '../../src/db/case-repository';
import {
  findExperiment,
  listExperiments,
  saveExperiment,
  saveExperimentCaseResult,
  listExperimentResults,
  updateExperimentStatus,
} from '../../src/db/experiment-repository';
import {
  findActivePolicy,
  findPolicyVersion,
  listPolicyVersions,
  savePolicyVersion,
  setActivePolicy,
} from '../../src/db/policy-repository';
import { DEMO_CASES } from '../../src/fixtures/cases';
import { POLICY_V1 } from '../../src/policy/policy-v1';

const temporaryDirectories: string[] = [];

function createTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'resolveops-db-exp-'));
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

describe('experiment repository', () => {
  it('saves and retrieves experiments and their case results', () => {
    const database = createTestDatabase();

    const experiment = {
      id: 'EXP-TEST-001',
      modelId: 'typesafe-ai/jev',
      questionVersion: 'resolveops-questions-v1',
      policyVersion: 'resolveops-policy-v1',
      datasetSlice: 'all',
      status: 'running' as const,
      sourceType: 'live' as const,
      totalCases: 30,
      completedCases: 0,
      createdAt: new Date().toISOString(),
    };

    saveExperiment(database, experiment);
    expect(findExperiment(database, 'EXP-TEST-001')).toEqual(experiment);

    saveExperimentCaseResult(database, {
      id: 'RES-001',
      experimentId: 'EXP-TEST-001',
      caseId: 'DEMO-001',
      answers: {
        department: { type: 'choice', choice: 'billing', probabilities: { billing: 0.9 }, topProbability: 0.9, topTwoMargin: 0.8 },
        requested_resolution: { type: 'choice', choice: 'refund', probabilities: { refund: 0.95 }, topProbability: 0.95, topTwoMargin: 0.9 },
        refund_requested: { type: 'boolean', probability: 0.98 },
        urgent: { type: 'boolean', probability: 0.8 },
        policy_supports_action: { type: 'boolean', probability: 0.95 },
        prompt_injection: { type: 'boolean', probability: 0.02 },
        frustration: { type: 'score', score: 3, probabilities: { 3: 0.9 } },
        severity: { type: 'score', score: 3, probabilities: { 3: 0.85 } },
        evidence_quality: { type: 'score', score: 3, probabilities: { 3: 0.95 } },
      },
      groundTruth: DEMO_CASES[0].groundTruth,
      latencyMs: 180,
      usage: { inputTokens: 400, outputTokens: 20, totalTokens: 420 },
      policyAction: 'auto',
      reasonCodes: ['REFUND_ELIGIBLE'],
      proposedRefundCents: 2000,
      createdAt: new Date().toISOString(),
    });

    updateExperimentStatus(database, 'EXP-TEST-001', {
      status: 'completed',
      completedCases: 1,
      finishedAt: new Date().toISOString(),
    });

    const updated = findExperiment(database, 'EXP-TEST-001');
    expect(updated?.status).toBe('completed');
    expect(updated?.completedCases).toBe(1);

    const results = listExperimentResults(database, 'EXP-TEST-001');
    expect(results).toHaveLength(1);
    expect(results[0].caseId).toBe('DEMO-001');
    expect(results[0].policyAction).toBe('auto');

    database.close();
  });
});

describe('policy repository', () => {
  it('manages policy versions and toggles active version', () => {
    const database = createTestDatabase();

    const v1 = {
      id: 'POL-V1',
      version: 'resolveops-policy-v1',
      name: 'Standard Policy v1',
      description: 'Default baseline policy',
      thresholds: POLICY_V1,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    savePolicyVersion(database, v1);
    expect(findActivePolicy(database)?.version).toBe('resolveops-policy-v1');

    const v2 = {
      id: 'POL-V2',
      version: 'resolveops-policy-v2-conservative',
      name: 'Conservative Policy v2',
      description: 'Higher thresholds for refunds',
      thresholds: {
        ...POLICY_V1,
        id: 'resolveops-policy-v2-conservative',
        refundAutoMinimum: 0.95,
      },
      isActive: false,
      createdAt: new Date().toISOString(),
    };

    savePolicyVersion(database, v2);
    expect(listPolicyVersions(database)).toHaveLength(2);

    setActivePolicy(database, 'resolveops-policy-v2-conservative');
    expect(findActivePolicy(database)?.version).toBe('resolveops-policy-v2-conservative');

    const refreshedV1 = findPolicyVersion(database, 'resolveops-policy-v1');
    expect(refreshedV1?.isActive).toBe(false);

    database.close();
  });
});
