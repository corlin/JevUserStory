import { experimental_evaluate as evaluate } from 'ai';

import { POLICY_V1 } from '../policy/policy-v1';

export const REPLY_VERIFICATION_QUESTIONS = {
  exceeds_approved_action: {
    type: 'boolean',
    instructions: 'Does the customer reply promise any action, amount, timing, or commitment beyond approvedAction and approvedRefundCents?',
  },
  contradicts_refund_policy: {
    type: 'boolean',
    instructions: 'Does the customer reply contradict the supplied public refundPolicy?',
  },
  exposes_internal_details: {
    type: 'boolean',
    instructions: 'Does the reply expose internal policy analysis, model identity, probabilities, risk analysis, or review tooling?',
  },
} as const;

type VerificationId = keyof typeof REPLY_VERIFICATION_QUESTIONS;

export type ReplyVerification = {
  status: 'approved' | 'review_required';
  answers: Record<VerificationId, { probability: number }>;
  reasonCodes: string[];
};

type VerifyReplyInput = {
  draft: string;
  approvedAction: string;
  approvedRefundCents: number;
  refundPolicy: string;
};

type EvaluateLike = (options: {
  model: 'typesafe-ai/jev';
  state: string;
  questions: typeof REPLY_VERIFICATION_QUESTIONS;
  maxRetries: 2;
}) => Promise<{
  answers: Record<VerificationId, { type: 'boolean'; probability: number }>;
}>;

const REASON_CODES: Record<VerificationId, string> = {
  exceeds_approved_action: 'EXCEEDS_APPROVED_ACTION',
  contradicts_refund_policy: 'CONTRADICTS_REFUND_POLICY',
  exposes_internal_details: 'EXPOSES_INTERNAL_DETAILS',
};

export async function verifyReply(
  input: VerifyReplyInput,
  dependencies: { evaluate?: EvaluateLike } = {},
): Promise<ReplyVerification> {
  const callEvaluate = (dependencies.evaluate ?? evaluate) as EvaluateLike;
  const result = await callEvaluate({
    model: 'typesafe-ai/jev',
    state: JSON.stringify(input),
    questions: REPLY_VERIFICATION_QUESTIONS,
    maxRetries: 2,
  });

  const answers = {} as ReplyVerification['answers'];
  const reasonCodes: string[] = [];
  for (const id of Object.keys(REPLY_VERIFICATION_QUESTIONS) as VerificationId[]) {
    const answer = result.answers[id];
    if (answer?.type !== 'boolean' || !Number.isFinite(answer.probability) || answer.probability < 0 || answer.probability > 1) {
      return {
        status: 'review_required',
        answers: {
          exceeds_approved_action: { probability: 1 },
          contradicts_refund_policy: { probability: 1 },
          exposes_internal_details: { probability: 1 },
        },
        reasonCodes: ['INVALID_REPLY_VERIFICATION'],
      };
    }
    answers[id] = { probability: answer.probability };
    if (answer.probability >= POLICY_V1.replyReviewMinimum) reasonCodes.push(REASON_CODES[id]);
  }

  return {
    status: reasonCodes.length > 0 ? 'review_required' : 'approved',
    answers,
    reasonCodes,
  };
}
