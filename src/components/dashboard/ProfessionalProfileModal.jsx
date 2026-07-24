// components/dashboard/ProfessionalProfileModal.jsx
import { useState, useEffect, useCallback } from 'react';
import { X, Star, MapPin, Phone, Mail, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/ProfessionalProfileModal.css';

function StarRow({ value }) {
  const rounded = Math.round(value || 0);
  return (
    <span className="prof-profile-stars" aria-label={`${value?.toFixed(1) ?? '0.0'} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} fill={n <= rounded ? '#c9902a' : 'none'} color="#c9902a" />
      ))}
    </span>
  );
}

export default function ProfessionalProfileModal({ professional, onClose, onMessage }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReviews = useCallback(async () => {
    if (!professional?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('professional_reviews')
      .select('id, rating, comment, created_at, reviewer_id, reviewer:profiles!professional_reviews_reviewer_id_fkey(id, full_name, avatar_url)')
      .eq('professional_id', professional.id)
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setReviews(data || []);
      setError(null);
    }
    setLoading(false);
  }, [professional?.id]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const reviewCount = reviews.length;
  const avgRating = reviewCount
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
    : 0;
  const workedWithCount = new Set(reviews.map((r) => r.reviewer_id)).size;

  const hasLocation = professional?.location_lat != null && professional?.location_lng != null;
  const mapSrc = hasLocation
    ? `https://www.google.com/maps?q=${professional.location_lat},${professional.location_lng}&z=14&output=embed`
    : null;

  return (
    <div className="prof-profile-overlay" onClick={onClose}>
      <div className="prof-profile-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="prof-profile-close-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="prof-profile-header">
          <img
            className="prof-profile-avatar"
            src={professional?.avatar_url || 'https://placehold.co/72x72?text=%20'}
            alt=""
          />
          <div>
            <p className="prof-profile-name">{professional?.full_name || 'Unnamed'}</p>
            <p className="prof-profile-role">
              {professional?.role}
              {professional?.agency_name ? ` · ${professional.agency_name}` : ''}
            </p>
            <div className="prof-profile-rating-row">
              <StarRow value={avgRating} />
              <span className="prof-profile-rating-text">
                {reviewCount ? `${avgRating.toFixed(1)} (${reviewCount} review${reviewCount === 1 ? '' : 's'})` : 'No reviews yet'}
              </span>
            </div>
          </div>
        </div>

        <div className="prof-profile-stats">
          <div className="prof-profile-stat">
            <Users size={15} />
            <span>{workedWithCount} {workedWithCount === 1 ? 'person' : 'people'} worked with</span>
          </div>
          {professional?.phone && (
            <div className="prof-profile-stat">
              <Phone size={15} />
              <span>{professional.phone}</span>
            </div>
          )}
          {professional?.email && (
            <div className="prof-profile-stat">
              <Mail size={15} />
              <span>{professional.email}</span>
            </div>
          )}
        </div>

        {professional?.bio && <p className="prof-profile-bio">{professional.bio}</p>}

        {hasLocation && (
          <div className="prof-profile-map-block">
            <p className="prof-profile-section-label"><MapPin size={13} /> Location</p>
            <iframe
              className="prof-profile-map"
              title={`${professional?.full_name || 'Professional'}'s location`}
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}

        <div className="prof-profile-reviews-block">
          <p className="prof-profile-section-label">Reviews</p>
          {loading ? (
            <p className="agent-picker-empty">Loading reviews…</p>
          ) : error ? (
            <p className="dashboard-error">Couldn't load reviews: {error}</p>
          ) : reviews.length === 0 ? (
            <p className="agent-picker-empty">No reviews yet.</p>
          ) : (
            <div className="prof-profile-reviews-list">
              {reviews.map((r) => (
                <div key={r.id} className="prof-profile-review-row">
                  <img
                    className="prof-profile-review-avatar"
                    src={r.reviewer?.avatar_url || 'https://placehold.co/32x32?text=%20'}
                    alt=""
                  />
                  <div className="prof-profile-review-body">
                    <div className="prof-profile-review-head">
                      <span className="prof-profile-review-name">{r.reviewer?.full_name || 'Anonymous'}</span>
                      <StarRow value={r.rating} />
                    </div>
                    {r.comment && <p className="prof-profile-review-text">{r.comment}</p>}
                    <span className="prof-profile-review-date">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="prof-profile-message-btn" onClick={() => onMessage(professional)}>
          Message {professional?.full_name?.split(' ')[0] || 'them'}
        </button>
      </div>
    </div>
  );
}