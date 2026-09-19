import { describe, expect, it, vi } from 'vitest';

import { createPostEvaluationHandler } from '../../app/api/cases/[caseId]/evaluate/route';
import type { EvaluationRecord } from '../../src/domain/types';
import { GatewayEvaluationError } from '../../src/gateway/evaluate-case';

const invalidRun: EvaluationRecord = {
  id: 'run-invalid',
  caseId: 'DEMO-001',
  modelId: 'typesafe-ai/jev',
  questionVersion: 'resolveops-questions-v1',
  outcome: { status: 'invalid', errorCode: 'INVALID_EVALUATION_RESPONSE' },
  usage: {},
  latencyMs: 8,
  createdAt: '2026-09-19T00:00:00.000Z',
};

const invalidResult = {
  run: invalidRun,
  policyDecision: {
    id: 'policy-invalid',
    runId: invalidRun.id,
    action: 'review' as const,
    reasonCodes: ['INVALID_EVALUATION_RESPONSE'],
    proposedRefundCents: 0,
    policyVersion: 'resolveops-policy-v1' as const,
    createdAt: '2026-09-19T00:00:01.000Z',
  },
};

function context(caseId: string) {
  return { params: Promise.resolve({ caseId }) };
}

describe('POST /api/cases/:caseId/evaluate', () => {
  it('returns the public run and review decision for malformed answers', async () => {
    const handler = createPostEvaluationHandler({
      evaluateAndPersistCase: async () => invalidResult,
    });
    const response = await handler(new Request('http://localhost/api/cases/DEMO-001/evaluate'), context('DEMO-001'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(invalidResult);
  });

  it('rejects path-like case IDs before calling the service', async () => {
    const evaluateAndPersistCase = vi.fn();
    const handler = createPostEvaluationHandler({ evaluateAndPersistCase });
    const response = await handler(
      new Request('http://localhost/api/cases/bad/evaluate'),
      context('../../.env.local'),
    );

    expect(response.status).toBe(404);
    expect(evaluateAndPersistCase).not.toHaveBeenCalled();
  });

  it('maps authentication failures to a redacted 502 response', async () => {
    const handler = createPostEvaluationHandler({
      evaluateAndPersistCase: async () => {
        throw new GatewayEvaluationError('GATEWAY_AUTHENTICATION_FAILED');
      },
    });
    const response = await handler(new Request('http://localhost/api/cases/DEMO-001/evaluate'), context('DEMO-001'));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: { code: 'GATEWAY_AUTHENTICATION_FAILED' } });
    expect(JSON.stringify(body)).not.toMatch(/authorization|api.?key|bearer/i);
  });
});
