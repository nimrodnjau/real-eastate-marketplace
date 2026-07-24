import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import PurchaseProgressTracker, { TRANSACTION_STAGES } from '../components/PurchaseProgressTracker';
import StageTaskModule from '../components/StageTaskModule';
import '../styles/purchase-tracker-page.css';

export default function PurchaseTracker() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [transaction, setTransaction] = useState(null);
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTransaction = useCallback(async () => {
    const { data, error } = await db
      .schema('marketplace')
      .from('transactions')
      .select('id, listing_id, buyer_id, agent_id, seller_id, stage, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      setError(error.message);
      return null;
    }

    setTransaction(data);
    return data;
  }, [id]);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const data = await fetchTransaction();
      if (!data) {
        setLoading(false);
        return;
      }

      const { data: listingData } = await db
        .schema('marketplace')
        .from('listings')
        .select('id, title, address, price, images')
        .eq('id', data.listing_id)
        .single();

      setListing(listingData || null);
      setLoading(false);
    }

    load();
  }, [id, fetchTransaction]);

  // Called by StageTaskModule right after the RPC reports the transaction
  // moved to a new stage. We optimistically bump the local stage so the
  // next module mounts immediately, then re-fetch to stay in sync with
  // anything else the trigger/RPC changed (e.g. updated_at).
  const handleStageAdvance = useCallback(
    (nextStage) => {
      setTransaction((prev) => (prev ? { ...prev, stage: nextStage } : prev));
      fetchTransaction();
    },
    [fetchTransaction]
  );

  if (loading) return <div className="purchase-tracker-page-state">Loading your purchase…</div>;
  if (error) return <div className="purchase-tracker-page-state purchase-tracker-page-error">Couldn't load this purchase: {error}</div>;
  if (!transaction) return <div className="purchase-tracker-page-state">Purchase not found.</div>;

  const currentStageInfo = TRANSACTION_STAGES.find((s) => s.key === transaction.stage);
  const isBuyer = profile?.id === transaction.buyer_id;
  const isAgentOrSeller = profile?.id === transaction.agent_id || profile?.id === transaction.seller_id;

  return (
    <div className="purchase-tracker-page">
      <button type="button" className="purchase-tracker-page-back" onClick={() => navigate(-1)}>
        &larr; Back
      </button>

      <header className="purchase-tracker-page-header">
        <h1>{listing?.title || 'Your purchase'}</h1>
        {listing?.address && <p className="purchase-tracker-page-address">{listing.address}</p>}
        {listing?.price != null && (
          <p className="purchase-tracker-page-price">KES {Number(listing.price).toLocaleString()}</p>
        )}
      </header>

      <div className="purchase-tracker-page-current">
        <span className="purchase-tracker-page-current-label">Current stage</span>
        <span className="purchase-tracker-page-current-value">{currentStageInfo?.label || transaction.stage}</span>
      </div>

      <PurchaseProgressTracker currentStage={transaction.stage} />

      {!isBuyer && !isAgentOrSeller && (
        <p className="purchase-tracker-page-note">You're viewing this purchase.</p>
      )}

      {(isBuyer || isAgentOrSeller) && (
        <StageTaskModule
          transactionId={transaction.id}
          stage={transaction.stage}
          buyerId={transaction.buyer_id}
          agentId={transaction.agent_id}
          sellerId={transaction.seller_id}
          viewerId={profile?.id}
          onStageAdvance={handleStageAdvance}
        />
      )}
    </div>
  );
}