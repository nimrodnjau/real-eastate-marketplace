import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabaseclient';
import LocationPickerModal from './LocationPicker';
import ProfileFormModal from './AgentProfileFormModal'; // generic now, despite the filename
import { uploadAvatarToR2 } from '../../api/uploads';

// Fields every role shares — these always live on `marketplace.profiles`.
const BASE_ROWS = [
  { label: 'Name', key: 'full_name' },
  { label: 'Email', key: 'email' },
  { label: 'Phone', key: 'phone' },
];

/**
 * Generic profile section for any role-based dashboard.
 *
 * `profile` is expected to be the already-joined/flattened object your page
 * fetches today (e.g. AgentDashboard currently merges agent_profiles fields
 * like agency_name straight onto the profile object before passing it down —
 * keep doing that; this component just reads `profile[key]`).
 *
 * `roleConfig` comes from roleProfileConfigs.js and tells this component:
 *   - which extra rows to display beyond name/email/phone
 *   - which table each extra field should be written back to on save
 *   - whether this role supports the location picker at all
 */
export default function RoleProfileSection({ profile, roleConfig, onLocationSaved, onProfileSaved }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [location, setLocation] = useState({
    lat: profile?.location_lat ?? null,
    lng: profile?.location_lng ?? null,
  });

  if (!profile) return <p className="dashboard-empty">Profile not loaded.</p>;
  if (!roleConfig) return <p className="dashboard-empty">No profile configuration for this role.</p>;

  const rows = [
    ...BASE_ROWS.map((r) => ({ ...r, value: profile[r.key] })),
    ...(roleConfig.extraRows || []).map((r) => ({ ...r, value: profile[r.key] })),
  ];

  async function handleSaveLocation(position) {
    if (!roleConfig.supportsLocation) return;
    setSaving(true);
    setSaveError(null);

    try {
      // Most roles will write location to their own role table (mirrors the
      // original agent_profiles behavior). Set locationTable: 'profiles' in
      // the config for roles that should write straight to `profiles` instead.
      const writingToProfiles = roleConfig.locationTable === 'profiles';
      const targetTable = writingToProfiles ? 'profiles' : roleConfig.roleTable;
      const idColumn = writingToProfiles ? 'id' : roleConfig.roleIdColumn;

      const { error } = await supabase
        .schema('marketplace')
        .from(targetTable)
        .update({ location_lat: position.lat, location_lng: position.lng })
        .eq(idColumn, profile.id);

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
      }

      // 1. Shared fields always go to `profiles`, plus any extraFormFields
      //    marked table: 'profiles' (e.g. agent's license_number).
      const profilesUpdate = {
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        bio: values.bio,
        avatar_url,
      };
      (roleConfig.extraFormFields || []).forEach((f) => {
        if (f.table === 'profiles') profilesUpdate[f.key] = values[f.key];
      });

      const { data: profileData, error: profileError } = await supabase
        .schema('marketplace')
        .from('profiles')
        .update(profilesUpdate)
        .eq('id', profile.id)
        .select();

      if (profileError) throw profileError;
      if (!profileData || profileData.length === 0) {
        throw new Error('profiles update matched 0 rows — RLS or id mismatch.');
      }

      // 2. Role-specific fields go to the role table, if this role has one.
      if (roleConfig.roleTable) {
        const roleUpdate = {};
        (roleConfig.extraFormFields || []).forEach((f) => {
          if (f.table === 'role') roleUpdate[f.key] = values[f.key];
        });

        if (roleConfig.supportsLocation && roleConfig.locationTable !== 'profiles') {
          roleUpdate.location_lat = values.location_lat;
          roleUpdate.location_lng = values.location_lng;
        }

        if (Object.keys(roleUpdate).length > 0) {
          const { data: roleData, error: roleError } = await supabase
            .schema('marketplace')
            .from(roleConfig.roleTable)
            .update(roleUpdate)
            .eq(roleConfig.roleIdColumn, profile.id)
            .select();

          if (roleError) throw roleError;
          if (!roleData || roleData.length === 0) {
            throw new Error(`${roleConfig.roleTable} update matched 0 rows — RLS or id mismatch.`);
          }
        }
      }

      if (roleConfig.supportsLocation) {
        setLocation({ lat: values.location_lat, lng: values.location_lng });
      }
      onProfileSaved?.({ ...values, avatar_url });
      return { ok: true };
    } catch (err) {
      console.error('Failed to save profile:', err);
      setSaveError(err);
      return { ok: false };
    }
  }

  const hasLocation = roleConfig.supportsLocation && location.lat != null && location.lng != null;

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

        {roleConfig.supportsLocation && (
          <li className="list-row">
            <div>
              <p className="list-row-title">Location</p>
              <p className="list-row-meta">
                {hasLocation ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Not set'}
              </p>
            </div>
            <button type="button" className="list-row-edit-btn" onClick={() => setPickerOpen(true)}>
              <MapPin size={14} style={{ marginRight: 4 }} />
              {hasLocation ? 'Update location' : 'Set location'}
            </button>
          </li>
        )}
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

      {pickerOpen && roleConfig.supportsLocation && (
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
          roleConfig={roleConfig}
          error={saveError ? saveError.message || "Couldn't save your changes. Please try again." : null}
          onSave={handleSaveProfile}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}