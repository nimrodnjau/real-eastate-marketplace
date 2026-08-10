import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import BuyerProfileModal from './BuyerProfileModal';

const STAGE_LABELS = {
  connect: 'Connect',
  engage_pros: 'Engage professionals',
  negotiate: 'Negotiation',
  doc_verify: 'Documents & verification',
  pay_escrow: 'Payment & escrow',
  close_deal: 'Closing deal',
  payout_tax: 'Payout & tax',
  complete: 'Complete',
};

export default function AgentActiveDealsSection({ agentId }) {
  const navigate = useNavigate();

  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState(null);

  const fetchDeals = useCallback(async () => {
    if (!agentId) return;

    setLoading(true);
    setError('');

    const { data: transactions, error: transactionsError } = await supabase
      .schema('marketplace')
      .from('transactions')
      .select('id, listing_id, buyer_id, stage, created_at, updated_at')
      .eq('agent_id', agentId)
      .neq('stage', 'complete')
      .order('updated_at', { ascending: false });

    if (transactionsError) {
      console.error('Failed to load agent deals:', transactionsError);
      setError(transactionsError.message);
      setLoading(false);
      return;
    }

    const listingIds = (transactions || []).map((t) => t.listing_id);
    const buyerIds = [...new Set((transactions || []).map((t) => t.buyer_id))];

    const [{ data: listings, error: listingsError }, { data: buyers, error: buyersError }] =
      await Promise.all([
        listingIds.length
          ? supabase
              .schema('marketplace')
              .from('listings')
              .select('id, title, address')
              .in('id', listingIds)
          : Promise.resolve({ data: [], error: null }),
        buyerIds.length
  ? supabase
      .schema('marketplace')
      .from('profiles')
      .select(
        'id, full_name, avatar_url, phone, email, country, created_at, rating_avg, rating_count, is_suspended, bio'
      )
      .in('id', buyerIds)
  : Promise.resolve({ data: [], error: null }),
      ]);

    if (listingsError) {
      console.error('Failed to load deal listings:', listingsError);
      setError(listingsError.message);
      setLoading(false);
      return;
    }

    if (buyersError) {
      // Don't fail the whole section over profile data — just log it and
      // leave buyer info off the rows. Likely an RLS gap on `profiles`
      // if this fires consistently.
      console.error('Failed to load buyer profiles:', buyersError);
    }

    const listingsById = new Map((listings || []).map((l) => [l.id, l]));
    const buyersById = new Map((buyers || []).map((b) => [b.id, b]));

    setDeals(
      (transactions || []).map((transaction) => ({
        ...transaction,
        listing: listingsById.get(transaction.listing_id),
        buyer: buyersById.get(transaction.buyer_id),
      }))
    );

    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  if (loading) {
    return <p>Loading active deals…</p>;
  }

  if (error) {
    return (
      <p className="dashboard-error">
        Couldn't load active deals: {error}
      </p>
    );
  }

  if (deals.length === 0) {
    return (
      <p className="dashboard-empty">
        No active purchase deals yet.
      </p>
    );
  }

  return (
    <>
      <ul className="list-rows">
        {deals.map((deal) => (
          <li key={deal.id} className="list-row">
            <div>
              <p className="list-row-title">
                {deal.listing?.title || 'Property purchase'}
              </p>

              <p className="list-row-meta">
                {deal.listing?.address || 'Address unavailable'} ·{' '}
                {STAGE_LABELS[deal.stage] || deal.stage}
                {deal.buyer?.full_name && <> · Buyer: {deal.buyer.full_name}</>}
              </p>
            </div>

            <div className="list-row-actions">
              <span className="badge badge--pending">
                {STAGE_LABELS[deal.stage] || deal.stage}
              </span>

              {deal.buyer && (
                <button
                  type="button"
                  className="list-row-buyer-btn"
                  onClick={() => setSelectedBuyer(deal.buyer)}
                >
                  View buyer
                </button>
              )}

              <button
                type="button"
                className="list-row-edit-btn"
                onClick={() => navigate(`/purchases/${deal.id}`)}
              >
                Open deal
              </button>
            </div>
          </li>
        ))}
      </ul>

      <BuyerProfileModal
        buyer={selectedBuyer}
        onClose={() => setSelectedBuyer(null)}
      />
    </>
  );
}