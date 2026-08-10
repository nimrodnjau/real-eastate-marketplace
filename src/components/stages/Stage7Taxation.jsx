// components/stages/Stage7Taxation.jsx
//
// Stage 7: Taxation. Stamp duty is calculated off the final price; staff
// files with KRA and records the reference once cleared, which advances
// to Archived.
//
// UI ONLY — mock state. No SQL exists yet for this stage.
// TODO(db): stamp duty rate (4% urban / 2% rural in Kenya) should be
//   configurable, not hardcoded — this mock assumes urban.
// TODO(db): file_tax_reference(p_transaction_id, p_kra_reference) — staff.
// TODO(db): mark_taxation_cleared(p_transaction_id) — staff; advances
//   stage to 'archived'.

import { useState } from 'react';
import { Receipt, Upload, CheckCircle2 } from 'lucide-react';
import StageWindow from './StageWindow';
import StageMessagePanel from './StageMessagePanel';
import '../../styles/stage7-taxation.css';

const STAMP_DUTY_RATE = 0.04; // urban rate — TODO(db): make configurable

function formatKES(amount) {
  return `KES ${Number(amount).toLocaleString()}`;
}

export default function Stage7Taxation({
  transactionId,
  listing,
  finalAmount,
  buyerId,
  agentId,
  sellerId,
  viewerId,
  viewerIsStaff = false, // TODO(db): replace with real role check
  onAdvanceStage,
}) {
  const price = finalAmount ?? listing?.price ?? 0;
  const stampDuty = Math.round(price * STAMP_DUTY_RATE);

  const [kraReference, setKraReference] = useState('');
  const [filedReference, setFiledReference] = useState(null);
  const [certificateUploaded, setCertificateUploaded] = useState(false);
  const [cleared, setCleared] = useState(false);

  function handleFileReference(e) {
    e.preventDefault();
    if (!kraReference.trim()) return;
    // TODO(db): marketplace.file_tax_reference(p_transaction_id, p_kra_reference: kraReference)
    setFiledReference(kraReference.trim());
  }

  function handleUploadCertificate() {
    // TODO(db): upload to storage + attach to transaction_documents (doc_type: 'tax_compliance_certificate')
    setCertificateUploaded(true);
  }

  function handleMarkCleared() {
    // TODO(db): marketplace.mark_taxation_cleared(p_transaction_id: transactionId)
    setCleared(true);
  }

  return (
    <StageWindow
      stageNumber={7}
      title="Taxation"
      subtitle="Stamp duty is filed with KRA before the record can be archived."
      isComplete={cleared}
      clearedTitle="Taxation cleared"
      clearedSubtitle="Moving to record storage."
      messagesSlot={
        <StageMessagePanel
          counterpart={{ name: 'Verification team', role: 'staff' }}
          viewerId={viewerId}
          mockMessages={[]}
        />
      }
    >
      <div className="stage7-duty-card">
        <div className="stage7-duty-icon">
          <Receipt size={18} />
        </div>
        <div>
          <p className="stage7-duty-label">Stamp duty due ({(STAMP_DUTY_RATE * 100).toFixed(0)}% of {formatKES(price)})</p>
          <p className="stage7-duty-value stage-amount">{formatKES(stampDuty)}</p>
        </div>
      </div>

      <hr className="stage-divider" />

      <section className="stage7-section">
        <h3 className="stage1-section-title">KRA filing reference</h3>
        {filedReference ? (
          <p className="stage-pill stage-pill--verified">Filed — ref {filedReference}</p>
        ) : viewerIsStaff ? (
          <form className="stage7-ref-form" onSubmit={handleFileReference}>
            <div className="stage-field" style={{ flex: 1, maxWidth: 280 }}>
              <label htmlFor="kra-ref">KRA reference number</label>
              <input
                id="kra-ref"
                type="text"
                value={kraReference}
                onChange={(e) => setKraReference(e.target.value)}
                placeholder="e.g. KRA-2026-889231"
              />
            </div>
            <button type="submit" className="stage-btn stage-btn--primary" disabled={!kraReference.trim()}>
              Record filing
            </button>
          </form>
        ) : (
          <p className="stage-empty">Waiting on our team to file with KRA.</p>
        )}
      </section>

      <hr className="stage-divider" />

      <section className="stage7-section">
        <h3 className="stage1-section-title">Tax compliance certificate</h3>
        {certificateUploaded ? (
          <p className="stage-pill stage-pill--verified">
            <CheckCircle2 size={12} /> Certificate on file
          </p>
        ) : viewerIsStaff ? (
          <button type="button" className="stage-btn stage-btn--ghost" onClick={handleUploadCertificate}>
            <Upload size={13} /> Upload certificate
          </button>
        ) : (
          <p className="stage-empty">Awaiting the compliance certificate from KRA.</p>
        )}
      </section>

      {viewerIsStaff && filedReference && certificateUploaded && !cleared && (
        <button type="button" className="stage-btn stage-btn--primary" style={{ marginTop: 18 }} onClick={handleMarkCleared}>
          Mark taxation cleared
        </button>
      )}
    </StageWindow>
  );
}