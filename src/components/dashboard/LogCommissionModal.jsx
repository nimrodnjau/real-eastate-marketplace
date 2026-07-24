// components/dashboard/LogCommissionModal.jsx
import { useState } from 'react';

const TYPE_LABEL = {
  sale: 'Sale',
  lease: 'Lease',
  referral: 'Referral',
};

export default function LogCommissionModal({ listings, error, onSave, onClose }) {
  const [listingId, setListingId] = useState(listings?.[0]?.id || '');
  const [type, setType] = useState('sale');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!amount || Number(amount) < 0) return;
    setSaving(true);
    const result = await onSave({ listing_id: listingId || null, type, amount: Number(amount) });
    setSaving(false);
    if (result?.ok) onClose();
  }

  return (
    <div className="dashboard-modal-overlay" onClick={onClose}>
      <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Log commission</h3>
        <p className="dashboard-modal-hint">
          Record a commission you've earned so you can track it through to payout.
        </p>

        {error && <p className="dashboard-modal-error">{error}</p>}

        <form onSubmit={submit}>
          <fieldset disabled={saving} className="dashboard-modal-fields">
            <label>Listing (optional)
              <select value={listingId} onChange={(e) => setListingId(e.target.value)}>
                <option value="">Not tied to a specific listing</option>
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </label>

            <label>Type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label>Amount (KES)
              <input
                type="number" min="0" step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
          </fieldset>

          <div className="dashboard-modal-actions">
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Log commission'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}