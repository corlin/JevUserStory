import type { CaseFixture } from '../src/domain/types';
import { StatusBadge } from './ui/status-badge';

export function CaseFacts({ caseFixture }: { caseFixture: CaseFixture }) {
  const payment = caseFixture.payments[0];
  return (
    <div className="facts-stack">
      <section className="customer-message" aria-labelledby="customer-message-title">
        <div className="section-kicker">
          <span id="customer-message-title">Customer message</span>
          <StatusBadge tone="info">{caseFixture.language}</StatusBadge>
        </div>
        <blockquote>“{caseFixture.customer.message}”</blockquote>
        <p className="customer-meta">{caseFixture.customer.name} · {caseFixture.customer.tier} tier</p>
      </section>

      <section className="fact-section" aria-labelledby="order-title">
        <div className="section-heading-row">
          <div><p className="section-kicker">Commerce record</p><h2 id="order-title">Order facts</h2></div>
          <StatusBadge tone="success">Verified fixture</StatusBadge>
        </div>
        <dl className="fact-grid">
          <div><dt>Order</dt><dd>{caseFixture.order.id}</dd></div>
          <div><dt>Total</dt><dd>${(caseFixture.order.totalCents / 100).toFixed(2)} {caseFixture.order.currency}</dd></div>
          <div><dt>Item</dt><dd>{caseFixture.order.itemSummary}</dd></div>
          <div><dt>Payment</dt><dd>{payment ? `${payment.status} · $${(payment.amountCents / 100).toFixed(2)}` : 'No payment'}</dd></div>
          <div><dt>Shipment</dt><dd>{caseFixture.shipment.status.replaceAll('_', ' ')}</dd></div>
          <div><dt>Delay</dt><dd>{caseFixture.shipment.delayDays} days</dd></div>
        </dl>
      </section>

      <section className="policy-excerpt" aria-labelledby="policy-title">
        <p className="section-kicker">Policy excerpt</p>
        <h2 id="policy-title">Refund policy</h2>
        <p>{caseFixture.refundPolicy}</p>
      </section>
    </div>
  );
}
