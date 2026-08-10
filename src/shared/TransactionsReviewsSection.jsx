import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient'; // ADJUST to your actual client path
import { IconStar } from './Icons';

const STAGE_LABELS = {
  search: 'Search',
  connect: 'Connect',
  engage_professionals: 'Engage professionals',
  negotiate: 'Negotiate',
  document_verify: 'Document & verify',
  pay_escrow: 'Pay & escrow',
  close_deal: 'Close deal',
  payout_tax: 'Payout & tax',
  complete: 'Complete',
};

/*
  TransactionsReviewsSection
  Two tabs: transactions this professional is currently engaged on, and the
  reviews they've received (marketplace.professional_reviews).

  ASSUMPTION TO VERIFY: transactions this provider is engaged on are found
  via transaction_task_completions.assigned_provider_id, filtered to this
  role's task_key (from StageTaskModule's task-completion model), then
  joined to transactions.listing_id -> listings. If provider assignment or
  the listing link is tracked differently in your schema, only load()
  below needs to change — the rendering stays the same.

  Deliberately does NOT use PostgREST's embedded-relationship syntax
  (`.select('transactions(...)')`). That syntax needs a real foreign-key
  constraint PostgREST can see in its schema cache, and fails with a plain
  400 (no useful message) if that FK isn't there, is ambiguous, or the
  table/column name is off. Fetching each table separately and joining in
  JS sidesteps that — the tradeoff is a few more round trips, which is fine
  for a dashboard.
*/
function describeError(table, err) {
  if (!err) return null;
  const parts = [err.message];
  if (err.hint) parts.push(err.hint);
  if (err.details) parts.push(err.details);
  return `${table}: ${parts.filter(Boolean).join(' — ')}`;
}

export default function TransactionsReviewsSection({ userId, roleConfig }) {
  const [tab, setTab] = useState('transactions');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const errors = [];

      const { data: completions, error: compErr } = await supabase
        .schema('marketplace')
        .from('transaction_task_completions')
        .select('id, transaction_id')
        .eq('assigned_provider_id', userId)
        .eq('task_key', roleConfig.taskKey);
      if (compErr) errors.push(describeError('transaction_task_completions', compErr));

      let txRows = [];
      const txIds = [...new Set((completions || []).map((c) => c.transaction_id).filter(Boolean))];
      if (txIds.length) {
        const { data: txs, error: txErr } = await supabase
          .schema('marketplace')
          .from('transactions')
          .select('id, stage, listing_id')
          .in('id', txIds);
        if (txErr) {
          errors.push(describeError('transactions', txErr));
        } else {
          const listingIds = [...new Set((txs || []).map((t) => t.listing_id).filter(Boolean))];
          let listingsById = {};
          if (listingIds.length) {
            const { data: listings, error: listErr } = await supabase
              .schema('marketplace')
              .from('listings')
              .select('id, title, location')
              .in('id', listingIds);
            if (listErr) errors.push(describeError('listings', listErr));
            else listingsById = Object.fromEntries((listings || []).map((l) => [l.id, l]));
          }
          txRows = (txs || []).map((t) => ({ id: t.id, stage: t.stage, listing: listingsById[t.listing_id] }));
        }
      }

      const { data: reviewData, error: reviewErr } = await supabase
        .schema('marketplace')
        .from('professional_reviews')
        .select('*')
        .eq('provider_id', userId)
        .order('created_at', { ascending: false });
      if (reviewErr) errors.push(describeError('professional_reviews', reviewErr));

      if (cancelled) return;
      setTransactions(txRows);
      setReviews(reviewData || []);
      if (errors.length) setError(errors.join(' | '));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, roleConfig.taskKey]);

  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div>
      <div className="pd-subtabs">
        <button className={`pd-subtab ${tab === 'transactions' ? 'active' : ''}`} onClick={() => setTab('transactions')}>
          Active transactions
        </button>
        <button className={`pd-subtab ${tab === 'reviews' ? 'active' : ''}`} onClick={() => setTab('reviews')}>
          Reviews {avgRating && `(${avgRating})`}
        </button>
      </div>

      {error && <div className="pd-error">{error}</div>}

      {loading ? (
        <div className="pd-loading">Loading…</div>
      ) : tab === 'transactions' ? (
        <div className="pd-card">
          {transactions.length === 0 ? (
            <div className="pd-empty">
              <strong>No active transactions</strong>
              Deals you're engaged on will appear here once a buyer books you.
            </div>
          ) : (
            transactions.map((t) => (
              <div className="pd-list-row" key={t.id}>
                <div className="pd-list-main">
                  <span className="pd-list-title">{t.listing?.title || 'Listing'}</span>
                  <span className="pd-list-meta">{t.listing?.location || ''}</span>
                </div>
                <span className="pd-badge neutral">{STAGE_LABELS[t.stage] || t.stage || 'In progress'}</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="pd-card">
          {reviews.length === 0 ? (
            <div className="pd-empty">
              <strong>No reviews yet</strong>
              Reviews from clients you've worked with will show up here.
            </div>
          ) : (
            reviews.map((r) => (
              <div className="pd-list-row" key={r.id} style={{ alignItems: 'flex-start' }}>
                <div className="pd-list-main">
                  <span className="pd-list-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <IconStar
                        key={i}
                        width={13}
                        height={13}
                        style={{ color: i < (r.rating || 0) ? 'var(--pd-maroon)' : 'var(--pd-border)' }}
                      />
                    ))}
                  </span>
                  {r.comment && <span className="pd-list-meta">"{r.comment}"</span>}
                </div>
                <span className="pd-list-meta">{r.reviewer_name || 'Client'}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}