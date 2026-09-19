import { z } from 'zod';

const probability = z.number().finite().min(0).max(1);

export const PolicyThresholdsSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  refundAutoMinimum: probability,
  policySupportMinimum: probability,
  injectionReviewMinimum: probability,
  booleanUncertainLower: probability,
  booleanUncertainUpper: probability,
  highRiskRefundCents: z.number().int().nonnegative(),
  replyReviewMinimum: probability,
  choiceTopMinimum: probability,
  choiceMarginMinimum: probability,
  scoreTopMinimum: probability,
  evidenceScoreMinimum: z.number().int().min(1).max(4),
}).strict().refine(
  (thresholds) => thresholds.booleanUncertainLower <= thresholds.booleanUncertainUpper,
  { message: 'boolean uncertainty bounds are reversed' },
);

export const PolicyVersionInputSchema = z.object({
  version: z.string().trim().min(3).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  thresholds: PolicyThresholdsSchema,
}).strict();
