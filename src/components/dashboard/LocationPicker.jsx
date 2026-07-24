// components/dashboard/LocationPicker.jsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet's default marker icon paths break under most bundlers (webpack/vite
// rewrite asset URLs) — this re-points them at the bundled asset imports.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER = [-1.2921, 36.8219]; // Nairobi — used until a location exists

// Click-or-drag map for picking a single lat/lng. Controlled from outside via
// `lat`/`lng` props (e.g. after a geocode lookup), but also free-standing —
// clicking or dragging the marker calls onChange(lat, lng) directly.
export default function LocationPicker({ lat, lng, onChange, height = 220 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Init map once.
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

    // Leaflet miscalculates its size if the container was hidden/animating
    // when it initialized (true here, since this sits inside a modal).
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when lat/lng change from OUTSIDE this component — i.e. after a
  // geocode lookup sets the address-derived coordinates.
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (lat == null || lng == null) return;
    markerRef.current.setLatLng([lat, lng]);
    const currentZoom = mapRef.current.getZoom();
    mapRef.current.setView([lat, lng], currentZoom < 14 ? 15 : currentZoom);
  }, [lat, lng]);

  return <div ref={containerRef} className="location-picker-map" style={{ height }} />;
}