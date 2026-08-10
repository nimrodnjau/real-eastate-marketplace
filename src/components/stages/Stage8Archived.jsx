// components/stages/Stage8Archived.jsx
//
// Stage 8: Archived. Terminal stage — a read-only record of the whole
// transaction: the stage-by-stage timeline, the document bundle, and the
// final figures. No actions happen here besides downloading the record.
//
// UI ONLY — mock timeline/documents.
// TODO(db): timeline dates should come from a real audit trail (e.g. a
//   transaction_stage_history table logging each advance_transaction_stage
//   call with a timestamp), not be inferred client-side.
// TODO(db): "Download full record" should bundle transaction_documents +
//   a generated closing statement server-side (edge function), not zip
//   files client-side.

import { Archive, Download, FileText } from 'lucide-react';
import StageWindow from './StageWindow';
import '../../styles/stage8-archived.css';

function formatKES(amount) {
  return `KES ${Number(amount).toLocaleString()}`;
}

const MOCK_TIMELINE = [
  { stage: 'Connect', date: '2026-07-20' },
  { stage: 'Negotiation', date: '2026-07-30' },
  { stage: 'Documents', date: '2026-08-04' },
  { stage: 'Payment', date: '2026-08-08' },
  { stage: 'Verification', date: '2026-08-10' },
  { stage: 'Closed', date: '2026-08-11' },
  { stage: 'Taxation', date: '2026-08-18' },
  { stage: 'Archived', date: '2026-08-19' },
];

const MOCK_DOCUMENTS = [
  'Title Deed',
  'Land Rates Clearance Certificate',
  'Official Land Search',
  'Seller Identification',
  'Sale Agreement',
  'Tax Compliance Certificate',
];

export default function Stage8Archived({
  transactionId,
  listing, // { title, address }
  finalAmount,
}) {
  return (
    <StageWindow
      stageNumber={8}
      title="Record"
      subtitle={`This transaction is complete and stored. Everything on ${listing?.title || 'this property'} lives here permanently.`}
      isComplete
      clearedTitle="Transaction archived"
      clearedSubtitle="This record is permanent and read-only."
    >
      <div className="stage8-final-card">
        <Archive size={18} />
        <div>
          <p className="stage8-final-label">Final sale price</p>
          <p className="stage8-final-value stage-amount">{formatKES(finalAmount ?? listing?.price ?? 0)}</p>
        </div>
      </div>

      <hr className="stage-divider" />

      <section className="stage8-section">
        <h3 className="stage1-section-title">Timeline</h3>
        <ol className="stage8-timeline">
          {MOCK_TIMELINE.map((t) => (
            <li key={t.stage} className="stage8-timeline-row">
              <span className="stage8-timeline-dot" />
              <span className="stage8-timeline-stage">{t.stage}</span>
              <span className="stage8-timeline-date">
                {new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <hr className="stage-divider" />

      <section className="stage8-section">
        <h3 className="stage1-section-title">Documents on file</h3>
        <ul className="stage8-doc-list">
          {MOCK_DOCUMENTS.map((d) => (
            <li key={d} className="stage8-doc-row">
              <FileText size={14} />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </section>

      <button type="button" className="stage-btn stage-btn--primary" style={{ marginTop: 18 }}>
        <Download size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
        Download full record
      </button>
    </StageWindow>
  );
}