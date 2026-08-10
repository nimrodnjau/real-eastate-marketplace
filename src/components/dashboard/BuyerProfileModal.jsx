import { X, Phone, Mail, Calendar, Star, ShieldAlert } from 'lucide-react';
import '../../styles/buyer-profile-modal.css';

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function memberSince(dateString) {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
}

export default function BuyerProfileModal({ buyer, onClose }) {
  if (!buyer) return null;

  const since = memberSince(buyer.created_at);
  const hasRating = Boolean(buyer.rating_count);

  return (
    <div className="buyer-profile-overlay" onClick={onClose}>
      <div
        className="buyer-profile-card"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="buyer-profile-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {buyer.is_suspended && (
          <div className="buyer-profile-suspended">
            <ShieldAlert size={13} />
            <span>Account suspended</span>
          </div>
        )}

        {buyer.avatar_url ? (
          <img
            className="buyer-profile-avatar"
            src={buyer.avatar_url}
            alt={buyer.full_name || 'Buyer'}
          />
        ) : (
          <div className="buyer-profile-avatar buyer-profile-avatar--fallback">
            {initials(buyer.full_name)}
          </div>
        )}

        <p className="buyer-profile-name">{buyer.full_name || 'Buyer'}</p>
        <p className="buyer-profile-role">Buyer</p>

        {hasRating && (
          <div className="buyer-profile-rating">
            <Star size={13} />
            <span>
              {buyer.rating_avg?.toFixed(1)} ({buyer.rating_count})
            </span>
          </div>
        )}

        {(buyer.phone || buyer.email || buyer.country || since) && (
          <>
            <div className="buyer-profile-divider" />
            <div className="buyer-profile-details">
              {buyer.phone && (
                <div className="buyer-profile-row">
                  <Phone size={14} />
                  <span>{buyer.phone}</span>
                </div>
              )}
              {buyer.email && (
                <div className="buyer-profile-row">
                  <Mail size={14} />
                  <span>{buyer.email}</span>
                </div>
              )}
              {buyer.country && (
                <div className="buyer-profile-row">
                  <span className="buyer-profile-row-label">Country</span>
                  <span>{buyer.country}</span>
                </div>
              )}
              {since && (
                <div className="buyer-profile-row">
                  <Calendar size={14} />
                  <span>Member since {since}</span>
                </div>
              )}
            </div>
          </>
        )}

        {buyer.bio && <p className="buyer-profile-bio">{buyer.bio}</p>}
      </div>
    </div>
  );
}