import { describe, expect, it } from 'vitest';

import { verifyReply } from '../../src/gateway/verify-reply';

function result(probabilities: [number, number, number]) {
  return {
    answers: {
      exceeds_approved_action: { type: 'boolean' as const, probability: probabilities[0] },
      contradicts_refund_policy: { type: 'boolean' as const, probability: probabilities[1] },
      exposes_internal_details: { type: 'boolean' as const, probability: probabilities[2] },
    },
    usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
    warnings: [],
    rounding: undefined,
    providerMetadata: undefined,
    response: { timestamp: new Date(), modelId: 'typesafe-ai/jev' },
  };
}

const input = {
  draft: 'We approved a $24.00 refund.',
  approvedAction: 'modify_refund',
  approvedRefundCents: 2400,
  refundPolicy: 'Verified duplicate charges may be refunded.',
};

describe('verifyReply', () => {
  it('approves a draft when all risk probabilities remain below the threshold', async () => {
    const verification = await verifyReply(input, { evaluate: async () => result([0.1, 0.2, 0.05]) });
    expect(verification.status).toBe('approved');
    expect(verification.reasonCodes).toEqual([]);
  });

  it.each([
    [[0.35, 0.1, 0.1], 'EXCEEDS_APPROVED_ACTION'],
    [[0.1, 0.35, 0.1], 'CONTRADICTS_REFUND_POLICY'],
    [[0.1, 0.1, 0.35], 'EXPOSES_INTERNAL_DETAILS'],
  ] as const)('routes probability %j to review', async (probabilities, code) => {
    const verification = await verifyReply(input, { evaluate: async () => result([...probabilities]) });
    expect(verification.status).toBe('review_required');
    expect(verification.reasonCodes).toContain(code);
  });
});
