import { useEffect, useRef, useState } from 'react';
import StageWindow from './StageWindow';
import StageMessagePanel from './StageMessagePanel';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/stage2-negotiation.css';

function formatKES(amount) {
  return `KES ${Number(amount).toLocaleString()}`;
}

export default function Stage2Negotiation({
  transactionId,
  listing,
  buyerId,
  agentId,
  sellerId,
  viewerId,
  onAdvanceStage,
}) {
  const isBuyer = viewerId === buyerId;
  const isSellerSide = viewerId === sellerId || viewerId === agentId;

  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offerError, setOfferError] = useState('');
  const [offerSaving, setOfferSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [advancing, setAdvancing] = useState(false);

  const hasStartedAdvance = useRef(false);

  const latestOffer = offers[offers.length - 1];

  const latestIsMine =
    (latestOffer?.proposed_by === buyerId && isBuyer) ||
    (latestOffer?.proposed_by !== buyerId && isSellerSide);

  const canRespond =
    latestOffer?.status === 'pending' && !latestIsMine;

  const agreedOffer = offers.find((offer) => offer.status === 'accepted');
  const stageComplete = Boolean(agreedOffer);

  useEffect(() => {
    let cancelled = false;

    async function loadOffers() {
      setOffersLoading(true);
      setOfferError('');

      const { data, error } = await supabase
        .schema('marketplace')
        .from('offers')
        .select(
          'id, buyer_id, listing_id, transaction_id, proposed_by, amount, message, status, created_at, updated_at, responded_at, responded_by'
        )
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error('Failed to load offers:', error);
        setOfferError("Couldn't load offers. Please refresh and try again.");
        setOffers([]);
      } else {
        setOffers(data || []);
      }

      setOffersLoading(false);
    }

    loadOffers();

    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  useEffect(() => {
    if (!stageComplete || !agreedOffer || hasStartedAdvance.current) return;

    let cancelled = false;
    hasStartedAdvance.current = true;

    async function advanceToDocuments() {
      setAdvancing(true);
      setOfferError('');

      const { data, error } = await supabase
        .schema('marketplace')
        .from('transactions')
        .update({
          stage: 'doc_verify',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId)
        .select('id, stage, updated_at')
        .single();

      if (cancelled) return;

      if (error) {
        console.error('Failed to advance to document verification:', error);
        setOfferError(
          "The offer was accepted, but we couldn't move the purchase to Documents."
        );
        setAdvancing(false);
        hasStartedAdvance.current = false;
        return;
      }

      onAdvanceStage?.(data.stage, {
        agreedAmount: Number(agreedOffer.amount),
      });
    }

    advanceToDocuments();

    return () => {
      cancelled = true;
    };
  }, [stageComplete, agreedOffer, transactionId, onAdvanceStage]);

  async function handleSubmitOffer(event) {
    event.preventDefault();

    const offerAmount = Number(amount);

    if (!offerAmount || offerAmount <= 0 || offerSaving) return;

    setOfferSaving(true);
    setOfferError('');

    // A counteroffer closes the previous pending offer.
    if (latestOffer?.status === 'pending') {
      const { error: withdrawError } = await supabase
        .schema('marketplace')
        .from('offers')
        .update({
          status: 'withdrawn',
          responded_at: new Date().toISOString(),
          responded_by: viewerId,
        })
        .eq('id', latestOffer.id);

      if (withdrawError) {
        console.error('Failed to close previous offer:', withdrawError);
        setOfferError("Couldn't submit your counteroffer. Please try again.");
        setOfferSaving(false);
        return;
      }
    }

    const { data, error } = await supabase
      .schema('marketplace')
      .from('offers')
      .insert({
        transaction_id: transactionId,
        buyer_id: buyerId,
        listing_id: listing.id,
        proposed_by: viewerId,
        amount: offerAmount,
        message: message.trim() || null,
        status: 'pending',
      })
      .select(
        'id, buyer_id, listing_id, transaction_id, proposed_by, amount, message, status, created_at, updated_at, responded_at, responded_by'
      )
      .single();

    if (error) {
      console.error('Failed to submit offer:', error);
      setOfferError("Couldn't submit your offer. Please try again.");
      setOfferSaving(false);
      return;
    }

    setOffers((previous) => [
      ...previous.map((offer) =>
        offer.id === latestOffer?.id
          ? {
              ...offer,
              status: 'withdrawn',
              responded_at: new Date().toISOString(),
              responded_by: viewerId,
            }
          : offer
      ),
      data,
    ]);

    setAmount('');
    setMessage('');
    setOfferSaving(false);
  }

  async function handleRespond(status) {
    if (!latestOffer || offerSaving) return;

    setOfferSaving(true);
    setOfferError('');

    const { data, error } = await supabase
      .schema('marketplace')
      .from('offers')
      .update({
        status,
        responded_at: new Date().toISOString(),
        responded_by: viewerId,
      })
      .eq('id', latestOffer.id)
      .select(
        'id, buyer_id, listing_id, transaction_id, proposed_by, amount, message, status, created_at, updated_at, responded_at, responded_by'
      )
      .single();

    if (error) {
      console.error('Failed to respond to offer:', error);
      setOfferError("Couldn't update this offer. Please try again.");
      setOfferSaving(false);
      return;
    }

    setOffers((previous) =>
      previous.map((offer) => (offer.id === data.id ? data : offer))
    );

    setOfferSaving(false);
  }

  return (
    <StageWindow
      stageNumber={2}
      title="Negotiation"
      subtitle={`Agree on a price for ${listing?.title || 'this property'}. Once both sides accept, we move to document verification.`}
      isComplete={stageComplete}
      clearedTitle="Price agreed"
      clearedSubtitle={
        agreedOffer
          ? `Settled at ${formatKES(agreedOffer.amount)}. Moving to Documents.`
          : undefined
      }
      messagesSlot={
        <StageMessagePanel
          counterpart={{
            name: isBuyer ? 'Seller' : 'Buyer',
            role: isBuyer ? 'seller' : 'buyer',
          }}
          viewerId={viewerId}
          mockMessages={[]}
        />
      }
    >
      {offerError && (
        <p className="messaging-attach-error">{offerError}</p>
      )}

      {offersLoading ? (
        <p className="stage-empty">Loading real offers…</p>
      ) : offers.length === 0 ? (
        <p className="stage-empty">
          No offers yet. Make the first offer to begin negotiation.
        </p>
      ) : (
        <div className="stage2-thread">
          {offers.map((offer) => {
            const isBuyerOffer = offer.proposed_by === buyerId;
            const mine = offer.proposed_by === viewerId;

            return (
              <div
                key={offer.id}
                className={`stage2-offer${mine ? ' stage2-offer--mine' : ''}`}
              >
                <div className="stage2-offer-top">
                  <span className="stage2-offer-from">
                    {isBuyerOffer ? 'Buyer' : 'Seller'} offered
                  </span>

                  <span
                    className={`stage-pill ${
                      offer.status === 'accepted'
                        ? 'stage-pill--verified'
                        : offer.status === 'rejected'
                          ? 'stage-pill--alert'
                          : offer.status === 'withdrawn'
                            ? 'stage-pill--pending'
                            : 'stage-pill--active'
                    }`}
                  >
                    {offer.status}
                  </span>
                </div>

                <p className="stage2-offer-amount stage-amount">
                  {formatKES(offer.amount)}
                </p>

                {offer.message && (
                  <p className="stage2-offer-message">{offer.message}</p>
                )}

                <p className="stage2-offer-time">
                  {new Date(offer.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {!stageComplete && canRespond && (
        <div className="stage2-respond">
          <button
            type="button"
            className="stage-btn stage-btn--primary"
            disabled={offerSaving}
            onClick={() => handleRespond('accepted')}
          >
            Accept {formatKES(latestOffer.amount)}
          </button>

          <button
            type="button"
            className="stage-btn stage-btn--ghost"
            disabled={offerSaving}
            onClick={() => handleRespond('rejected')}
          >
            Reject
          </button>
        </div>
      )}

      {!stageComplete && (
        <>
          <hr className="stage-divider" />

          <form className="stage2-offer-form" onSubmit={handleSubmitOffer}>
            <p
              className="stage1-section-title"
              style={{ marginBottom: 12 }}
            >
              {latestOffer ? 'Counter with a new offer' : 'Make an offer'}
            </p>

            <div className="stage2-offer-form-row">
              <div className="stage-field" style={{ flex: '0 0 220px' }}>
                <label htmlFor="offer-amount">Amount (KES)</label>

                <input
                  id="offer-amount"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={
                    listing?.price ? String(listing.price) : '8000000'
                  }
                />
              </div>

              <div className="stage-field" style={{ flex: 1 }}>
                <label htmlFor="offer-message">Note (optional)</label>

                <input
                  id="offer-message"
                  type="text"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Add context for this offer…"
                />
              </div>
            </div>

            <button
              type="submit"
              className="stage-btn stage-btn--brass"
              disabled={!amount || offerSaving}
            >
              {offerSaving ? 'Saving…' : 'Submit offer'}
            </button>
          </form>
        </>
      )}
    </StageWindow>
  );
}