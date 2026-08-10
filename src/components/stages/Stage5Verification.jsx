// components/stages/Stage5Verification.jsx
//
// Stage 5: Verification. Before any money leaves escrow, the platform
// team confirms the checklist and the payout amount for every
// beneficiary (seller, agent, and the three engaged professionals).
// Approving disbursement advances to Closed.
//
// UI ONLY — mock state. No SQL exists yet for this stage; the RPC names
// below (confirm_beneficiary_payout, approve_disbursement) are proposed,
// not settled — confirm the real shape when we do the DB pass for 5-8.
// TODO(db): confirm_beneficiary_payout(p_transaction_id, p_beneficiary_id)
// TODO(db): approve_disbursement(p_transaction_id) — staff only; should
//   mark escrow_payments.status = 'released' and advance stage to
//   'closed' in the same transaction server-side.

import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import StageWindow from './StageWindow';
import StageMessagePanel from './StageMessagePanel';
import '../../styles/stage5-verification.css';

function formatKES(amount) {
  return `KES ${Number(amount).toLocaleString()}`;
}

const CHECKLIST = [
  { key: 'payment_held', label: 'Payment confirmed held in escrow' },
  { key: 'documents_verified', label: 'All property documents verified' },
  { key: 'title_clear', label: 'Title search re-confirmed clear at closing' },
];

const MOCK_BENEFICIARIES = [
  { id: 'b1', name: 'Seller — Jane Njoroge', role: 'Seller proceeds', amount: 7900000 },
  { id: 'b2', name: 'Otieno & Co.', role: 'Agent commission', amount: 237000 },
  { id: 'b3', name: 'Wanjiru & Associates', role: 'Legal fee', amount: 80000 },
  { id: 'b4', name: 'Kamau Valuations', role: 'Valuation fee', amount: 25000 },
  { id: 'b5', name: 'Mutiso Land Surveys', role: 'Survey fee', amount: 30000 },
];

export default function Stage5Verification({
  transactionId,
  listing,
  buyerId,
  agentId,
  sellerId,
  viewerId,
  viewerIsStaff = false, // TODO(db): replace with real role check
  onAdvanceStage,
}) {
  const [checklist, setChecklist] = useState(() =>
    CHECKLIST.reduce((acc, c) => ({ ...acc, [c.key]: c.key !== 'title_clear' }), {})
  );
  const [confirmedPayouts, setConfirmedPayouts] = useState({});
  const [disbursed, setDisbursed] = useState(false);

  const allChecked = CHECKLIST.every((c) => checklist[c.key]);
  const allPayoutsConfirmed = MOCK_BENEFICIARIES.every((b) => confirmedPayouts[b.id]);
  const readyToDisburse = allChecked && allPayoutsConfirmed;
  const stageComplete = disbursed;

  function toggleChecklistItem(key) {
    if (!viewerIsStaff) return;
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function confirmPayout(id) {
    // TODO(db): marketplace.confirm_beneficiary_payout(p_transaction_id: transactionId, p_beneficiary_id: id)
    setConfirmedPayouts((prev) => ({ ...prev, [id]: true }));
  }

  function handleApproveDisbursement() {
    if (!readyToDisburse) return;
    // TODO(db): marketplace.approve_disbursement(p_transaction_id: transactionId)
    setDisbursed(true);
  }

  const total = MOCK_BENEFICIARIES.reduce((sum, b) => sum + b.amount, 0);

  return (
    <StageWindow
      stageNumber={5}
      title="Verification"
      subtitle="Our team confirms every detail and payout before releasing funds from escrow."
      isComplete={stageComplete}
      clearedTitle="Disbursement approved"
      clearedSubtitle="Funds released. Moving to Closed."
      messagesSlot={
        <StageMessagePanel
          counterpart={{ name: 'Verification team', role: 'staff' }}
          viewerId={viewerId}
          mockMessages={[]}
        />
      }
    >
      {!stageComplete && (
        <>
          <section className="stage5-section">
            <h3 className="stage1-section-title">Checklist</h3>
            <ul className="stage5-checklist">
              {CHECKLIST.map((c) => (
                <li
                  key={c.key}
                  className={`stage5-checklist-item ${checklist[c.key] ? 'is-checked' : ''} ${viewerIsStaff ? 'is-clickable' : ''}`}
                  onClick={() => toggleChecklistItem(c.key)}
                >
                  {checklist[c.key] ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  {c.label}
                </li>
              ))}
            </ul>
            {!viewerIsStaff && (
              <p className="stage-empty">Our team is confirming these — no action needed from you here.</p>
            )}
          </section>

          <hr className="stage-divider" />

          <section className="stage5-section">
            <h3 className="stage1-section-title">Payouts</h3>
            <ul className="stage5-payout-list">
              {MOCK_BENEFICIARIES.map((b) => (
                <li key={b.id} className="stage5-payout-row">
                  <div className="stage5-payout-main">
                    <p className="stage5-payout-name">{b.name}</p>
                    <p className="stage5-payout-role">{b.role}</p>
                  </div>
                  <span className="stage5-payout-amount stage-amount">{formatKES(b.amount)}</span>
                  {confirmedPayouts[b.id] ? (
                    <span className="stage-pill stage-pill--verified">confirmed</span>
                  ) : viewerIsStaff ? (
                    <button type="button" className="stage-btn stage-btn--ghost" onClick={() => confirmPayout(b.id)}>
                      Confirm
                    </button>
                  ) : (
                    <span className="stage-pill stage-pill--pending">pending</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="stage5-total-row">
              <span>Total to disburse</span>
              <span className="stage-amount">{formatKES(total)}</span>
            </div>
          </section>

          {viewerIsStaff && (
            <button
              type="button"
              className="stage-btn stage-btn--primary"
              style={{ marginTop: 18 }}
              disabled={!readyToDisburse}
              onClick={handleApproveDisbursement}
            >
              Approve &amp; disburse
            </button>
          )}
        </>
      )}
    </StageWindow>
  );
}