import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import LocationPicker from './LocationPicker';
import LocationPickerModal from './LocationPicker';
import ProfileFormModal from './AgentProfileFormModal';
import { uploadAvatarToR2 } from '../../api/uploads';

export default function AgentProfileSection({ profile, onLocationSaved, onProfileSaved }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [location, setLocation] = useState({
    lat: profile?.location_lat ?? null,
    lng: profile?.location_lng ?? null,
  });

  if (!profile) return <p className="dashboard-empty">Profile not loaded.</p>;

  const rows = [
    { label: 'Name', value: profile.full_name },
    { label: 'Email', value: profile.email },
    { label: 'Phone', value: profile.phone },
    { label: 'Agency', value: profile.agency_name },
    { label: 'License number', value: profile.license_number },
  ];

  async function handleSaveLocation(position) {
    setSaving(true);
    setSaveError(null);

    try {
      const { error } = await supabase
        .schema('marketplace')
        .from('agent_profiles')
        .update({ location_lat: position.lat, location_lng: position.lng })
        .eq('user_id', profile.id);

      if (error) {
        console.error('Failed to save location:', error);
        setSaveError(error);
        return;
      }

      setLocation({ lat: position.lat, lng: position.lng });
      setPickerOpen(false);
      onLocationSaved?.(position);
    } catch (err) {
      console.error('Unexpected error saving location:', err);
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile(values, avatarFile) {
    setSaveError(null);
    try {
      let avatar_url = profile.avatar_url;

      if (avatarFile) {
        avatar_url = await uploadAvatarToR2(avatarFile);
        console.log('Avatar uploaded:', avatar_url);
      }

      const { data: profileData, error: profileError } = await supabase
        .schema('marketplace')
        .from('profiles')
        .update({
          full_name: values.full_name,
          email: values.email,
          phone: values.phone,
          bio: values.bio,
        })
        .eq('id', profile.id)
        .select();

      console.log('profiles update result:', profileData, profileError);
      if (profileError) throw profileError;
      if (!profileData || profileData.length === 0) {
        throw new Error('profiles update matched 0 rows — RLS or id mismatch.');
      }

      const { data: agentData, error: agentError } = await supabase
        .schema('marketplace')
        .from('agent_profiles')
        .update({
          agency_name: values.agency_name,
          location_lat: values.location_lat,
          location_lng: values.location_lng,
        })
        .eq('user_id', profile.id)
        .select();

      console.log('agent_profiles update result:', agentData, agentError);
      if (agentError) throw agentError;
      if (!agentData || agentData.length === 0) {
        throw new Error('agent_profiles update matched 0 rows — RLS or user_id mismatch.');
      }

      setLocation({ lat: values.location_lat, lng: values.location_lng });
      onProfileSaved?.({ ...values, avatar_url });
      console.log('handleSaveProfile: success, calling onProfileSaved with', { ...values, avatar_url });
      return { ok: true };
    } catch (err) {
      console.error('Failed to save profile:', err);
      setSaveError(err);
      return { ok: false };
    }
  }

  const hasLocation = location.lat != null && location.lng != null;

  return (
    <div className="profile-section">
      <div className="profile-section-header">
        <button
          type="button"
          className="profile-section-avatar-btn"
          onClick={() => setEditOpen(true)}
          aria-label="Edit profile"
          title="Edit profile"
          style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
        >
          <img
            className="profile-section-avatar"
            src={profile.avatar_url || 'https://placehold.co/96x96?text=%20'}
            alt=""
          />
        </button>
      </div>

      <ul className="list-rows">
        {rows.map((r) => (
          <li key={r.label} className="list-row">
            <div>
              <p className="list-row-title">{r.label}</p>
              <p className="list-row-meta">{r.value || '—'}</p>
            </div>
          </li>
        ))}

        <li className="list-row">
          <div>
            <p className="list-row-title">Location</p>
            <p className="list-row-meta">
              {hasLocation ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Not set'}
            </p>
          </div>
          <button
            type="button"
            className="list-row-edit-btn"
            onClick={() => setPickerOpen(true)}
          >
            <MapPin size={14} style={{ marginRight: 4 }} />
            {hasLocation ? 'Update location' : 'Set location'}
          </button>
        </li>
      </ul>

      {saveError && (
        <p className="list-empty">
          {saveError.message || "Couldn't save your changes. Please try again."}
        </p>
      )}

      {profile.bio && (
        <div className="profile-bio">
          <p className="list-row-title">Bio</p>
          <p className="list-row-meta">{profile.bio}</p>
        </div>
      )}

      {pickerOpen && (
        <LocationPickerModal
          initialLat={location.lat}
          initialLng={location.lng}
          saving={saving}
          onCancel={() => setPickerOpen(false)}
          onSave={handleSaveLocation}
        />
      )}

      {editOpen && (
        <ProfileFormModal
          profile={profile}
          error={saveError ? saveError.message || "Couldn't save your changes. Please try again." : null}
          onSave={handleSaveProfile}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}