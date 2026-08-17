// components/dashboard/LocationPicker.jsx
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { X, Navigation, Search } from 'lucide-react';

// Leaflet's default marker icon paths break under most bundlers (webpack/vite
// rewrite asset URLs) — this re-points them at the bundled asset imports.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER = [-1.2921, 36.8219]; // Nairobi — used until a location exists
const MAROON = '#450804';

// Click-or-drag map for picking a single lat/lng. `onChange` defaults to a
// no-op so this can also be used read-only (e.g. showing a provider's pinned
// location on a public listing page) without crashing when nothing's
// listening for changes.
export function LocationPicker({ lat, lng, onChange = () => {}, height = 220 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
    const map = L.map(containerRef.current, {
      center,
      zoom: lat != null ? 15 : 12,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(center, { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const { lat: newLat, lng: newLng } = marker.getLatLng();
      onChange(newLat, newLng);
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      onChange(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (lat == null || lng == null) return;
    markerRef.current.setLatLng([lat, lng]);
    const currentZoom = mapRef.current.getZoom();
    mapRef.current.setView([lat, lng], currentZoom < 14 ? 15 : currentZoom);
  }, [lat, lng]);

  return <div ref={containerRef} className="location-picker-map" style={{ height }} />;
}

// Modal wrapper — default export, resolved by
// `import LocationPickerModal from '.../LocationPicker'`.
export default function LocationPickerModal({ initialLat, initialLng, saving, onCancel, onSave }) {
  const [draft, setDraft] = useState(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  );
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ke&q=${encodeURIComponent(query)}`
        );
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data);
      } catch {
        setSearchError('Could not search right now.');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function handleSelectResult(result) {
    setDraft({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setQuery(result.display_name);
    setResults([]);
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoError('Location access is not supported in this browser.');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setGeoError('Could not get your current location. Search or pick it on the map instead.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#ffffff',
          borderRadius: 10,
          padding: 20,
          boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, color: '#1a1a1a', fontSize: 18 }}>Set your location</h2>
            <div style={{ color: '#666', fontSize: 13, marginTop: 2 }}>
              Search an address, or click/drag the pin on the map.
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: MAROON,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X width={18} height={18} />
          </button>
        </div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search
              width={14}
              height={14}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#888' }}
            />
            <input
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 10px 10px 30px',
                border: '1px solid #ddd',
                borderRadius: 6,
                fontSize: 14,
                color: '#1a1a1a',
                background: '#fff',
              }}
              placeholder="Search for an address or place…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {(results.length > 0 || searching || searchError) && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: '#ffffff',
                border: '1px solid #ddd',
                borderRadius: 6,
                padding: 4,
                zIndex: 10,
                maxHeight: 200,
                overflowY: 'auto',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}
            >
              {searching && <div style={{ padding: 8, color: '#666', fontSize: 13 }}>Searching…</div>}
              {searchError && <div style={{ padding: 8, color: '#b3261e', fontSize: 13 }}>{searchError}</div>}
              {!searching &&
                results.map((r) => (
                  <button
                    key={r.place_id}
                    type="button"
                    onClick={() => handleSelectResult(r)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#1a1a1a',
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f4f0ef')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {r.display_name}
                  </button>
                ))}
            </div>
          )}
        </div>

        <LocationPicker
          lat={draft?.lat ?? null}
          lng={draft?.lng ?? null}
          onChange={(lat, lng) => setDraft({ lat, lng })}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <span style={{ fontSize: 13, color: '#555' }}>
            {draft ? `${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)}` : 'No location set yet'}
          </span>
          <button
            onClick={handleUseCurrentLocation}
            disabled={locating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#fff',
              border: `1px solid ${MAROON}`,
              color: MAROON,
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: locating ? 'default' : 'pointer',
              opacity: locating ? 0.6 : 1,
            }}
          >
            <Navigation width={14} height={14} />
            {locating ? 'Locating…' : 'Use current location'}
          </button>
        </div>

        {geoError && <div style={{ marginTop: 8, color: '#b3261e', fontSize: 13 }}>{geoError}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              background: '#fff',
              border: `1px solid ${MAROON}`,
              color: MAROON,
              borderRadius: 6,
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => draft && onSave(draft)}
            disabled={saving || !draft}
            style={{
              background: MAROON,
              border: 'none',
              color: '#fff',
              borderRadius: 6,
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving || !draft ? 'default' : 'pointer',
              opacity: saving || !draft ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save location'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}