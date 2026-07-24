import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/supabaseClient';
import '../../styles/ongoing-purchases.css';
// ASSUMPTIONS TO VERIFY: marketplace.transaction_stage enum values — swap
// or add entries here to match the real enum (default seen in schema is
// 'connect'). Unmapped stages fall back to a prettified raw string.
const STAGE_LABELS = {
  connect: 'Connecting',
  viewing: 'Viewing',
  offer: 'Offer',
  escrow: 'In escrow',
  closing: 'Closing',
  completed: 'Completed',
};

function formatStage(stage) {
  if (STAGE_LABELS[stage]) return STAGE_LABELS[stage];
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function OngoingPurchasesSection() {
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await db
        .schema('marketplace')
        .from('transactions')
        .select(
          'id, stage, updated_at, listing:listing_id (id, title, images, price, address, property_type)'
        )
        .eq('buyer_id', profile.id)
        .order('updated_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        setError(error.message);
      } else {
        setPurchases(data || []);
      }
      setLoading(false);
    }

    if (profile?.id) load();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  if (loading) return <p className="ongoing-purchases-state">Loading your purchases…</p>;
  if (error) {
    return (
      <p className="ongoing-purchases-state ongoing-purchases-error">
        Couldn't load purchases: {error}
      </p>
    );
  }
  if (purchases.length === 0) {
    return (
      <p className="ongoing-purchases-state">
        No purchases in progress yet — start one from a listing you like.
      </p>
    );
  }

  return (
    <ul className="ongoing-purchases-list">
      {purchases.map((p) => (
        <li key={p.id} className="ongoing-purchase-card">
          <button
            type="button"
            className="ongoing-purchase-card-button"
            onClick={() => navigate(`/purchases/${p.id}`)}
          >
            {p.listing?.images?.[0]?.url && (
              <img className="ongoing-purchase-thumb" src={p.listing.images[0].url} alt="" />
            )}
            <div className="ongoing-purchase-info">
              <span className="ongoing-purchase-title">{p.listing?.title || 'Listing'}</span>
              {p.listing?.address && (
                <span className="ongoing-purchase-address">{p.listing.address}</span>
              )}
              <span className="ongoing-purchase-stage">{formatStage(p.stage)}</span>
            </div>
            <span className="ongoing-purchase-continue">Continue &rarr;</span>
          </button>
        </li>
      ))}
    </ul>
  );
}