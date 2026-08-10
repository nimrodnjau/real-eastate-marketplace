import LandlordListingCard from './LandlordListingCard';

/**
 * Renders the landlord's listings as a card grid. `listings` should be the
 * raw listing rows (not the display-mapped `unitItems` shape ListRows used) —
 * cards need images/price/bedrooms/etc. directly.
 */
export default function LandlordListingCardsGrid({
  listings,
  emptyLabel,
  onOpen,
  onSubmit,
  onRequestAgent,
}) {
  if (!listings.length) {
    return <p className="listing-cards-empty">{emptyLabel}</p>;
  }

  return (
    <div className="listing-cards-grid">
      {listings.map((listing) => (
        <LandlordListingCard
          key={listing.id}
          listing={listing}
          onOpen={onOpen}
          onSubmit={onSubmit}
          onRequestAgent={onRequestAgent}
        />
      ))}
    </div>
  );
}