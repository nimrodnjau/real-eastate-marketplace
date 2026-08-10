import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Stage1Connect from '../components/stages/Stage1Connect';
import Stage2Negotiation from '../components/stages/Stage2Negotiation';
import Stage3Documents from '../components/stages/Stage3Documents';
import Stage4Payment from '../components/stages/Stage4Payment';
import Stage5Verification from '../components/stages/Stage5Verification';
import Stage6Closed from '../components/stages/Stage6Closed';
import Stage7Taxation from '../components/stages/Stage7Taxation';
import Stage8Archived from '../components/stages/Stage8Archived';
import PurchaseProgressTracker from '../components/PurchaseProgressTracker';
import '../styles/purchase-tracker-page.css';

const STAGE_COMPONENTS = {
  connect: Stage1Connect,
  engage_pros: Stage1Connect,
  negotiate: Stage2Negotiation,
  doc_verify: Stage3Documents,
  pay_escrow: Stage4Payment,
  close_deal: Stage6Closed,
  payout_tax: Stage7Taxation,
  complete: Stage8Archived,
};

const STAGE_LABELS = {
  connect: 'Connect',
  engage_pros: 'Engage professionals',
  negotiate: 'Negotiation',
  doc_verify: 'Documents & verification',
  pay_escrow: 'Payment & escrow',
  close_deal: 'Closed',
  payout_tax: 'Taxation',
  complete: 'Record',
};

export default function PurchaseTracker() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [transaction, setTransaction] = useState(null);
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localOverride, setLocalOverride] = useState({});

  const fetchTransaction = useCallback(async () => {
    const { data, error: transactionError } = await db
      .schema('marketplace')
      .from('transactions')
      .select(
        'id, listing_id, buyer_id, agent_id, seller_id, stage, created_at, updated_at'
      )
      .eq('id', id)
      .single();

    if (transactionError) {
      setError(transactionError.message);
      return null;
    }

    setTransaction(data);
    return data;
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setLocalOverride({});

      const data = await fetchTransaction();

      if (cancelled) return;

      if (!data) {
        setLoading(false);
        return;
      }

      const { data: listingData, error: listingError } = await db
        .schema('marketplace')
        .from('listings')
        .select('id, title, address, price, images')
        .eq('id', data.listing_id)
        .single();

      if (cancelled) return;

      if (listingError) {
        console.error('Failed to load listing for transaction:', listingError);
      }

      setListing(listingData || null);
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id, fetchTransaction]);

  const handleStageAdvance = useCallback((nextStage, extra = {}) => {
    setLocalOverride((previous) => ({
      ...previous,
      stage: nextStage,
      ...extra,
    }));
  }, []);

  if (loading) {
    return (
      <div className="purchase-tracker-page-state">
        Loading your purchase…
      </div>
    );
  }

  if (error) {
    return (
      <div className="purchase-tracker-page-state purchase-tracker-page-error">
        Couldn't load this purchase: {error}
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="purchase-tracker-page-state">
        Purchase not found.
      </div>
    );
  }

  const currentStage = localOverride.stage || transaction.stage;
  const StageComponent = STAGE_COMPONENTS[currentStage];

  const isBuyer = profile?.id === transaction.buyer_id;
  const isAgentOrSeller =
    profile?.id === transaction.agent_id ||
    profile?.id === transaction.seller_id;

  const viewerIsStaff = profile?.role === 'staff';

  return (
    <div className="purchase-tracker-page">
      <button
        type="button"
        className="purchase-tracker-page-back"
        onClick={() => navigate(-1)}
      >
        &larr; Back
      </button>

      <header className="purchase-tracker-page-header">
        <h1>{listing?.title || 'Your purchase'}</h1>

        {listing?.address && (
          <p className="purchase-tracker-page-address">
            {listing.address}
          </p>
        )}

        {listing?.price != null && (
          <p className="purchase-tracker-page-price">
            KES {Number(listing.price).toLocaleString()}
          </p>
        )}
      </header>

      <PurchaseProgressTracker currentStage={currentStage} />

      {!isBuyer && !isAgentOrSeller && (
        <p className="purchase-tracker-page-note">
          You're viewing this purchase.
        </p>
      )}

      {!StageComponent ? (
        <div className="purchase-tracker-page-state">
          Unrecognized stage "{currentStage}".{' '}
          {STAGE_LABELS[currentStage]
            ? ''
            : "This stage isn't built yet."}
        </div>
      ) : (
        <StageComponent
          transactionId={transaction.id}
          listing={listing}
          buyerId={transaction.buyer_id}
          agentId={transaction.agent_id}
          sellerId={transaction.seller_id}
          viewerId={profile?.id}
          viewerIsStaff={viewerIsStaff}
          agreedAmount={localOverride.agreedAmount}
          finalAmount={localOverride.agreedAmount}
          onAdvanceStage={handleStageAdvance}
        />
      )}
    </div>
  );
}