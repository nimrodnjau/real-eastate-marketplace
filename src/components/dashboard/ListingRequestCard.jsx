// components/dashboard/ListingRequestCard.jsx
import { Bed, Bath, Car, LandPlot } from 'lucide-react';
import '../../styles/listing-request-card.css';

// Renders a single seller-submitted listing request as a clickable card,
// styled to match ListingCard (photo, facts, price). Clicking it opens
// ListingRequestDetailModal, which shows the full property info, seller
// contact, verification documents, and location, plus Approve/Decline.
//
// Props:
//   request  - the listing row (status === 'pending_agent_review')
//   seller   - { id, full_name, phone } | undefined (still loading)
//   onOpen(request) - called when the card is clicked, opens the detail modal

const PROPERTY_TYPE_LABEL = {
  land: 'Land', apartment: 'Apartment', house: 'House', commercial: 'Commercial', other: 'Property',
};

const money = (v) =>
  v == null ? '—' : `KES ${Number(v).toLocaleString('en-KE')}`;

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

export default function ListingRequestCard({ request, seller, onOpen }) {
  const images = Array.isArray(request.images) ? request.images : [];
  const coverImage = images[0]?.url;
  const isLand = request.property_type === 'land';
  const size = isLand ? formatSize(request.size_value, request.size_unit) : null;

  return (
    <button
      type="button"
      className="listing-request-card"
      onClick={() => onOpen(request)}
    >
      <div className="listing-request-image-wrap">
        {coverImage ? (
          <img className="listing-request-image" src={coverImage} alt={request.title} />
        ) : (
          <div className="listing-request-image-placeholder">No photo yet</div>
        )}
        <span className="stamp-badge stamp-badge-pending">Awaiting review</span>
        {images.length > 0 && (
          <span className="listing-request-photo-count">1/{images.length}</span>
        )}
      </div>

      <div className="listing-request-body">
        <p className="listing-request-title">{request.title}</p>
        <p className="listing-request-type">
          {PROPERTY_TYPE_LABEL[request.property_type] || request.property_type}
        </p>

        <div className="listing-request-facts">
          {isLand ? (
            size && (
              <span className="listing-request-fact">
                <LandPlot size={15} />
                {size.primary}
              </span>
            )
          ) : (
            <>
              {request.bedrooms != null && (
                <span className="listing-request-fact"><Bed size={15} />{request.bedrooms}</span>
              )}
              {request.bathrooms != null && (
                <span className="listing-request-fact"><Bath size={15} />{request.bathrooms}</span>
              )}
              {request.parking != null && (
                <span className="listing-request-fact"><Car size={15} />{request.parking}</span>
              )}
            </>
          )}
        </div>

        <p className="listing-request-price-label">Asking Price</p>
        <p className="listing-request-price">{money(request.price)}</p>

        <div className="listing-request-seller">
          <span className="listing-request-label">Submitted by</span>
          <span>{seller ? seller.full_name : 'Loading…'}</span>
        </div>
      </div>
    </button>
  );
}