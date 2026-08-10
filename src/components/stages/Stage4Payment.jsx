// components/stages/Stage4Payment.jsx
//
// Stage 4: Payment. Buyer sends the agreed amount into escrow. Actual
// confirmation ("held") happens server-side via a payment-provider
// webhook hitting marketplace.confirm_escrow_payment — never directly
// from the client — so after initiating, the buyer sees a genuine
// "awaiting confirmation" state, not an instant fake success.
//
// UI ONLY — the mock simulates that webhook with a timeout so the state
// machine (pending -> initiated -> held) is reviewable end-to-end.
// TODO(db): initiate_escrow_payment(p_transaction_id, p_amount, p_currency)
//   on submit, then redirect/hand off to your actual payment provider.
// TODO(db): remove the setTimeout simulation entirely — "held" should
//   only ever be set by a realtime subscription on escrow_payments
//   reacting to the webhook-driven update, not by the client.

import { useState } from 'react';
import { Landmark, ShieldCheck, Clock } from 'lucide-react';
import StageWindow from './StageWindow';
import StageMessagePanel from './StageMessagePanel';
import '../../styles/stage4-payment.css';

function formatKES(amount) {
  return `KES ${Number(amount).toLocaleString()}`;
}

export default function Stage4Payment({
  transactionId,
  listing, // { title, price }
  agreedAmount, // final negotiated amount from Stage 2
  buyerId,
  agentId,
  sellerId,
  viewerId,
  onAdvanceStage,
}) {
  const isBuyer = viewerId === buyerId;
  const amount = agreedAmount ?? listing?.price ?? 0;

  const [status, setStatus] = useState('pending'); // pending | initiated | held

  function handlePay() {
    // TODO(db): marketplace.initiate_escrow_payment(...) then hand off to
    // provider checkout. The setTimeout below stands in for the webhook.
    setStatus('initiated');
    setTimeout(() => setStatus('held'), 2200);
  }

  const stageComplete = status === 'held';

  const timelineSteps = [
    { key: 'pending', label: 'Awaiting payment' },
    { key: 'initiated', label: 'Payment submitted' },
    { key: 'held', label: 'Held in escrow' },
  ];
  const currentIdx = timelineSteps.findIndex((s) => s.key === status);

  return (
    <StageWindow
      stageNumber={4}
      title="Payment"
      subtitle={`Send ${formatKES(amount)} into escrow. Funds stay held until our team verifies everything before disbursing.`}
      isComplete={stageComplete}
      clearedTitle="Funds held in escrow"
      clearedSubtitle="Moving to Verification."
      messagesSlot={
        <StageMessagePanel
          counterpart={{ name: 'Verification team', role: 'staff' }}
          viewerId={viewerId}
          mockMessages={[]}
        />
      }
    >
      <div className="stage4-amount-card">
        <div className="stage4-amount-icon">
          <Landmark size={20} />
        </div>
        <div>
          <p className="stage4-amount-label">Amount due into escrow</p>
          <p className="stage4-amount-value stage-amount">{formatKES(amount)}</p>
        </div>
      </div>

      <ol className="stage4-timeline">
        {timelineSteps.map((s, i) => (
          <li key={s.key} className={`stage4-timeline-step ${i <= currentIdx ? 'is-done' : ''} ${i === currentIdx ? 'is-current' : ''}`}>
            <span className="stage4-timeline-marker">
              {i < currentIdx ? '✓' : i === currentIdx && status === 'initiated' ? <Clock size={11} /> : i + 1}
            </span>
            <span className="stage4-timeline-label">{s.label}</span>
          </li>
        ))}
      </ol>

      {status === 'pending' && isBuyer && (
        <button type="button" className="stage-btn stage-btn--primary" onClick={handlePay}>
          Pay into escrow
        </button>
      )}

      {status === 'pending' && !isBuyer && (
        <p className="stage-empty">Waiting on the buyer to send payment.</p>
      )}

      {status === 'initiated' && (
        <p className="stage4-waiting">
          <Clock size={13} /> Confirming your payment with the provider — this updates automatically, no need to refresh.
        </p>
      )}

      {status === 'held' && (
        <p className="stage-pill stage-pill--verified">
          <ShieldCheck size={12} /> Funds confirmed and held in escrow
        </p>
      )}

      <p className="stage4-note">
        Funds are only released once our team verifies the title, documents, and every party's payout details in the next stage.
      </p>
    </StageWindow>
  );
}