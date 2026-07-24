// components/dashboard/ProfileSection.jsx
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import '../../styles/ProfileSection.css';

export default function ProfileSection() {
  const { profile, refreshProfile } = useAuth(); // adjust if your AuthContext exposes a different refresh method
  const [values, setValues] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    agency_name: profile?.agency_name || '',
    website: profile?.website || '',
    country: profile?.country || '',
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { ok: bool, message: string }

  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState(null);

  const set = (field, val) => setValues((v) => ({ ...v, [field]: val }));
  const setPw = (field, val) => setPasswordForm((v) => ({ ...v, [field]: val }));

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const { error } = await supabase
      .schema('marketplace')
      .from('profiles')
      .update({
        full_name: values.full_name,
        phone: values.phone,
        agency_name: values.agency_name || null,
        website: values.website || null,
        country: values.country || null,
      })
      .eq('id', profile.id);

    setSaving(false);
    if (error) {
      setStatus({ ok: false, message: error.message });
    } else {
      setStatus({ ok: true, message: 'Profile updated.' });
      if (typeof refreshProfile === 'function') refreshProfile();
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordStatus(null);

    if (!passwordForm.current) {
      setPasswordStatus({ ok: false, message: 'Enter your current password.' });
      return;
    }
    if (passwordForm.next.length < 8) {
      setPasswordStatus({ ok: false, message: 'New password must be at least 8 characters.' });
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordStatus({ ok: false, message: "New passwords don't match." });
      return;
    }
    if (passwordForm.next === passwordForm.current) {
      setPasswordStatus({ ok: false, message: 'New password must be different from the current one.' });
      return;
    }

    setChangingPassword(true);

    // Supabase's updateUser() doesn't check the old password on its own —
    // it just swaps in whatever you send. So we first re-authenticate with
    // the current password via a real sign-in attempt; if that succeeds,
    // we know it's genuinely correct before touching anything.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: passwordForm.current,
    });

    if (verifyError) {
      setChangingPassword(false);
      setPasswordStatus({ ok: false, message: 'Current password is incorrect.' });
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: passwordForm.next,
    });

    setChangingPassword(false);

    if (updateError) {
      setPasswordStatus({ ok: false, message: updateError.message });
    } else {
      setPasswordStatus({ ok: true, message: 'Password changed.' });
      setPasswordForm({ current: '', next: '', confirm: '' });
    }
  }

  return (
    <div className="profile-section">
      <form className="profile-form" onSubmit={handleSave}>
        <div className="profile-form-row">
          <label>Full name
            <input value={values.full_name} onChange={(e) => set('full_name', e.target.value)} required />
          </label>
          <label>Phone
            <input value={values.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+254…" />
          </label>
        </div>

        <label>Email
          <input value={profile?.email || ''} disabled />
        </label>
        <p className="profile-form-hint">Email can't be changed here — contact support if it needs updating.</p>

        <div className="profile-form-row">
          <label>Agency name <span className="profile-form-optional">(optional)</span>
            <input value={values.agency_name} onChange={(e) => set('agency_name', e.target.value)} />
          </label>
          <label>Website <span className="profile-form-optional">(optional)</span>
            <input value={values.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" />
          </label>
        </div>

        <label>Country
          <input value={values.country} onChange={(e) => set('country', e.target.value)} />
        </label>

        {status && (
          <p className={status.ok ? 'profile-form-success' : 'profile-form-error'}>{status.message}</p>
        )}

        <div className="profile-form-actions">
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>

      <div className="profile-section-divider" />

      <div className="profile-password-block">
        <h3 className="settings-block-title">Change password</h3>
        <form className="profile-form" onSubmit={handleChangePassword}>
          <label>Current password
            <input
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPw('current', e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <div className="profile-form-row">
            <label>New password
              <input
                type="password"
                value={passwordForm.next}
                onChange={(e) => setPw('next', e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label>Confirm new password
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPw('confirm', e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          </div>

          {passwordStatus && (
            <p className={passwordStatus.ok ? 'profile-form-success' : 'profile-form-error'}>{passwordStatus.message}</p>
          )}

          <div className="profile-form-actions">
            <button type="submit" disabled={changingPassword}>
              <Lock size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              {changingPassword ? 'Verifying…' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}