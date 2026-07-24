// components/dashboard/AddTeamMemberModal.jsx
import { useState } from 'react';

export default function AddTeamMemberModal({ error, onSave, onClose }) {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSaving(true);
    const result = await onSave({
      full_name: fullName.trim(),
      role: role.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
    });
    setSaving(false);
    if (result?.ok) onClose();
  }

  return (
    <div className="dashboard-modal-overlay" onClick={onClose}>
      <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add team member</h3>

        {error && <p className="dashboard-modal-error">{error}</p>}

        <form onSubmit={submit}>
          <fieldset disabled={saving} className="dashboard-modal-fields">
            <label>Full name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label>Role
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Assistant, Junior agent"
              />
            </label>
            <label>Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label>Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </fieldset>

          <div className="dashboard-modal-actions">
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add member'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}