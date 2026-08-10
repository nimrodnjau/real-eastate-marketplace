import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseclient'; // ADJUST to your actual client path
import { IconUser } from './Icons';

export default function ProfileCredentialsSection({ userId, roleConfig }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profileRow, setProfileRow] = useState(null);
  const [form, setForm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .schema('marketplace')
        .from('service_provider_profiles')
        .select(`
          *,
          profiles:profiles!service_provider_profiles_user_id_fkey ( full_name, phone )
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      function credentialFieldsFromRow(row) {
        const out = {};
        for (const field of roleConfig.credentialFields) {
          out[field.key] = row?.[field.key] || '';
        }
        return out;
      }

      if (err) {
        setError(err.message);
        setProfileRow(null);
        setForm({
          full_name: '',
          phone: '',
          bio: '',
          ...credentialFieldsFromRow(null),
        });
      } else {
        const row = data || { user_id: userId, provider_type: roleConfig.role, profiles: {} };
        setProfileRow(row);
        setForm({
          full_name: row.profiles?.full_name || '',
          phone: row.profiles?.phone || '',
          bio: row.bio || '',
          ...credentialFieldsFromRow(row),
        });
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, roleConfig.role, roleConfig.credentialFields]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateCredential(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const credentialPayload = {};
    for (const field of roleConfig.credentialFields) {
      credentialPayload[field.key] = form[field.key];
    }

    const [profileRes, providerRes] = await Promise.all([
      supabase
        .schema('marketplace')
        .from('profiles')
        .update({ full_name: form.full_name, phone: form.phone })
        .eq('id', userId),
      supabase
        .schema('marketplace')
        .from('service_provider_profiles')
        .upsert(
          { user_id: userId, provider_type: roleConfig.role, bio: form.bio, ...credentialPayload },
          { onConflict: 'user_id' }
        )
        .select('*, profiles:profiles!service_provider_profiles_user_id_fkey ( full_name, phone )')
        .single(),
    ]);

    setSaving(false);

    if (profileRes.error) {
      setError(profileRes.error.message);
      return;
    }
    if (providerRes.error) {
      setError(providerRes.error.message);
      return;
    }

    setProfileRow(providerRes.data);
    setEditing(false);
  }

  if (loading) return <div className="pd-loading">Loading profile…</div>;
  if (!form) return <div className="pd-error">{error || 'Could not load profile.'}</div>;

  const status = profileRow?.verification_status || 'pending';
  const isVerified = status === 'verified';

  return (
    <div>
      {error && <div className="pd-error">{error}</div>}

      <div className="pd-card" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div className={`pd-seal ${isVerified ? '' : 'pending'}`}>
          <div className="pd-seal-inner">{isVerified ? 'Verified\nProfessional' : 'Pending\nReview'}</div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="pd-card-head" style={{ marginBottom: 4 }}>
            <div>
              <h2>{form.full_name || 'Your profile'}</h2>
              <div className="pd-card-sub">{roleConfig.label} · UIP Real Estate marketplace</div>
            </div>
            <span className={`pd-badge ${isVerified ? 'success' : 'warn'}`}>
              {isVerified ? 'Verified' : 'Pending review'}
            </span>
          </div>
          {!isVerified && (
            <p className="pd-hint">
              Clients can see and message you once your credentials below are reviewed and verified.
            </p>
          )}
        </div>
      </div>

      <div className="pd-card">
        <div className="pd-card-head">
          <div>
            <h2>Profile details</h2>
            <div className="pd-card-sub">What clients see when they view your listing.</div>
          </div>
          {!editing ? (
            <button className="pd-btn pd-btn-ghost" onClick={() => setEditing(true)}>
              <IconUser width={15} height={15} /> Edit
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pd-btn pd-btn-ghost" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
              <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>

        <div className="pd-grid-2">
          <div className="pd-field">
            <label htmlFor="pd-full-name">Full name</label>
            <input
              id="pd-full-name"
              className="pd-input"
              disabled={!editing}
              value={form.full_name}
              onChange={(e) => updateField('full_name', e.target.value)}
            />
          </div>
          <div className="pd-field">
            <label htmlFor="pd-phone">Phone (Kenyan number)</label>
            <input
              id="pd-phone"
              className="pd-input"
              placeholder="07XX XXX XXX"
              disabled={!editing}
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>
        </div>

        <div className="pd-field">
          <label htmlFor="pd-bio">Bio</label>
          <textarea
            id="pd-bio"
            className="pd-textarea"
            rows={3}
            disabled={!editing}
            placeholder="A short introduction clients will see on your profile."
            value={form.bio}
            onChange={(e) => updateField('bio', e.target.value)}
          />
        </div>
      </div>

      <div className="pd-card">
        <div className="pd-card-head">
          <div>
            <h2>Credentials</h2>
            <div className="pd-card-sub">Reviewed manually before your profile is marked verified.</div>
          </div>
        </div>

        <div className="pd-grid-2">
          {roleConfig.credentialFields.map((field) => (
            <div className="pd-field" key={field.key}>
              <label htmlFor={`pd-cred-${field.key}`}>{field.label}</label>
              <input
                id={`pd-cred-${field.key}`}
                className={`pd-input ${field.mono ? 'mono' : ''}`}
                disabled={!editing}
                value={form[field.key] || ''}
                onChange={(e) => updateCredential(field.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}