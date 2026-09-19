import { experimental_evaluate as evaluate, type Experimental_EvaluationModel } from 'ai';
import { describe, expect, it } from 'vitest';

import { evaluateCase } from '../../src/gateway/evaluate-case';

describe('evaluateCase SDK boundary', () => {
  it('turns SDK-level malformed answers into an auditable invalid run', async () => {
    const malformedModel: Experimental_EvaluationModel = {
      specificationVersion: 'v4',
      provider: 'test',
      modelId: 'malformed-evaluator',
      supportedQuestionTypes: ['boolean', 'choice', 'score'],
      async doEvaluate() {
        return { answers: {}, warnings: [] };
      },
    };

    const record = await evaluateCase('{}', {
      caseId: 'DEMO-001',
      createId: () => 'invalid-run',
      now: () => new Date('2026-09-20T00:00:00.000Z'),
      evaluate: (input) => evaluate({ ...input, model: malformedModel }),
    });

    expect(record.id).toBe('invalid-run');
    expect(record.outcome).toEqual({ status: 'invalid', errorCode: 'INVALID_EVALUATION_RESPONSE' });
  });
});
