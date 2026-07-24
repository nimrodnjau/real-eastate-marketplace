import { useState } from 'react';
import { ShieldCheck, Zap, X, ArrowRight } from 'lucide-react';
import AgentPickerModal from './AgentPickerModal';
import '../../styles/SubmitListingModal.css';

export default function SubmitListingModal({ listing, onClose, onConfirm }) {
  const [choice, setChoice] = useState(null); // 'agent' | 'direct'
  const [step, setStep] = useState('choose'); // 'choose' | 'pick-agent'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit(viaAgent, agentId) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await onConfirm(viaAgent, agentId);
    setSubmitting(false);
    if (!result?.ok) setError(result?.error || 'Something went wrong. Please try again.');
  }

  function handleConfirmClick() {
    if (!choice) return;
    if (choice === 'agent') setStep('pick-agent');
    else submit(false, null);
  }

  if (step === 'pick-agent') {
    return (
      <AgentPickerModal
        onBack={() => setStep('choose')}
        onClose={onClose}
        onSelect={(agent) => submit(true, agent.id)}
      />
    );
  }

  return (
    <div className="sbl-overlay" onClick={onClose}>
      <div className="sbl-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sbl-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <h2 className="sbl-title">How do you want to list "{listing.title}"?</h2>
        <p className="sbl-subtitle">Choose how this property goes live. You can change this later.</p>

        <div className="sbl-options">
          <button
            type="button"
            className={`sbl-option ${choice === 'agent' ? 'sbl-option--selected' : ''}`}
            onClick={() => setChoice('agent')}
          >
            <ShieldCheck size={22} className="sbl-option-icon" />
            <span className="sbl-option-title">List via an agent</span>
            <span className="sbl-option-desc">
              Pick an agent to verify the property before it goes live. Verified listings carry a trust badge.
            </span>
          </button>

          <button
            type="button"
            className={`sbl-option ${choice === 'direct' ? 'sbl-option--selected' : ''}`}
            onClick={() => setChoice('direct')}
          >
            <Zap size={22} className="sbl-option-icon" />
            <span className="sbl-option-title">List without an agent</span>
            <span className="sbl-option-desc">
              Goes live immediately, but shows an "Unverified" watermark until it's reviewed.
            </span>
          </button>
        </div>

        {error && <p className="sbl-error">{error}</p>}

        <div className="sbl-actions">
          <button type="button" className="sbl-cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="sbl-confirm" onClick={handleConfirmClick} disabled={!choice || submitting}>
            {submitting ? 'Submitting…' : choice === 'agent' ? (<>Choose an agent <ArrowRight size={14} /></>) : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}