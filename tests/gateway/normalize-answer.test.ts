import { describe, expect, it } from 'vitest';

import type { QuestionId } from '../../src/domain/types';
import { normalizeAnswers } from '../../src/gateway/normalize-answer';

const expectedIds = [
  'refund_requested',
  'department',
  'severity',
] satisfies QuestionId[];

const validRaw = {
  refund_requested: { type: 'boolean', probability: 0.96 },
  department: {
    type: 'choice',
    choice: 'billing',
    probabilities: { billing: 0.81, shipping: 0.14, other: 0.05 },
  },
  severity: {
    type: 'score',
    score: 1.8,
    probabilities: { '0': 0.05, '1': 0.25, '2': 0.65, '3': 0.05 },
  },
};

describe('normalizeAnswers', () => {
  it('normalizes all supported answer types and derives choice margins', () => {
    expect(normalizeAnswers(validRaw, expectedIds)).toEqual({
      refund_requested: { type: 'boolean', probability: 0.96 },
      department: {
        type: 'choice',
        choice: 'billing',
        probabilities: { billing: 0.81, shipping: 0.14, other: 0.05 },
        topProbability: 0.81,
        topTwoMargin: 0.67,
      },
      severity: {
        type: 'score',
        score: 1.8,
        probabilities: { '0': 0.05, '1': 0.25, '2': 0.65, '3': 0.05 },
      },
    });
  });

  it.each([
    ['missing IDs', { ...validRaw, severity: undefined }],
    ['extra IDs', { ...validRaw, unexpected: { type: 'boolean', probability: 0.5 } }],
    ['NaN', { ...validRaw, refund_requested: { type: 'boolean', probability: Number.NaN } }],
    ['probability below zero', { ...validRaw, refund_requested: { type: 'boolean', probability: -0.01 } }],
    ['probability above one', { ...validRaw, refund_requested: { type: 'boolean', probability: 1.01 } }],
    ['choice distribution sum', {
      ...validRaw,
      department: {
        type: 'choice', choice: 'billing', probabilities: { billing: 0.7, shipping: 0.1 },
      },
    }],
    ['missing score probabilities', {
      ...validRaw,
      severity: { type: 'score', score: 2 },
    }],
  ])('rejects %s', (_name, raw) => {
    expect(() => normalizeAnswers(raw, expectedIds)).toThrowError('INVALID_EVALUATION_RESPONSE');
  });
});
