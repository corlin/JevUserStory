import { z } from 'zod';

import type { NormalizedAnswer, QuestionId } from '../domain/types';

const probability = z.number().finite().min(0).max(1);
const probabilities = z.record(z.string(), probability);

const booleanAnswer = z.object({
  type: z.literal('boolean'),
  probability,
}).strict();

const choiceAnswer = z.object({
  type: z.literal('choice'),
  choice: z.string().min(1),
  probabilities,
}).strict().superRefine((answer, context) => {
  const total = Object.values(answer.probabilities).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 0.01 || !(answer.choice in answer.probabilities)) {
    context.addIssue({ code: 'custom', message: 'Invalid choice distribution' });
  }
});

const scoreAnswer = z.object({
  type: z.literal('score'),
  score: z.number().finite(),
  probabilities,
}).strict().superRefine((answer, context) => {
  if (Object.keys(answer.probabilities).length === 0) {
    context.addIssue({ code: 'custom', message: 'Score probabilities are required' });
  }
});

const rawAnswer = z.discriminatedUnion('type', [booleanAnswer, choiceAnswer, scoreAnswer]);

function invalidResponse(): Error {
  return new Error('INVALID_EVALUATION_RESPONSE');
}

export function normalizeAnswers(
  raw: unknown,
  expectedIds: readonly QuestionId[],
): Record<QuestionId, NormalizedAnswer> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw invalidResponse();
  }

  const rawRecord = raw as Record<string, unknown>;
  const actualIds = Object.keys(rawRecord).sort();
  const requiredIds = [...expectedIds].sort();
  if (actualIds.length !== requiredIds.length || actualIds.some((id, index) => id !== requiredIds[index])) {
    throw invalidResponse();
  }

  const normalized: Partial<Record<QuestionId, NormalizedAnswer>> = {};
  try {
    for (const id of expectedIds) {
      const answer = rawAnswer.parse(rawRecord[id]);
      if (answer.type === 'choice') {
        const sorted = Object.values(answer.probabilities).sort((a, b) => b - a);
        normalized[id] = {
          ...answer,
          topProbability: sorted[0] ?? 0,
          topTwoMargin: (sorted[0] ?? 0) - (sorted[1] ?? 0),
        };
      } else {
        normalized[id] = answer;
      }
    }
  } catch {
    throw invalidResponse();
  }

  return normalized as Record<QuestionId, NormalizedAnswer>;
}
