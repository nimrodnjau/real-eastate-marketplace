import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicListingCard from '../PublicListingCard';
import { db } from '../../lib/supabaseClient';

// "Properties you're watching" — pulled out of BuyerDashboard.jsx so this
// section's data-fetching and badge logic live in one place. Reads
// marketplace.favorites joined with marketplace.listings for the current
// buyer, and derives a badge per row:
//   - "Price dropped" if the live price is below the price snapshot
//     taken when the buyer saved the listing (favorites.price_at_save)
//   - "New listing" if the listing was created in the last 7 days
//   - otherwise no badge
//
// Renders real PublicListingCard components (same as the browse page),
// not plain list rows — so photos, facts, and the favorite button all
// show up here too.

const NEW_LISTING_WINDOW_DAYS = 7;

function getBadge(listing, priceAtSave) {
  if (priceAtSave != null && Number(listing.price) < Number(priceAtSave)) {
    return { badge: 'Price dropped', badgeTone: 'success' };
  }
  const ageMs = Date.now() - new Date(listing.created_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= NEW_LISTING_WINDOW_DAYS) {
    return { badge: 'New listing', badgeTone: 'neutral' };
  }
  return {};
}

export default function WatchingSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function loadWatching() {
      setLoading(true);
      const { data, error } = await db
        .from('favorites')
        .select(`
          listing_id, price_at_save,
          listings(
            id, title, property_type, price, address, images, agent_id,
            bedrooms, bathrooms, parking, size_value, size_unit, status, created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error('Failed to load watched properties:', error);
        setError(error);
        setLoading(false);
        return;
      }

      const validRows = (data || []).filter((row) => row.listings); // drop deleted listings
      setRows(validRows);
      setLoading(false);
    }

    loadWatching();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <p className="list-empty">Loading…</p>;
  }

  if (error) {
    return <p className="list-empty">Couldn't load your watched properties.</p>;
  }

  if (rows.length === 0) {
    return <p className="list-empty">You haven't saved any properties yet.</p>;
  }

  return (
    <div className="public-listings-grid">
      {rows.map((row) => {
        const { badge, badgeTone } = getBadge(row.listings, row.price_at_save);
        return (
          <PublicListingCard
            key={row.listing_id}
            listing={row.listings}
            badge={badge}
            badgeTone={badgeTone}
            onClick={() => navigate(`/listings/${row.listings.id}`)}
          />
        );
      })}
    </div>
  );
}