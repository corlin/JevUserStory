import { generateText } from 'ai';

import type { CaseFixture, EvaluationUsage } from '../domain/types';
import type { ReviewDecisionRecord } from '../db/run-repository';

const REPLY_MODEL = 'openai/gpt-5-nano' as const;

export type GeneratedReply = {
  draft: string;
  modelId: string;
  usage: EvaluationUsage;
};

type GenerateReplyInput = {
  caseFixture: CaseFixture;
  review: ReviewDecisionRecord | undefined;
};

type GenerateTextLike = (options: { model: typeof REPLY_MODEL; prompt: string }) => Promise<{
  text: string;
  response: { modelId: string };
  usage: EvaluationUsage;
}>;

export async function generateApprovedReply(
  input: GenerateReplyInput,
  dependencies: { generateText?: GenerateTextLike } = {},
): Promise<GeneratedReply> {
  if (!input.review || input.review.caseId !== input.caseFixture.id) {
    throw new Error('REVIEW_REQUIRED');
  }

  const prompt = [
    'Write a concise customer-support reply using only the approved facts below.',
    `approvedAction: ${input.review.action}`,
    `approvedRefundCents: ${input.review.refundCents}`,
    `customerLanguage: ${input.caseFixture.language}`,
    `publicRefundPolicy: ${input.caseFixture.refundPolicy}`,
    'Do not invent refunds, amounts, dates, delivery promises, or other commitments.',
    'Do not mention internal policy analysis, AI models, probabilities, risk scores, or review tooling.',
  ].join('\n');
  const callGenerate = (dependencies.generateText ?? generateText) as GenerateTextLike;
  const result = await callGenerate({ model: REPLY_MODEL, prompt });
  if (!result.text.trim()) throw new Error('REPLY_GENERATION_FAILED');
  return {
    draft: result.text.trim(),
    modelId: result.response.modelId || REPLY_MODEL,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
    },
  };
}
