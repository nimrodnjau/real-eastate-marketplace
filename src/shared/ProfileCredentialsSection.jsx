import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseclient';
import { uploadAvatarToR2 } from '../api/uploads';
import LocationPickerModal from '../components/dashboard/LocationPicker';
import { MapPin } from 'lucide-react';
import { IconUser } from './Icons';

export default function ProfileCredentialsSection({ userId, roleConfig }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profileRow, setProfileRow] = useState(null);
  const [form, setForm] = useState(null);

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [location, setLocation] = useState({ lat: null, lng: null });

  // NEW: set roleConfig.supportsLocation = true (in your roleConfigs.js) only
  // after confirming service_provider_profiles actually has location_lat /
  // location_lng columns — otherwise the upsert below will error on save.
  const supportsLocation = !!roleConfig?.supportsLocation;

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
          profiles:profiles!service_provider_profiles_user_id_fkey ( full_name, phone, avatar_url )
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
        setAvatarPreview(null);
        setLocation({ lat: null, lng: null });
      } else {
        const row = data || { user_id: userId, provider_type: roleConfig.role, profiles: {} };
        setProfileRow(row);
        setForm({
          full_name: row.profiles?.full_name || '',
          phone: row.profiles?.phone || '',
          bio: row.bio || '',
          ...credentialFieldsFromRow(row),
        });
        setAvatarPreview(row.profiles?.avatar_url || null);
        setLocation({ lat: row.location_lat ?? null, lng: row.location_lng ?? null });
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, roleConfig.role, roleConfig.credentialFields?.map((f) => f.key).join(',')]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateCredential(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function cancelEditing() {
    setEditing(false);
    setAvatarFile(null);
    setAvatarPreview(profileRow?.profiles?.avatar_url || null);
  }

 async function handleSaveLocation(position) {
    setSaving(true);
    setError(null);

    const { data, error: err } = await supabase
      .schema('marketplace')
      .from('service_provider_profiles')
      .update({ location_lat: position.lat, location_lng: position.lng })
      .eq('user_id', userId)
      .select('*, profiles:profiles!service_provider_profiles_user_id_fkey ( full_name, phone, avatar_url )')
      .single();

    setSaving(false);

    if (err) {
      setError(err.message);
      return;
    }

    setProfileRow(data);
    setLocation({ lat: position.lat, lng: position.lng });
    setPickerOpen(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    let avatar_url = profileRow?.profiles?.avatar_url || null;
    if (avatarFile) {
      try {
        avatar_url = await uploadAvatarToR2(avatarFile);
      } catch (err) {
        setSaving(false);
        setError(err.message || 'Failed to upload photo.');
        return;
      }
    }

    const credentialPayload = {};
    for (const field of roleConfig.credentialFields) {
      credentialPayload[field.key] = form[field.key];
    }

    const [profileRes, providerRes] = await Promise.all([
      supabase
        .schema('marketplace')
        .from('profiles')
        .update({ full_name: form.full_name, phone: form.phone, avatar_url })
        .eq('id', userId),
      supabase
        .schema('marketplace')
        .from('service_provider_profiles')
        .upsert(
          { user_id: userId, provider_type: roleConfig.role, bio: form.bio, ...credentialPayload },
          { onConflict: 'user_id' }
        )
        .select('*, profiles:profiles!service_provider_profiles_user_id_fkey ( full_name, phone, avatar_url )')
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
    setAvatarFile(null);
    setEditing(false);
  }

  if (loading) return <div className="pd-loading">Loading profile…</div>;
  if (!form) return <div className="pd-error">{error || 'Could not load profile.'}</div>;

  const status = profileRow?.verification_status || 'pending';
  const isVerified = status === 'verified';
  const hasLocation = location.lat != null && location.lng != null;

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
              <button className="pd-btn pd-btn-ghost" onClick={cancelEditing} disabled={saving}>
                Cancel
              </button>
              <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <img
            src={avatarPreview || 'https://placehold.co/72x72?text=%20'}
            alt=""
            style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }}
          />
          {editing && (
            <label className="pd-btn pd-btn-ghost" style={{ cursor: 'pointer' }}>
              Change photo
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleAvatarChange}
                hidden
              />
            </label>
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

        {supportsLocation && (
          <div className="pd-field">
            <label>Location</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="pd-hint" style={{ margin: 0 }}>
                {hasLocation ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Not set'}
              </span>
              <button
                type="button"
                className="pd-btn pd-btn-ghost"
                onClick={() => setPickerOpen(true)}
                disabled={!editing}
              >
                <MapPin size={14} style={{ marginRight: 4 }} />
                {hasLocation ? 'Update location' : 'Set location'}
              </button>
            </div>
          </div>
        )}
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

      {pickerOpen && (
        <LocationPickerModal
          initialLat={location.lat}
          initialLng={location.lng}
          saving={saving}
          onCancel={() => setPickerOpen(false)}
          onSave={handleSaveLocation}
        />
      )}
    </div>
  );
}