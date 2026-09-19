import { describe, expect, it } from 'vitest';
import { QUESTION_SET_V1 } from '../../src/gateway/question-set-v1';

describe('QUESTION_SET_V1', () => {
  it('contains the approved nine atomic questions', () => {
    expect(Object.keys(QUESTION_SET_V1)).toEqual([
      'department',
      'requested_resolution',
      'refund_requested',
      'urgent',
      'policy_supports_action',
      'prompt_injection',
      'frustration',
      'severity',
      'evidence_quality',
    ]);
  });

  it('uses boolean rather than a non-existent noul AI SDK type', () => {
    expect(QUESTION_SET_V1.refund_requested.type).toBe('boolean');
  });
});
