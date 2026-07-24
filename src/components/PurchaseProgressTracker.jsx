import { Check } from 'lucide-react';
import '../styles/purchaseProgressTracker.css';

export const TRANSACTION_STAGES = [
  { key: 'connect', label: 'Connect', description: 'Reach agent or landlord' },
  { key: 'engage_pros', label: 'Engage pros', description: 'Lawyer, valuer, surveyor' },
  { key: 'negotiate', label: 'Negotiate', description: 'Offers and terms' },
  { key: 'doc_verify', label: 'Doc & verify', description: 'Prepare and verify docs' },
  { key: 'pay_escrow', label: 'Pay & escrow', description: 'Funds secured' },
  { key: 'close_deal', label: 'Close deal', description: 'Funds released' },
  { key: 'payout_tax', label: 'Payout & tax', description: 'Taxes remitted' },
  { key: 'complete', label: 'Complete', description: 'Records stored' },
];

/**
 * PurchaseProgressTracker
 *
 * Horizontal step tracker for the 9-stage transaction flow (Search is
 * implicit — it's over by the time a `transactions` row exists, since
 * that row is only created once a buyer moves into "Connect").
 *
 * Props:
 *   currentStage - one of the TRANSACTION_STAGES keys
 */
export default function PurchaseProgressTracker({ currentStage }) {
  const currentIndex = TRANSACTION_STAGES.findIndex((s) => s.key === currentStage);

  return (
    <ol className="purchase-tracker" aria-label="Purchase progress">
      {TRANSACTION_STAGES.map((stage, i) => {
        const status = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
        return (
          <li key={stage.key} className={`purchase-tracker-step purchase-tracker-step--${status}`}>
            <div className="purchase-tracker-node">
              <span className="purchase-tracker-node-circle">
                {status === 'done' ? <Check size={14} /> : i + 1}
              </span>
              {i < TRANSACTION_STAGES.length - 1 && (
                <span className="purchase-tracker-connector" aria-hidden="true" />
              )}
            </div>
            <div className="purchase-tracker-text">
              <p className="purchase-tracker-label">{stage.label}</p>
              <p className="purchase-tracker-description">{stage.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}