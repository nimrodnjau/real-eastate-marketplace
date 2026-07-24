// components/PublicListingCard.jsx
import { Bed, Bath, Car, LandPlot } from 'lucide-react';
import FavoriteButton from './FavoriteButton';

const PROPERTY_TYPE_LABEL = {
  land: 'Land',
  apartment: 'Apartment',
  house: 'House',
  commercial: 'Commercial',
  other: 'Property',
};

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

// Optional `badge`/`badgeTone` prop: a small top-left tag (e.g. "Price
// dropped", "New listing") separate from the "Unverified" watermark and
// the favorite button, used by WatchingSection. Omit both to skip it.
export default function PublicListingCard({ listing, onClick, badge, badgeTone = 'neutral' }) {
  const images = listing.images || [];
  const coverImage = images[0]?.url;
  const isLand = listing.property_type === 'land';
  const size = isLand ? formatSize(listing.size_value, listing.size_unit) : null;
  const isUnverified = listing.status === 'active' && !listing.agent_id;

  return (
    <div className="public-listing-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="public-listing-card-image-wrap">
        {coverImage ? (
          <img className="public-listing-card-image" src={coverImage} alt={listing.title} />
        ) : (
          <div className="public-listing-card-placeholder">No photo yet</div>
        )}
        {isUnverified && <span className="public-listing-card-watermark">Unverified</span>}
        {images.length > 0 && (
          <span className="public-listing-card-photo-count">1/{images.length}</span>
        )}
        {badge && (
          <span className={`public-listing-card-tag public-listing-card-tag--${badgeTone}`}>
            {badge}
          </span>
        )}
        <div className="public-listing-card-favorite">
          <FavoriteButton listingId={listing.id} />
        </div>
      </div>

      <div className="public-listing-card-body">
        <p className="public-listing-card-title">{listing.title}</p>
        <p className="public-listing-card-type">{PROPERTY_TYPE_LABEL[listing.property_type] || listing.property_type}</p>
        {listing.address && <p className="public-listing-card-address">{listing.address}</p>}

        <div className="public-listing-card-facts">
          {isLand ? (
            size && (
              <span className="public-listing-card-fact">
                <LandPlot size={15} />
                {size.primary}
                {size.secondary && <span className="public-listing-card-fact-sub">{size.secondary}</span>}
              </span>
            )
          ) : (
            <>
              {listing.bedrooms != null && (
                <span className="public-listing-card-fact"><Bed size={15} />{listing.bedrooms}</span>
              )}
              {listing.bathrooms != null && (
                <span className="public-listing-card-fact"><Bath size={15} />{listing.bathrooms}</span>
              )}
              {listing.parking != null && (
                <span className="public-listing-card-fact"><Car size={15} />{listing.parking}</span>
              )}
            </>
          )}
        </div>

        <p className="public-listing-card-price-label">Asking Price</p>
        <p className="public-listing-card-price">KES {Number(listing.price).toLocaleString()}</p>
      </div>
    </div>
  );
}