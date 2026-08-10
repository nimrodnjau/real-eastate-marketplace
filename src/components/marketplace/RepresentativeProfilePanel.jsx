import { useEffect, useState } from 'react';
import {
  fetchRepresentativeProfile,
  fetchAgentReviews,
  fetchManagedPropertiesCount,
  fetchRepresentativeListings,
} from '../../api/agentProfiles';
import { supabase } from '../../lib/supabaseClient';
import LocationPicker from '../dashboard/LocationPicker';
import './RepresentativeProfilePanel.css';

function StarRating({ value }) {
  if (typeof value !== 'number') return null;
  const rounded = Math.round(value);
  return (
    <span className="rep-profile__stars" aria-label={`${value.toFixed(1)} out of 5`}>
      {'★'.repeat(rounded)}
      {'☆'.repeat(5 - rounded)}
      <span className="rep-profile__stars-value">{value.toFixed(1)}</span>
    </span>
  );
}

// `images` jsonb entries might be: a plain public URL string, a storage
// path string (e.g. "listings/abc123/photo1.jpg"), or an object like
// { url } / { path }. Handle all three defensively until we confirm the
// exact shape being written to marketplace.listings.images.
// NOTE: replace 'listing-images' with your actual Supabase Storage bucket
// name if it's different.
function getListingImageUrl(entry) {
  if (!entry) return null;

  const raw = typeof entry === 'string' ? entry : entry.url || entry.path || null;
  if (!raw) return null;

  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  const { data } = supabase.storage.from('listing-images').getPublicUrl(raw);
  return data?.publicUrl || null;
}

// userId: profiles.id of the agent/manager being viewed (same value as
// agent_profiles.user_id / property_manager_profiles.user_id).
// role: 'agent' | 'manager'
// onClose(): dismiss the panel.
export default function RepresentativeProfilePanel({ userId, role, onClose }) {
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [managedCount, setManagedCount] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const tasks = [
      fetchRepresentativeProfile(userId, role),
      fetchManagedPropertiesCount(userId, role),
      // Only agents have a reviews table today.
      role === 'agent' ? fetchAgentReviews(userId) : Promise.resolve([]),
      fetchRepresentativeListings(userId, role),
    ];

    Promise.all(tasks)
      .then(([profileData, count, reviewData, listingData]) => {
        if (cancelled) return;
        setProfile(profileData);
        setManagedCount(count);
        setReviews(reviewData);
        setListings(listingData);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load this profile.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, role]);

  const displayName = profile?.agency_name || profile?.company_name || profile?.full_name;
  const hasLocation = profile?.location_lat != null && profile?.location_lng != null;

  return (
    <div className="rep-profile-overlay" role="dialog" aria-modal="true" aria-label="Profile" onClick={onClose}>
      <div className="rep-profile" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rep-profile__close" onClick={onClose} aria-label="Close">
          &times;
        </button>

        {loading ? (
          <p className="rep-profile__status">Loading profile…</p>
        ) : error ? (
          <p className="rep-profile__status rep-profile__status--error">{error}</p>
        ) : (
          <>
            {/* ---------- Header ---------- */}
            <header className="rep-profile__header">
              <img
                className="rep-profile__avatar"
                src={profile.avatar_url || '/avatar-placeholder.png'}
                alt=""
              />
              <div>
                <h2 className="rep-profile__name">{profile.full_name}</h2>
                {displayName && displayName !== profile.full_name && (
                  <p className="rep-profile__org">{displayName}</p>
                )}
                {profile.license_number && (
                  <p className="rep-profile__license">License {profile.license_number}</p>
                )}
                <StarRating value={profile.rating_avg} />
                {profile.rating_count > 0 && (
                  <span className="rep-profile__rating-count">
                    ({profile.rating_count} rating{profile.rating_count === 1 ? '' : 's'})
                  </span>
                )}
              </div>
            </header>

            {profile.bio && <p className="rep-profile__bio">{profile.bio}</p>}

            {/* ---------- Stats ---------- */}
            <div className="rep-profile__stat">
              Currently managing <strong>{managedCount ?? 0}</strong>{' '}
              {managedCount === 1 ? 'property' : 'properties'}
            </div>

            {/* ---------- Listings ---------- */}
            <div className="rep-profile__listings">
              <h3 className="rep-profile__listings-heading">
                Listings {listings.length > 0 && `(${listings.length})`}
              </h3>
              {listings.length === 0 ? (
                <p className="rep-profile__status">No listings yet.</p>
              ) : (
                <ul className="rep-profile__listings-grid">
                  {listings.map((l) => {
                    const firstImage = Array.isArray(l.images) ? l.images[0] : null;
                    const imageUrl = getListingImageUrl(firstImage);

                    return (
                      <li key={l.id} className="rep-listing-card">
                        <div className="rep-listing-card__image-wrap">
                          <img
                            className="rep-listing-card__image"
                            src={imageUrl || '/listing-placeholder.png'}
                            alt={l.title || `Listing #${l.id}`}
                            loading="lazy"
                          />
                          {l.status && (
                            <span
                              className={`rep-listing-card__badge rep-listing-card__badge--${l.status.toLowerCase()}`}
                            >
                              {l.status}
                            </span>
                          )}
                        </div>
                        <div className="rep-listing-card__body">
                          <span className="rep-listing-card__title">
                            {l.title || `Listing #${l.id}`}
                          </span>
                          {l.price != null && (
                            <span className="rep-listing-card__price">
                              KES {Number(l.price).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* ---------- Contact ---------- */}
            <div className="rep-profile__contact">
              {profile.phone && (
                <a className="rep-profile__contact-link" href={`tel:${profile.phone}`}>
                  {profile.phone}
                </a>
              )}
              {profile.email && (
                <a className="rep-profile__contact-link" href={`mailto:${profile.email}`}>
                  {profile.email}
                </a>
              )}
            </div>

            {/* ---------- Map ---------- */}
            {hasLocation ? (
              <LocationPicker lat={profile.location_lat} lng={profile.location_lng} readOnly />
            ) : (
              <p className="rep-profile__no-location">No location on file yet.</p>
            )}

            {/* ---------- Reviews (agents only) ---------- */}
            {role === 'agent' && (
              <div className="rep-profile__reviews">
                <h3 className="rep-profile__reviews-heading">Reviews</h3>
                {reviews.length === 0 ? (
                  <p className="rep-profile__status">No reviews yet.</p>
                ) : (
                  <ul className="rep-profile__reviews-list">
                    {reviews.map((r) => (
                      <li key={r.id} className="rep-review">
                        <img
                          className="rep-review__avatar"
                          src={r.buyer?.avatar_url || '/avatar-placeholder.png'}
                          alt=""
                        />
                        <div className="rep-review__body">
                          <div className="rep-review__top">
                            <span className="rep-review__name">{r.buyer?.full_name || 'Anonymous'}</span>
                            <StarRating value={r.rating} />
                          </div>
                          {r.comment && <p className="rep-review__comment">{r.comment}</p>}
                          <span className="rep-review__date">
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}