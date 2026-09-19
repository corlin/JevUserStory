import type { CaseFixture } from '../domain/types';

export function calculateVerifiedRefundCents(caseFixture: CaseFixture): number {
  const capturedCounts = new Map<number, number>();
  for (const payment of caseFixture.payments) {
    if (payment.status !== 'captured') continue;
    capturedCounts.set(payment.amountCents, (capturedCounts.get(payment.amountCents) ?? 0) + 1);
  }

  const duplicateAmounts = [...capturedCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([amount]) => amount)
    .filter((amount) => amount <= caseFixture.order.totalCents);
  return Math.max(0, ...duplicateAmounts);
}
