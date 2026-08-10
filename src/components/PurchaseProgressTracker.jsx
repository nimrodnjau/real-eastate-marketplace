import { Check } from 'lucide-react';
import '../styles/purchaseProgressTracker.css';

export const TRANSACTION_STAGES = [
  { key: 'connect', label: 'Connect', description: 'Reach agent or landlord' },
  { key: 'negotiation', label: 'Negotiation', description: 'Offers and terms' },
  { key: 'documents', label: 'Documents', description: 'Prepare purchase documents' },
  { key: 'payment', label: 'Payment', description: 'Funds secured in escrow' },
  { key: 'verification', label: 'Verification', description: 'Verify documents and payment' },
  { key: 'closed', label: 'Closed', description: 'Funds released and deal closed' },
  { key: 'taxation', label: 'Taxation', description: 'Taxes remitted' },
  { key: 'archived', label: 'Record', description: 'Records stored securely' },
];

/**
 * PurchaseProgressTracker
 *
 * Horizontal tracker for the 8-stage transaction flow.
 *
 * Props:
 *   currentStage - one of the TRANSACTION_STAGES keys
 */
export default function PurchaseProgressTracker({ currentStage }) {
  const currentIndex = TRANSACTION_STAGES.findIndex(
    (stage) => stage.key === currentStage
  );

  return (
    <ol className="purchase-tracker" aria-label="Purchase progress">
      {TRANSACTION_STAGES.map((stage, i) => {
        const status =
          i < currentIndex
            ? 'done'
            : i === currentIndex
              ? 'current'
              : 'upcoming';

        return (
          <li
            key={stage.key}
            className={`purchase-tracker-step purchase-tracker-step--${status}`}
          >
            <div className="purchase-tracker-node">
              <span className="purchase-tracker-node-circle">
                {status === 'done' ? <Check size={14} /> : i + 1}
              </span>

              {i < TRANSACTION_STAGES.length - 1 && (
                <span
                  className="purchase-tracker-connector"
                  aria-hidden="true"
                />
              )}
            </div>

            <div className="purchase-tracker-text">
              <p className="purchase-tracker-label">{stage.label}</p>
              <p className="purchase-tracker-description">
                {stage.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}