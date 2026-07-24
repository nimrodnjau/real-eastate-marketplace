// components/dashboard/SettingsSection.jsx
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/SettingsSection.css';

export default function SettingsSection() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  async function handlePasswordChange(e) {
    e.preventDefault();
    setStatus(null);

    if (newPassword.length < 8) {
      setStatus({ ok: false, message: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ ok: false, message: "Passwords don't match." });
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (error) {
      setStatus({ ok: false, message: error.message });
    } else {
      setStatus({ ok: true, message: 'Password updated.' });
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  return (
    <div className="settings-section">
      <div className="settings-block">
        <h3 className="settings-block-title">Change password</h3>
        <form onSubmit={handlePasswordChange} className="profile-form">
          <label>New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <label>Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {status && (
            <p className={status.ok ? 'profile-form-success' : 'profile-form-error'}>{status.message}</p>
          )}
          <div className="profile-form-actions">
            <button type="submit" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button>
          </div>
        </form>
      </div>

      <div className="settings-block settings-block--danger">
        <h3 className="settings-block-title">Danger zone</h3>
        <p className="settings-block-desc">
          Need to close your account? Contact support — account deletion isn't self-serve yet since it
          needs to check for active listings, pending sales, and escrow balances first.
        </p>
      </div>
    </div>
  );
}