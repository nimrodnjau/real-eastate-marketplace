import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, Star, Globe, Building2, ArrowLeft, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AgentProfileModal from './AgentProfileModal';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icons break under most bundlers unless re-pointed like this.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const sellerIcon = new L.DivIcon({
  className: 'agent-map-seller-icon',
  html: '<div class="agent-map-seller-dot"></div>',
  iconSize: [16, 16],
});

// Fallback center if geolocation is denied/unavailable — adjust to your market.
const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223 }; // Nairobi

function toRad(deg) { return (deg * Math.PI) / 180; }

function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Recenters the map once the seller's real location resolves.
function RecenterOnLocate({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView([center.lat, center.lng], map.getZoom()); }, [center, map]);
  return null;
}

function Stars({ rating }) {
  const full = Math.round(rating || 0);
  return (
    <span className="agent-stars" aria-label={`${rating ? rating.toFixed(1) : 'No'} rating`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={13} fill={i < full ? '#c9942f' : 'none'} color={i < full ? '#c9942f' : '#c9c2c2'} />
      ))}
    </span>
  );
}

export default function AgentPickerModal({ onSelect, onBack, onClose }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [sellerLocation, setSellerLocation] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [profileAgent, setProfileAgent] = useState(null); // opens AgentProfileModal when set

  useEffect(() => {
    if (!('geolocation' in navigator)) { setLocationDenied(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setSellerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationDenied(true),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: agentProfiles, error: agentsError } = await supabase
        .schema('marketplace')
        .from('profiles')
        .select('id, full_name, phone, email, avatar_url, agency_name, website, rating_avg, rating_count, location_lat, location_lng, created_at')
        .eq('role', 'agent');

      if (agentsError) {
        if (!cancelled) { setError(agentsError.message); setLoading(false); }
        return;
      }

      const { data: soldListings, error: soldError } = await supabase
        .schema('marketplace')
        .from('listings')
        .select('agent_id')
        .eq('status', 'sold')
        .not('agent_id', 'is', null);

      if (soldError) console.error('Could not load sales counts:', soldError);

      const salesByAgent = {};
      (soldListings || []).forEach((l) => { salesByAgent[l.agent_id] = (salesByAgent[l.agent_id] || 0) + 1; });

      if (!cancelled) {
        setAgents((agentProfiles || []).map((a) => ({ ...a, sales_count: salesByAgent[a.id] || 0 })));
        setError(null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const origin = sellerLocation || DEFAULT_CENTER;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents
      .filter((a) => !q || a.full_name?.toLowerCase().includes(q) || a.agency_name?.toLowerCase().includes(q))
      .map((a) => ({
        ...a,
        distanceKm: a.location_lat != null && a.location_lng != null
          ? distanceKm(origin, { lat: a.location_lat, lng: a.location_lng })
          : null,
      }))
      .sort((a, b) => {
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
  }, [agents, query, origin]);

  return (
    <>
    <div className="agent-picker-overlay" onClick={onClose}>
      <div className="agent-picker-modal agent-picker-modal--large" onClick={(e) => e.stopPropagation()}>
        <div className="agent-picker-header">
          <button type="button" className="agent-picker-back" onClick={onBack} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="agent-picker-title">Choose an agent</p>
            <p className="agent-picker-subtitle">
              {locationDenied
                ? "Showing all agents — enable location to see who's nearest."
                : sellerLocation ? 'Sorted by distance from you' : 'Finding your location…'}
            </p>
          </div>
          <button type="button" className="agent-picker-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="agent-picker-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search agents by name or agency…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="agent-picker-body">
          <div className="agent-picker-list">
            {loading ? (
              <p className="agent-picker-empty">Loading agents…</p>
            ) : error ? (
              <p className="dashboard-error">Couldn't load agents: {error}</p>
            ) : filtered.length === 0 ? (
              <p className="agent-picker-empty">No agents match your search.</p>
            ) : (
              filtered.map((agent) => (
                <button
                  type="button"
                  key={agent.id}
                  className={`agent-card ${selectedAgent?.id === agent.id ? 'agent-card--selected' : ''}`}
                  onClick={() => { setSelectedAgent(agent); setProfileAgent(agent); }}
                >
                  <img className="agent-card-avatar" src={agent.avatar_url || 'https://placehold.co/64x64?text=%20'} alt="" />
                  <div className="agent-card-info">
                    <p className="agent-card-name">{agent.full_name || 'Agent'}</p>
                    {agent.agency_name && <p className="agent-card-agency"><Building2 size={12} />{agent.agency_name}</p>}
                    <div className="agent-card-meta">
                      <Stars rating={agent.rating_avg} />
                      <span className="agent-card-meta-sep">·</span>
                      <span>{agent.rating_count || 0} reviews</span>
                      <span className="agent-card-meta-sep">·</span>
                      <span>{agent.sales_count} sold</span>
                    </div>
                  </div>
                  {agent.distanceKm != null && (
                    <span className="agent-card-distance">{agent.distanceKm.toFixed(1)} km</span>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="agent-picker-map">
            <MapContainer center={[origin.lat, origin.lng]} zoom={11} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              <RecenterOnLocate center={sellerLocation} />
              {sellerLocation && (
                <Marker position={[sellerLocation.lat, sellerLocation.lng]} icon={sellerIcon}>
                  <Popup>You are here</Popup>
                </Marker>
              )}
              {filtered.filter((a) => a.location_lat != null && a.location_lng != null).map((agent) => (
                <Marker
                  key={agent.id}
                  position={[agent.location_lat, agent.location_lng]}
                  eventHandlers={{ click: () => { setSelectedAgent(agent); setProfileAgent(agent); } }}
                >
                  <Popup>
                    <strong>{agent.full_name}</strong>
                    {agent.agency_name && <><br />{agent.agency_name}</>}
                    {agent.distanceKm != null && <><br />{agent.distanceKm.toFixed(1)} km away</>}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {selectedAgent && (
          <div className="agent-picker-detail">
            <div className="agent-picker-detail-info">
              <img className="agent-picker-detail-avatar" src={selectedAgent.avatar_url || 'https://placehold.co/64x64?text=%20'} alt="" />
              <div>
                <p className="agent-card-name">{selectedAgent.full_name || 'Agent'}</p>
                {selectedAgent.agency_name && <p className="agent-card-agency"><Building2 size={12} />{selectedAgent.agency_name}</p>}
                <div className="agent-card-meta">
                  <Stars rating={selectedAgent.rating_avg} />
                  <span>{selectedAgent.rating_count || 0} reviews</span>
                  <span className="agent-card-meta-sep">·</span>
                  <span>{selectedAgent.sales_count} sold</span>
                </div>
                {selectedAgent.website && (
                  <a
                    className="agent-picker-website"
                    href={selectedAgent.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Globe size={13} /> Visit website
                  </a>
                )}
              </div>
            </div>
            <button type="button" className="agent-picker-confirm" onClick={() => onSelect(selectedAgent)}>
              List with {selectedAgent.full_name?.split(' ')[0] || 'this agent'}
            </button>
          </div>
        )}
      </div>
    </div>

    {profileAgent && (
      <AgentProfileModal
        agent={profileAgent}
        onClose={() => setProfileAgent(null)}
        onSelect={(agent) => { setProfileAgent(null); onSelect(agent); }}
      />
    )}
    </>
  );
}