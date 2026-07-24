import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { db } from '../../lib/supabaseClient';
import LocationPicker from './LocationPicker';

export default function AgentProfileSection({ profile, onEdit, onLocationSaved }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // Local copy so the row updates immediately after saving, without
  // needing the parent to refetch the whole profile.
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
      const { error } = await db
        .from('professionals')
        .update({ location_lat: position.lat, location_lng: position.lng })
        .eq('id', profile.id);

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

  const hasLocation = location.lat != null && location.lng != null;

  return (
    <div className="profile-section">
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

      {saveError && <p className="list-empty">Couldn't save your location. Please try again.</p>}

      {profile.bio && (
        <div className="profile-bio">
          <p className="list-row-title">Bio</p>
          <p className="list-row-meta">{profile.bio}</p>
        </div>
      )}

      <button type="button" className="list-row-edit-btn" onClick={onEdit}>
        Edit profile
      </button>

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