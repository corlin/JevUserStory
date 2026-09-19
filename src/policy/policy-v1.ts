export const POLICY_V1 = {
  id: 'resolveops-policy-v1',
  refundAutoMinimum: 0.9,
  policySupportMinimum: 0.9,
  injectionReviewMinimum: 0.8,
  booleanUncertainLower: 0.35,
  booleanUncertainUpper: 0.65,
  highRiskRefundCents: 5000,
  replyReviewMinimum: 0.35,
  choiceTopMinimum: 0.8,
  choiceMarginMinimum: 0.2,
  scoreTopMinimum: 0.7,
  evidenceScoreMinimum: 2,
} as const;
