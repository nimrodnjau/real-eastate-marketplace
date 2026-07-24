import { useState } from 'react';
import '../../styles/AgentProfileFormModal.css';

export default function ProfileFormModal({ profile, error, onSave, onClose }) {
  const [values, setValues] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    agency_name: profile?.agency_name || '',
    license_number: profile?.license_number || '',
    bio: profile?.bio || '',
  });
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const result = await onSave(values);
    setSaving(false);
    if (result?.ok) onClose();
  }

 return (
  <div className="profile-form-overlay" onClick={onClose}>
    <div className="profile-form-modal" onClick={(e) => e.stopPropagation()}>
      <h2>Edit profile</h2>
      {error && <p className="dashboard-error">{error}</p>}
      <form onSubmit={handleSubmit} className="profile-form">
        <label>
          Full name
          <input
            value={values.full_name}
            onChange={(e) => update('full_name', e.target.value)}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={values.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </label>
        <label>
          Phone
          <input
            value={values.phone}
            onChange={(e) => update('phone', e.target.value)}
          />
        </label>
        <label>
          Agency name
          <input
            value={values.agency_name}
            onChange={(e) => update('agency_name', e.target.value)}
          />
        </label>
        <label>
          License number
          <input
            value={values.license_number}
            onChange={(e) => update('license_number', e.target.value)}
          />
        </label>
        <label>
          Bio
          <textarea
            rows={4}
            value={values.bio}
            onChange={(e) => update('bio', e.target.value)}
          />
        </label>

        <div className="profile-form-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  </div>
);
}