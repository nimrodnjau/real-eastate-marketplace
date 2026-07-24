import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [-1.286389, 36.817223]; // Nairobi fallback, [lat, lng] (Leaflet order)
const DEFAULT_ZOOM = 6;

// Same pin as before — rendered as a divIcon (inline SVG) rather than an
// addImage()'d raster, since Leaflet doesn't need the image-load round trip
// MapLibre's symbol layer required.
const PIN_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 40 52">
    <path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32s20-17 20-32C40 9 31 0 20 0z" fill="#e0364f"/>
    <circle cx="20" cy="20" r="8" fill="#ffffff"/>
  </svg>
`;

const pinIcon = L.divIcon({
  className: 'listings-map-pin',
  html: PIN_SVG,
  iconSize: [34, 44],
  iconAnchor: [17, 44],   // bottom-center, matches the old icon-anchor: 'bottom'
  popupAnchor: [0, -40],
});

function validProperties(properties) {
  return properties.filter((p) => p.location_lat && p.location_lng);
}

export default function ListingsMap({ properties }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const applyData = (map, props) => {
    const layer = markersLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    const valid = validProperties(props);

    valid.forEach((p) => {
      const marker = L.marker([p.location_lat, p.location_lng], { icon: pinIcon });

      marker.bindPopup(
        `<strong>${p.title}</strong><br/>KES ${Number(p.price).toLocaleString()}`,
        { closeButton: false, offset: [0, -6] }
      );

      marker.on('click', () => navigateRef.current(`/listings/${p.id}`));
      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout', () => marker.closePopup());

      layer.addLayer(marker);
    });

    if (valid.length === 1) {
      map.setView([valid[0].location_lat, valid[0].location_lng], 13);
    } else if (valid.length > 1) {
      const bounds = L.latLngBounds(valid.map((p) => [p.location_lat, p.location_lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  };

  // Init map once
  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Container may be 0-height on first paint depending on flex/grid timing.
    setTimeout(() => map.invalidateSize(), 150);

    applyData(map, properties);

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update whenever properties change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyData(map, properties);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties]);

  return <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />;
}