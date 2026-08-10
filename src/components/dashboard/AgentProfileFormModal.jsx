import { useState, useRef } from 'react';
import LocationPicker from './LocationPicker';
import '../../styles/AgentProfileFormModal.css';
import { uploadAvatarToR2 } from '../../api/uploads';

export default function ProfileFormModal({ profile, error, onSave, onClose }) {
  const [values, setValues] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    agency_name: profile?.agency_name || '',
    license_number: profile?.license_number || '',
    bio: profile?.bio || '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null);
  const [location, setLocation] = useState({
    lat: profile?.location_lat ?? null,
    lng: profile?.location_lng ?? null,
  });
  const [saving, setSaving] = useState(false);

  // --- Address search state ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const debounceRef = useRef(null);

  function update(field, value) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleLocationChange(lat, lng) {
    setLocation({ lat, lng });
    // Manual map click/drag overrides any pending search results.
    setSearchResults([]);
  }

  function handleSearchInput(e) {
    const q = e.target.value;
    setSearchQuery(q);
    setSearchError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => runSearch(q), 400);
  }

  async function runSearch(q) {
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Location search failed:', err);
      setSearchError("Couldn't search that address. Try again.");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectSearchResult(result) {
    setLocation({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setSearchQuery(result.display_name);
    setSearchResults([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const result = await onSave({ ...values, location_lat: location.lat, location_lng: location.lng }, avatarFile);
    setSaving(false);
    if (result?.ok) onClose();
  }

  const hasLocation = location.lat != null && location.lng != null;

  return (
    <div className="profile-form-overlay" onClick={onClose}>
      <div className="profile-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit profile</h2>
        {error && <p className="dashboard-error">{error}</p>}
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="profile-form-avatar">
            <img
              className="profile-form-avatar-preview"
              src={avatarPreview || 'https://placehold.co/96x96?text=%20'}
              alt=""
            />
            <label className="profile-form-avatar-btn">
              Change photo
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleAvatarChange}
                hidden
              />
            </label>
          </div>

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

          <div className="profile-form-location">
            <label className="profile-form-location-label">
              Location
              <span className="profile-form-location-hint">
                {hasLocation
                  ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                  : 'Search an address or click the map'}
              </span>
            </label>

            <div className="profile-form-location-search">
              <input
                type="text"
                placeholder="Search for an address…"
                value={searchQuery}
                onChange={handleSearchInput}
              />
              {searching && <p className="profile-form-location-status">Searching…</p>}
              {searchError && <p className="profile-form-location-status profile-form-location-status--error">{searchError}</p>}
              {searchResults.length > 0 && (
                <ul className="profile-form-location-results">
                  {searchResults.map((r) => (
                    <li key={r.place_id}>
                      <button type="button" onClick={() => selectSearchResult(r)}>
                        {r.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <LocationPicker
              lat={location.lat}
              lng={location.lng}
              onChange={handleLocationChange}
              height={200}
            />
          </div>

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