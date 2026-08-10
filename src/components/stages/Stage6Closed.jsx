// components/stages/Stage6Closed.jsx
//
// Stage 6: Closed. The deal is done — this is the closing summary, plus
// the buyer confirming they've received keys/access before we move to
// Taxation (stamp duty still needs filing after closing, so taxation
// follows rather than precedes this).
//
// UI ONLY — mock state. No SQL exists yet for this stage.
// TODO(db): confirm_key_handover(p_transaction_id) — buyer only.
// TODO(db): closing summary fields (final_amount, closed_at) should come
//   from the transaction/escrow_payments rows, not be recomputed here.

import { useState } from 'react';
import { Home, Calendar, Key, Banknote } from 'lucide-react';
import StageWindow from './StageWindow';
import StageMessagePanel from './StageMessagePanel';
import '../../styles/stage6-closed.css';

function formatKES(amount) {
  return `KES ${Number(amount).toLocaleString()}`;
}

export default function Stage6Closed({
  transactionId,
  listing, // { title, address }
  finalAmount,
  closedAt = new Date().toISOString(),
  buyerId,
  agentId,
  sellerId,
  viewerId,
  onAdvanceStage,
}) {
  const isBuyer = viewerId === buyerId;
  const [handoverConfirmed, setHandoverConfirmed] = useState(false);

  function handleConfirmHandover() {
    // TODO(db): marketplace.confirm_key_handover(p_transaction_id: transactionId)
    setHandoverConfirmed(true);
  }

  return (
    <StageWindow
      stageNumber={6}
      title="Closed"
      subtitle={`${listing?.title || 'This property'} has changed hands. Confirm handover to continue to tax filing.`}
      isComplete={handoverConfirmed}
      clearedTitle="Handover confirmed"
      clearedSubtitle="Moving to Taxation."
      messagesSlot={
        <StageMessagePanel
          counterpart={{ name: isBuyer ? 'Seller' : 'Buyer', role: isBuyer ? 'seller' : 'buyer' }}
          viewerId={viewerId}
          mockMessages={[]}
        />
      }
    >
      <div className="stage6-summary">
        <div className="stage6-summary-row">
          <Home size={16} />
          <div>
            <p className="stage6-summary-label">Property</p>
            <p className="stage6-summary-value">{listing?.title}</p>
            {listing?.address && <p className="stage6-summary-sub">{listing.address}</p>}
          </div>
        </div>
        <div className="stage6-summary-row">
          <Banknote size={16} />
          <div>
            <p className="stage6-summary-label">Final price</p>
            <p className="stage6-summary-value stage-amount">{formatKES(finalAmount ?? listing?.price ?? 0)}</p>
          </div>
        </div>
        <div className="stage6-summary-row">
          <Calendar size={16} />
          <div>
            <p className="stage6-summary-label">Closing date</p>
            <p className="stage6-summary-value">
              {new Date(closedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      <hr className="stage-divider" />

      <section className="stage6-handover">
        <h3 className="stage1-section-title">Key handover</h3>
        {handoverConfirmed ? (
          <p className="stage-pill stage-pill--verified">
            <Key size={12} /> Handover confirmed
          </p>
        ) : isBuyer ? (
          <>
            <p className="stage1-section-hint">Confirm once you've received the keys and access to the property.</p>
            <button type="button" className="stage-btn stage-btn--primary" onClick={handleConfirmHandover}>
              Confirm I've received the keys
            </button>
          </>
        ) : (
          <p className="stage-empty">Waiting on the buyer to confirm key handover.</p>
        )}
      </section>
    </StageWindow>
  );
}