import { describe, expect, it, vi } from 'vitest';

import type { EvaluationRecord, PolicyDecision } from '../../src/domain/types';
import { getDemoCase } from '../../src/fixtures/cases';
import { createCaseService } from '../../src/services/case-service';

const fixture = getDemoCase('DEMO-001')!;
const run: EvaluationRecord = {
  id: 'run-1',
  caseId: fixture.id,
  modelId: 'typesafe-ai/jev',
  questionVersion: 'resolveops-questions-v1',
  outcome: { status: 'invalid', errorCode: 'INVALID_EVALUATION_RESPONSE' },
  usage: {},
  latencyMs: 12,
  createdAt: '2026-09-19T00:00:00.000Z',
};
const policy: PolicyDecision = {
  action: 'review',
  reasonCodes: ['INVALID_EVALUATION_RESPONSE'],
  proposedRefundCents: 0,
  policyVersion: 'resolveops-policy-v1',
};

describe('case service', () => {
  it('evaluates, persists, applies policy, and persists the decision in order', async () => {
    const events: string[] = [];
    const service = createCaseService({
      findCase: (caseId) => {
        events.push(`find:${caseId}`);
        return fixture;
      },
      listCases: () => [fixture],
      evaluateCase: async (state, options) => {
        events.push(`evaluate:${options.caseId}`);
        expect(JSON.parse(state)).not.toHaveProperty('groundTruth');
        return run;
      },
      saveEvaluationRun: (record) => {
        events.push(`save-run:${record.id}`);
        return record;
      },
      evaluatePolicy: (inputCase, outcome) => {
        events.push(`policy:${inputCase.id}:${outcome.status}`);
        return policy;
      },
      savePolicyDecision: (decision) => {
        events.push(`save-policy:${decision.runId}`);
        return decision;
      },
      createId: () => 'policy-1',
      now: () => new Date('2026-09-19T00:00:01.000Z'),
    });

    await expect(service.evaluateAndPersistCase(fixture.id)).resolves.toEqual({
      run,
      policyDecision: {
        ...policy,
        id: 'policy-1',
        runId: 'run-1',
        createdAt: '2026-09-19T00:00:01.000Z',
      },
    });
    expect(events).toEqual([
      'find:DEMO-001',
      'evaluate:DEMO-001',
      'save-run:run-1',
      'policy:DEMO-001:invalid',
      'save-policy:run-1',
    ]);
  });

  it('rejects a missing case before any model call', async () => {
    const evaluateCase = vi.fn();
    const service = createCaseService({
      findCase: () => undefined,
      listCases: () => [],
      evaluateCase,
      saveEvaluationRun: vi.fn(),
      evaluatePolicy: vi.fn(),
      savePolicyDecision: vi.fn(),
      createId: () => 'unused',
      now: () => new Date(0),
    });

    await expect(service.evaluateAndPersistCase('DEMO-999')).rejects.toThrowError('CASE_NOT_FOUND');
    expect(evaluateCase).not.toHaveBeenCalled();
  });
});
