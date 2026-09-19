import { describe, expect, it } from 'vitest';
import { DEMO_CASES, getDemoCase } from '../../src/fixtures/cases';

const requiredTags = [
  'clear-positive',
  'clear-negative',
  'ambiguous',
  'missing-information',
  'prompt-injection',
  'long-noise',
  'negation',
  'math-code-owned',
  'date-code-owned',
  'primitive-invariant',
] as const;

const questionIds = [
  'department',
  'requested_resolution',
  'refund_requested',
  'urgent',
  'policy_supports_action',
  'prompt_injection',
  'frustration',
  'severity',
  'evidence_quality',
] as const;

describe('DEMO_CASES', () => {
  it('contains exactly 30 uniquely identified cases', () => {
    expect(DEMO_CASES).toHaveLength(30);
    expect(new Set(DEMO_CASES.map(({ id }) => id)).size).toBe(30);
    expect(DEMO_CASES.map(({ id }) => id)).toEqual(
      Array.from({ length: 30 }, (_, index) => `DEMO-${String(index + 1).padStart(3, '0')}`),
    );
  });

  it('contains at least ten Chinese cases and every required test slice', () => {
    expect(DEMO_CASES.filter(({ language }) => language === 'zh-CN').length).toBeGreaterThanOrEqual(10);
    const tags = new Set(DEMO_CASES.flatMap(({ sliceTags }) => sliceTags));
    requiredTags.forEach((tag) => expect(tags.has(tag), tag).toBe(true));
  });

  it('has human ground truth for every approved question', () => {
    DEMO_CASES.forEach((fixture) => {
      expect(Object.keys(fixture.groundTruth).sort()).toEqual([...questionIds].sort());
    });
  });

  it('contains no secrets, authorization headers, real email domains, or non-demo order IDs', () => {
    const serialized = JSON.stringify(DEMO_CASES);
    expect(serialized).not.toContain('AI_GATEWAY_API_KEY');
    expect(serialized).not.toMatch(/authorization/i);
    expect(serialized).not.toMatch(/@(gmail|yahoo|outlook|icloud|qq|163)\./i);
    DEMO_CASES.forEach(({ order }) => expect(order.id).toMatch(/^DEMO-/));
  });

  it('looks up a fixture without accepting path-like identifiers', () => {
    expect(getDemoCase('DEMO-001')?.id).toBe('DEMO-001');
    expect(getDemoCase('../../.env.local')).toBeUndefined();
  });
});
