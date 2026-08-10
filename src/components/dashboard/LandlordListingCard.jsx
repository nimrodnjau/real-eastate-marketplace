import { Bed, Bath, Car, LandPlot, Pencil, Send, UserPlus } from 'lucide-react';
import '../../styles/LandlordListingCard.css';

// Mirrors marketplace.listing_status. Keep in sync with the map in
// ListingCard.jsx (marketplace side) — they read off the same enum.
const STATUS_BADGE = {
  draft:                { label: 'Draft',                  tone: 'neutral' },
  pending_review:       { label: 'Pending verification',   tone: 'pending' },
  pending_agent_review: { label: 'Awaiting agent review',  tone: 'pending' },
  active:               { label: 'Live',                   tone: 'success' },
  under_offer:          { label: 'Under offer',             tone: 'pending' },
  sold:                 { label: 'Sold',                    tone: 'success' },
  rejected:             { label: 'Rejected',                tone: 'danger' },
};

const PROPERTY_TYPE_LABEL = {
  residential: 'Residential',
  office: 'Office',
  retail: 'Retail',
  warehouse: 'Warehouse',
  land: 'Land',
};

// Only from these statuses can a landlord choose a listing path. Once
// something is pending_review / pending_agent_review / active it's already
// on one of the two paths, so we hide both buttons.
const SUBMITTABLE_STATUSES = ['draft', 'rejected'];

function formatSize(value, unit) {
  if (value == null) return null;
  if (unit === 'acres') {
    const hectares = (value * 0.404686).toFixed(2);
    return { primary: `${value} acres`, secondary: `${hectares} hectares` };
  }
  if (unit === 'sqm') return { primary: `${value} sqm`, secondary: null };
  if (unit === 'sqft') return { primary: `${value} sq ft`, secondary: null };
  return { primary: `${value}`, secondary: null };
}

/**
 * Card for a single listing on the landlord dashboard.
 *
 * - onOpen: view + edit the listing (same ListingFormModal, just opened —
 *   there's no separate read-only mode, the form itself is the "view")
 * - onSubmit: "List it myself" — submits the listing directly, no agent
 *   involved. Caller is expected to move status -> pending_review
 *   immediately (optimistic), then persist.
 * - onRequestAgent: "Get an agent" — opens ListingRepresentationPicker
 *   for this listing (unchanged, already exists elsewhere).
 */
export default function LandlordListingCard({ listing, onOpen, onSubmit, onRequestAgent }) {
  const images = listing.images || [];
  const coverImage = images[0]?.url;

  const badge = STATUS_BADGE[listing.status] || { label: listing.status, tone: 'neutral' };

  const isLand = listing.property_type === 'land';
  const size = isLand ? formatSize(listing.size_value, listing.size_unit) : null;
  const canChooseListingPath = SUBMITTABLE_STATUSES.includes(listing.status);
  const clicks = listing.view_count ?? 0;

  return (
    <div className="listing-card">
      <button
        type="button"
        className="listing-card-image-wrap"
        onClick={() => onOpen(listing)}
        aria-label={`View ${listing.title}`}
      >
        {coverImage ? (
          <img className="listing-card-image" src={coverImage} alt={listing.title} />
        ) : (
          <div className="listing-card-image-placeholder">No photo yet</div>
        )}

        <span className={`listing-card-status listing-card-status--${badge.tone}`}>
          {badge.label}
        </span>

        {images.length > 0 && (
          <span className="listing-card-photo-count">1/{images.length}</span>
        )}

        <span
          className="listing-card-edit-btn"
          onClick={(e) => { e.stopPropagation(); onOpen(listing); }}
          role="button"
          aria-label={`Edit ${listing.title}`}
        >
          <Pencil size={14} />
        </span>
      </button>

      <div className="listing-card-body">
        <p className="listing-card-title">{listing.title}</p>
        <p className="listing-card-type">
          {PROPERTY_TYPE_LABEL[listing.property_type] || listing.property_type}
        </p>

        <div className="listing-card-facts">
          {isLand ? (
            size && (
              <span className="listing-card-fact">
                <LandPlot size={15} />
                {size.primary}
                {size.secondary && <span className="listing-card-fact-sub">{size.secondary}</span>}
              </span>
            )
          ) : (
            <>
              {listing.bedrooms != null && (
                <span className="listing-card-fact"><Bed size={15} />{listing.bedrooms}</span>
              )}
              {listing.bathrooms != null && (
                <span className="listing-card-fact"><Bath size={15} />{listing.bathrooms}</span>
              )}
              {listing.parking != null && (
                <span className="listing-card-fact"><Car size={15} />{listing.parking}</span>
              )}
            </>
          )}
        </div>

        <p className="listing-card-price-label">Asking Price</p>
        <p className="listing-card-price">KES {Number(listing.price).toLocaleString()}</p>

        <p className="listing-card-clicks">{clicks} click{clicks === 1 ? '' : 's'}</p>

        {canChooseListingPath && (
          <div className="listing-card-actions">
            <button
              type="button"
              className="listing-card-submit-btn"
              onClick={(e) => { e.stopPropagation(); onSubmit(listing); }}
            >
              <Send size={14} />
              List it myself
            </button>
            <button
              type="button"
              className="listing-card-agent-btn"
              onClick={(e) => { e.stopPropagation(); onRequestAgent(listing); }}
            >
              <UserPlus size={14} />
              Get an agent
            </button>
          </div>
        )}
      </div>
    </div>
  );
}