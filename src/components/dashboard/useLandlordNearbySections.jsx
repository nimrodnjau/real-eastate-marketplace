import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Star, Building2, Globe, Phone, Mail, Calendar, MessageCircle } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import ListRows from './ListRows';
import { supabase } from '../../lib/supabaseClient';
import { fetchNearbyAgentsAndManagers, fetchProfileDetail } from '../../lib/landlordListings';
import '../../styles/AgentProfileModal.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const profileDotIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#c9942f;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const RADIUS_KM = 80;

const RADAR_STYLE_ID = 'agent-profile-radar-style';

function ensureRadarStyles() {
  if (typeof document === 'undefined' || document.getElementById(RADAR_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = RADAR_STYLE_ID;
  style.textContent = `
    .radar-pulse-ring {
      transform-box: fill-box;
      transform-origin: center;
      animation: radar-pulse 2.8s ease-out infinite;
      pointer-events: none;
    }
    .radar-pulse-ring--delay-1 { animation-delay: 0.9s; }
    .radar-pulse-ring--delay-2 { animation-delay: 1.8s; }
    @keyframes radar-pulse {
      0%   { transform: scale(0.35); opacity: 0.9; }
      70%  { opacity: 0.15; }
      100% { transform: scale(1); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function Stars({ rating }) {
  const full = Math.round(rating || 0);
  return (
    <span className="agent-stars" aria-label={`${rating ? rating.toFixed(1) : 'No'} rating`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={15} fill={i < full ? '#c9942f' : 'none'} color={i < full ? '#c9942f' : '#c9c2c2'} />
      ))}
    </span>
  );
}

function memberSince(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
}

function ProfileCard({ kind, profile, loading, error, myLocation, onClose, onMessage }) {
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (kind !== 'agent' || !profile?.id) {
      setListings([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setListingsLoading(true);
      const { data, error: listingsError } = await supabase
        .schema('marketplace')
        .from('listings')
        .select('id, title, price, property_type, images')
        .eq('agent_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(6);

      if (!cancelled) {
        if (listingsError) console.error('Failed to load agent listings:', listingsError);
        setListings(data || []);
        setListingsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kind, profile?.id]);

  const hasCoords =
    profile?.location_lat != null &&
    profile?.location_lng != null &&
    myLocation?.lat != null &&
    myLocation?.lng != null;

  useEffect(() => {
    if (!hasCoords || !mapContainerRef.current || mapRef.current) return;

    ensureRadarStyles();

    const landlordPos = [myLocation.lat, myLocation.lng];
    const profilePos = [profile.location_lat, profile.location_lng];

    const map = L.map(mapContainerRef.current, {
      center: landlordPos,
      zoom: 9,
      scrollWheelZoom: true,
      zoomSnap: 0.5,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    L.marker(landlordPos).addTo(map);
    L.marker(profilePos, { icon: profileDotIcon }).addTo(map);

    const radiusMeters = RADIUS_KM * 1000;

    // Soft filled circle as a static reference for the search radius.
    const baseCircle = L.circle(landlordPos, {
      radius: radiusMeters,
      color: '#2563eb',
      fillColor: '#2563eb',
      fillOpacity: 0.06,
      weight: 1,
    }).addTo(map);

    // Three staggered rings animate outward from the base radius to give
    // a radar "sonar pulse" look, like a live-location indicator.
    const radarRingOptions = {
      radius: radiusMeters,
      color: '#2563eb',
      weight: 2,
      fillOpacity: 0,
      interactive: false,
    };
    L.circle(landlordPos, { ...radarRingOptions, className: 'radar-pulse-ring' }).addTo(map);
    L.circle(landlordPos, { ...radarRingOptions, className: 'radar-pulse-ring radar-pulse-ring--delay-1' }).addTo(map);
    L.circle(landlordPos, { ...radarRingOptions, className: 'radar-pulse-ring radar-pulse-ring--delay-2' }).addTo(map);

    // Fit to both points AND the full radius circle, so the pulse is
    // actually visible on load instead of zoomed in past it.
    const bounds = L.latLngBounds([landlordPos, profilePos]).extend(baseCircle.getBounds());
    map.fitBounds(bounds, { padding: [30, 30] });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [hasCoords]);

  const displayName = profile?.full_name || (kind === 'agent' ? 'Agent' : 'Property manager');
  const orgName = kind === 'agent' ? profile?.agency_name : profile?.company_name;
  const distance = hasCoords
    ? distanceKm(myLocation.lat, myLocation.lng, profile.location_lat, profile.location_lng)
    : null;

  if (!kind) return null;

  return (
    <div className="agent-profile-overlay" onClick={onClose}>
      <div className="agent-profile-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="agent-profile-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {loading ? (
          <p className="agent-picker-empty">Loading profile…</p>
        ) : error ? (
          <p className="agent-picker-empty">Couldn't load this profile — try again.</p>
        ) : !profile ? (
          <p className="agent-picker-empty">No profile found.</p>
        ) : (
          <>
            <div className="agent-profile-hero">
              <img
                className="agent-profile-avatar"
                src={profile.avatar_url || 'https://placehold.co/160x160?text=%20'}
                alt=""
              />
              <div>
                <h2 className="agent-profile-name">{displayName}</h2>
                {orgName && (
                  <p className="agent-profile-agency"><Building2 size={14} />{orgName}</p>
                )}
                <div className="agent-profile-rating">
                  <Stars rating={profile.rating_avg} />
                  <span>{profile.rating_avg ? profile.rating_avg.toFixed(1) : 'No rating'} · {profile.rating_count || 0} reviews</span>
                </div>
              </div>
            </div>

            <div className="agent-profile-stats">
              {kind === 'agent' && (
                <div className="agent-profile-stat">
                  <p className="agent-profile-stat-value">{profile.sales_count ?? 0}</p>
                  <p className="agent-profile-stat-label">Properties sold</p>
                </div>
              )}
              {kind === 'agent' && (
                <div className="agent-profile-stat">
                  <p className="agent-profile-stat-value">{listings.length}</p>
                  <p className="agent-profile-stat-label">Active listings</p>
                </div>
              )}
              {distance != null && (
                <div className="agent-profile-stat">
                  <p className="agent-profile-stat-value">{distance.toFixed(1)} km</p>
                  <p className="agent-profile-stat-label">From you</p>
                </div>
              )}
            </div>

            <div className="agent-profile-contact">
              {profile.phone && (
                <a className="agent-profile-contact-row" href={`tel:${profile.phone}`}>
                  <Phone size={15} /> {profile.phone}
                </a>
              )}
              {profile.email && (
                <a className="agent-profile-contact-row" href={`mailto:${profile.email}`}>
                  <Mail size={15} /> {profile.email}
                </a>
              )}
              {profile.website && (
                <a
                  className="agent-profile-contact-row"
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe size={15} /> Visit website
                </a>
              )}
              {profile.created_at && (
                <p className="agent-profile-contact-row agent-profile-contact-row--muted">
                  <Calendar size={15} /> {kind === 'agent' ? 'Agent' : 'Manager'} since {memberSince(profile.created_at)}
                </p>
              )}
            </div>

            {profile.location_lat != null && profile.location_lng != null && (
              <div className="agent-profile-map">
                {hasCoords ? (
                  <div ref={mapContainerRef} className="location-picker-map" style={{ height: 220 }} />
                ) : (
                  <p className="agent-picker-empty">Enable location access to see this on the map.</p>
                )}
              </div>
            )}

            {kind === 'agent' && (
              <div className="agent-profile-listings">
                <p className="agent-profile-section-title">Active listings</p>
                {listingsLoading ? (
                  <p className="agent-picker-empty">Loading listings…</p>
                ) : listings.length === 0 ? (
                  <p className="agent-picker-empty">No active listings right now.</p>
                ) : (
                  <div className="agent-profile-listing-grid">
                    {listings.map((l) => (
                      <div key={l.id} className="agent-profile-listing-card">
                        {l.images?.[0]?.url ? (
                          <img src={l.images[0].url} alt="" />
                        ) : (
                          <div className="agent-profile-listing-placeholder">No photo</div>
                        )}
                        <p className="agent-profile-listing-title">{l.title}</p>
                        <p className="agent-profile-listing-price">KES {Number(l.price).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button type="button" className="agent-profile-select-btn" onClick={() => onMessage?.()}>
              <MessageCircle size={16} /> Message {displayName.split(' ')[0]}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function useLandlordNearbySections() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');
  const [managers, setManagers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState(null);
  const [myLocation, setMyLocation] = useState(null);

  const [activeKind, setActiveKind] = useState(null);
  const [activeUserId, setActiveUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!('geolocation' in navigator)) {
      setStatus('denied');
      return;
    }

    setStatus('locating');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;
        const { latitude, longitude } = position.coords;
        setMyLocation({ lat: latitude, lng: longitude });

        const { managers: nearbyManagers, agents: nearbyAgents, error: fetchError } =
          await fetchNearbyAgentsAndManagers(latitude, longitude, RADIUS_KM);

        if (cancelled) return;

        if (fetchError) {
          setError(fetchError);
          setStatus('ready');
          return;
        }

        setManagers(nearbyManagers);
        setAgents(nearbyAgents);
        setStatus('ready');
      },
      () => {
        if (cancelled) return;
        setStatus('denied');
      },
      { timeout: 10000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeKind || !activeUserId) return;

    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);
    setProfile(null);

    fetchProfileDetail(activeKind, activeUserId).then(({ profile: data, error: detailError }) => {
      if (cancelled) return;
      if (detailError) {
        setProfileError(detailError);
      } else {
        setProfile(data);
      }
      setProfileLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [activeKind, activeUserId]);

  function openProfile(kind, userId) {
    setActiveKind(kind);
    setActiveUserId(userId);
  }

  function closeProfile() {
    setActiveKind(null);
    setActiveUserId(null);
    setProfile(null);
    setProfileError(null);
  }

  function handleMessage() {
    if (!activeUserId) return;
    const targetUserId = activeUserId;
    closeProfile();
    navigate('/dashboard/messages', { state: { startConversationWith: targetUserId } });
  }

  const loading = status === 'idle' || status === 'locating';

  const locationHint =
    status === 'denied' ? 'Enable location access to see who\u2019s near you.' : null;

  const managerItems = managers.map((m) => ({
    id: m.user_id,
    title: m.company_name || 'Property manager',
    meta: `${m.distanceKm.toFixed(1)} km away`,
    badge: 'Verified',
    badgeTone: 'success',
    actionLabel: 'View profile',
    onClick: () => openProfile('manager', m.user_id),
  }));

  const agentItems = agents.map((a) => ({
    id: a.user_id,
    title: a.agency_name || 'Agent',
    meta: `${a.distanceKm.toFixed(1)} km away`,
    badge: 'Verified',
    badgeTone: 'success',
    actionLabel: 'View profile',
    onClick: () => openProfile('agent', a.user_id),
  }));

  const managersEmptyLabel =
    locationHint ??
    (loading
      ? 'Finding property managers near you\u2026'
      : error
      ? 'Couldn\u2019t load nearby property managers \u2014 try refreshing.'
      : `No verified property managers within ${RADIUS_KM}km yet.`);

  const agentsEmptyLabel =
    locationHint ??
    (loading
      ? 'Finding agents near you\u2026'
      : error
      ? 'Couldn\u2019t load nearby agents \u2014 try refreshing.'
      : `No verified agents within ${RADIUS_KM}km yet.`);

  const managersSection = {
    id: 'managers',
    title: 'Property managers near you',
    description: 'Hand off day-to-day management.',
    icon: 'users',
    type: 'list',
    items: managerItems,
    emptyLabel: managersEmptyLabel,
    content: <ListRows items={managerItems} emptyLabel={managersEmptyLabel} />,
  };

  const agentsSection = {
    id: 'agents',
    title: 'Agents near you',
    description: 'Get help listing or leasing a unit.',
    icon: 'briefcase',
    type: 'list',
    items: agentItems,
    emptyLabel: agentsEmptyLabel,
    content: <ListRows items={agentItems} emptyLabel={agentsEmptyLabel} />,
  };

  const modalElement = (
    <ProfileCard
      open={activeKind !== null}
      kind={activeKind}
      profile={profile}
      loading={profileLoading}
      error={profileError}
      myLocation={myLocation}
      onClose={closeProfile}
      onMessage={handleMessage}
    />
  );

  return { managersSection, agentsSection, error, loading, modalElement };
}