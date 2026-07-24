import { useEffect, useState } from 'react';
import { X, Phone, Mail, Globe, Star } from 'lucide-react';
import { db } from '../../lib/supabaseClient';
import '../../styles/professional-profile-modal.css';

// Full-detail modal for a professional (agent/lawyer/valuer/surveyor),
// opened from ProfessionalsSection. Styling lives in its own file:
// professional-profile-modal.css (imported above). Map is a plain
// Google Maps iframe embed (no API key / library needed) centered on
// the professional's location_lat/lng, with a labeled pin plus
// "Get directions" / "Open in Maps" actions for full interactivity.
//
// Usage: <ProfessionalProfileModalForBuyer professionalId={id} onClose={() => ...} />

const TYPE_LABEL = {
  agent: 'Agent',
  lawyer: 'Lawyer',
  valuer: 'Valuer',
  surveyor: 'Surveyor',
};

function mapEmbedUrl(lat, lng, label) {
  const query = label ? `${lat},${lng}(${encodeURIComponent(label)})` : `${lat},${lng}`;
  return `https://www.google.com/maps?q=${query}&z=15&output=embed`;
}

function directionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function openInMapsUrl(lat, lng, label) {
  const query = label ? `${lat},${lng}(${encodeURIComponent(label)})` : `${lat},${lng}`;
  return `https://www.google.com/maps?q=${query}&z=16`;
}

export default function ProfessionalProfileModalForBuyer({ professionalId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!professionalId) return;
    let isMounted = true;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await db
          .rpc('get_professional_profile', { target_id: professionalId })
          .maybeSingle();

        console.log('get_professional_profile result:', { data, error });

        if (!isMounted) return;

        if (error) {
          console.error('Failed to load professional profile:', error);
          setError(error);
          return;
        }

        if (!data) {
          console.warn('get_professional_profile returned no row for', professionalId);
          setError(new Error('not_found'));
          return;
        }

        setProfile(data);

        // Only agents have listings — skip the extra query otherwise.
        if (data.professional_type === 'agent') {
          const { data: listingRows, error: listingsError } = await db
            .from('listings')
            .select('id, title, price, images')
            .eq('agent_id', professionalId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(3);

          if (isMounted && !listingsError) {
            setListings(listingRows || []);
          }
        }
      } catch (err) {
        console.error('Unexpected error loading professional profile:', err);
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [professionalId]);

  return (
    <div className="agent-profile-overlay" onClick={onClose}>
      <div className="agent-profile-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="agent-profile-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {loading && <p className="list-empty">Loading profile…</p>}
        {error && <p className="list-empty">Couldn't load this profile.</p>}

        {profile && (
          <>
            <div className="agent-profile-hero">
              {profile.avatar_url ? (
                <img className="agent-profile-avatar" src={profile.avatar_url} alt={profile.full_name} />
              ) : (
                <div className="agent-profile-avatar" />
              )}
              <div>
                <p className="agent-profile-name">{profile.full_name}</p>
                <p className="agent-profile-agency">
                  {profile.organization || TYPE_LABEL[profile.professional_type] || profile.professional_type}
                </p>
                {profile.rating_avg != null && (
                  <div className="agent-profile-rating">
                    <Star size={14} fill="currentColor" />
                    {Number(profile.rating_avg).toFixed(1)}
                  </div>
                )}
              </div>
            </div>

            <div className="agent-profile-stats">
              {profile.professional_type === 'agent' && profile.sales_count != null && (
                <div className="agent-profile-stat">
                  <p className="agent-profile-stat-value">{profile.sales_count}</p>
                  <p className="agent-profile-stat-label">Sales</p>
                </div>
              )}
              {profile.rating_avg != null && (
                <div className="agent-profile-stat">
                  <p className="agent-profile-stat-value">{Number(profile.rating_avg).toFixed(1)}</p>
                  <p className="agent-profile-stat-label">Rating</p>
                </div>
              )}
              {profile.license_number && (
                <div className="agent-profile-stat">
                  <p className="agent-profile-stat-value">{profile.license_number}</p>
                  <p className="agent-profile-stat-label">License</p>
                </div>
              )}
            </div>

            <div className="agent-profile-contact">
              {profile.phone ? (
                <a className="agent-profile-contact-row" href={`tel:${profile.phone}`}>
                  <Phone size={15} /> {profile.phone}
                </a>
              ) : (
                <span className="agent-profile-contact-row agent-profile-contact-row--muted">
                  <Phone size={15} /> No phone listed
                </span>
              )}
              <a className="agent-profile-contact-row" href={`mailto:${profile.email}`}>
                <Mail size={15} /> {profile.email}
              </a>
              {profile.website && (
                <a className="agent-profile-contact-row" href={profile.website} target="_blank" rel="noreferrer">
                  <Globe size={15} /> {profile.website}
                </a>
              )}
            </div>

            {profile.bio && (
              <>
                <p className="agent-profile-section-title">About</p>
                <p className="agent-profile-bio">{profile.bio}</p>
              </>
            )}

            {profile.location_lat != null && profile.location_lng != null && (
              <>
                <div className="agent-profile-section-header">
                  <p className="agent-profile-section-title">Location</p>
                  <div className="agent-profile-map-actions">
                    <a
                      className="agent-profile-map-action"
                      href={directionsUrl(profile.location_lat, profile.location_lng)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get directions
                    </a>
                    <a
                      className="agent-profile-map-action"
                      href={openInMapsUrl(profile.location_lat, profile.location_lng, profile.full_name)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Maps
                    </a>
                  </div>
                </div>

                {profile.location_address && (
                  <p className="agent-profile-address">{profile.location_address}</p>
                )}

                <iframe
                  title="Professional location"
                  src={mapEmbedUrl(profile.location_lat, profile.location_lng, profile.full_name)}
                  width="100%"
                  height="220"
                  className="agent-profile-map"
                  loading="lazy"
                />
              </>
            )}

            {profile.professional_type === 'agent' && listings.length > 0 && (
              <div className="agent-profile-listings">
                <p className="agent-profile-section-title">Recent listings</p>
                <div className="agent-profile-listing-grid">
                  {listings.map((listing) => (
                    <div key={listing.id} className="agent-profile-listing-card">
                      {listing.images?.[0]?.url ? (
                        <img src={listing.images[0].url} alt={listing.title} />
                      ) : (
                        <div className="agent-profile-listing-placeholder">No photo</div>
                      )}
                      <p className="agent-profile-listing-title">{listing.title}</p>
                      <p className="agent-profile-listing-price">
                        KES {Number(listing.price).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}