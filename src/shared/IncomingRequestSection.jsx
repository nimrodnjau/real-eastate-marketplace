import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient'; // fixed casing to match the client used elsewhere
import { IconCheck, IconX } from './Icons';
import '../styles/incoming-requests.css'; // ADJUST path to match your styles folder
// NOTE: only IconCheck/IconX are confirmed to exist in your Icons.jsx.
// If you have icons for calendar/home/user, import them here and drop
// them back into the header row below where noted.

/*
  IncomingRequestsSection
  Requests that land here when a buyer/agent picks this professional via
  Stage1Connect.handleEngage(), which writes to
  marketplace.transaction_provider_engagements (transaction_id, task_key,
  provider_id, engaged_by, appointment_at).

  SCHEMA THINGS TO VERIFY / MIGRATE (see chat message for full context):
  1. `transaction_provider_engagements` needs a `status` column
     ('pending' | 'accepted' | 'declined', default 'pending') and a
     `created_at` timestamp for accept/decline + sorting to work.
  2. Column names assumed below on `transactions`
     (buyer_id, agent_id, seller_id, listing_id) and `listings`
     (title, price, address) — adjust the two queries marked // ADJUST
     if your real columns differ.
  3. RLS must allow a provider to read the transaction/listing/profile
     rows tied to engagements where provider_id = auth.uid().

  Props:
  - userId, roleConfig (see roleConfigs.js)
*/
export default function IncomingRequestsSection({ userId, roleConfig }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requests, setRequests] = useState([]);
  const [actingId, setActingId] = useState(null);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // 1. Engagement rows for this provider + role.
      const { data: engagements, error: engagementsError } = await supabase
        .schema('marketplace')
        .from('transaction_provider_engagements')
        .select('id, transaction_id, task_key, status, appointment_at, created_at, engaged_by')
        .eq('provider_id', userId)
        .eq('task_key', roleConfig.taskKey)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (engagementsError) {
        setError(engagementsError.message);
        setLoading(false);
        return;
      }

      if (!engagements?.length) {
        setRequests([]);
        setLoading(false);
        return;
      }

      // 2. Transactions those engagements belong to.
      const transactionIds = [...new Set(engagements.map((e) => e.transaction_id))];

      const { data: transactions, error: transactionsError } = await supabase
        .schema('marketplace')
        .from('transactions')
        .select('id, listing_id, buyer_id, agent_id, seller_id') // ADJUST if your columns differ
        .in('id', transactionIds);

      if (cancelled) return;

      if (transactionsError) {
        setError(transactionsError.message);
        setLoading(false);
        return;
      }

      const transactionsById = new Map((transactions || []).map((t) => [t.id, t]));

      // 3. Listings referenced by those transactions.
      const listingIds = [...new Set((transactions || []).map((t) => t.listing_id).filter(Boolean))];

      const { data: listings, error: listingsError } = listingIds.length
        ? await supabase
            .schema('marketplace')
            .from('listings')
            .select('id, title, price, address') // ADJUST if your columns differ
            .in('id', listingIds)
        : { data: [], error: null };

      if (cancelled) return;

      if (listingsError) {
        setError(listingsError.message);
        setLoading(false);
        return;
      }

      const listingsById = new Map((listings || []).map((l) => [l.id, l]));

      // 4. Names for the buyer + agent on each transaction.
      const profileIds = new Set();
      (transactions || []).forEach((t) => {
        if (t.buyer_id) profileIds.add(t.buyer_id);
        if (t.agent_id) profileIds.add(t.agent_id);
      });

      const { data: profiles, error: profilesError } = profileIds.size
        ? await supabase
            .schema('marketplace')
            .from('profiles')
            .select('id, full_name')
            .in('id', [...profileIds])
        : { data: [], error: null };

      if (cancelled) return;

      if (profilesError) {
        setError(profilesError.message);
      }

      const namesById = new Map((profiles || []).map((p) => [p.id, p.full_name]));

      // 5. Flatten into a display-ready shape.
      const assembled = engagements.map((engagement) => {
        const transaction = transactionsById.get(engagement.transaction_id);
        const listing = transaction ? listingsById.get(transaction.listing_id) : null;

        return {
          id: engagement.id,
          status: engagement.status || 'pending',
          appointmentAt: engagement.appointment_at,
          requestedAt: engagement.created_at,
          clientName: (transaction && namesById.get(transaction.buyer_id)) || 'A buyer',
          agentName: transaction?.agent_id
            ? namesById.get(transaction.agent_id) || 'Unassigned'
            : 'No agent on file',
          listingTitle: listing?.title || 'Listing not specified',
          listingValue: listing?.price ?? null,
          listingAddress: listing?.address || null,
        };
      });

      setRequests(assembled);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, roleConfig.taskKey]);

  async function respond(id, status) {
    setActingId(id);
    const { data, error: err } = await supabase
      .schema('marketplace')
      .from('transaction_provider_engagements')
      .update({ status })
      .eq('id', id)
      .select('id, status')
      .single();
    setActingId(null);
    if (err) {
      setError(err.message);
      return;
    }
    setRequests((rows) => rows.map((r) => (r.id === id ? { ...r, status: data.status } : r)));
  }

  const visible = requests.filter((r) => (filter === 'all' ? true : r.status === filter));

  function formatValue(value) {
    if (value == null) return null;
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatDate(iso) {
    if (!iso) return null;
    return new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  return (
    <div>
      <div className="pd-card-head" style={{ marginBottom: 6 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--pd-font-display)', fontSize: '1.15rem', fontWeight: 600 }}>
            Client requests
          </h2>
          <div className="pd-card-sub">New engagements from buyers who selected you.</div>
        </div>
      </div>

      <div className="pd-subtabs">
        {['pending', 'accepted', 'declined', 'all'].map((f) => (
          <button
            key={f}
            className={`pd-subtab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="pd-error">{error}</div>}

      {loading ? (
        <div className="pd-card">
          <div className="pd-loading">Loading requests…</div>
        </div>
      ) : visible.length === 0 ? (
        <div className="pd-card">
          <div className="pd-empty">
            <strong>Nothing here yet</strong>
            New requests from buyers will show up in this list.
          </div>
        </div>
      ) : (
        <div className="pd-request-list">
          {visible.map((req) => (
            <div className="pd-request-card" data-status={req.status} key={req.id}>
              <div className="pd-request-header">
                <div>
                  <div className="pd-request-client">{req.clientName}</div>
                  <span className="pd-request-role-tag">{roleConfig.label} request</span>
                </div>
                <span className={`pd-request-status ${req.status}`}>{req.status}</span>
              </div>

              <div className="pd-request-meta">
                <span className="pd-request-label">Property</span>
                <span className="pd-request-value">
                  {req.listingTitle}
                  {req.listingAddress ? ` — ${req.listingAddress}` : ''}
                </span>

                {req.listingValue != null && (
                  <>
                    <span className="pd-request-label">Value</span>
                    <span className="pd-request-value">{formatValue(req.listingValue)}</span>
                  </>
                )}

                <span className="pd-request-label">Agent</span>
                <span className="pd-request-value">{req.agentName}</span>

                {req.appointmentAt && (
                  <>
                    <span className="pd-request-label">Requested slot</span>
                    <span className="pd-request-value">{formatDate(req.appointmentAt)}</span>
                  </>
                )}

                <span className="pd-request-label">Requested</span>
                <span className="pd-request-value">{formatDate(req.requestedAt) || '—'}</span>
              </div>

              {req.status === 'pending' && (
                <div className="pd-request-actions">
                  <button
                    className="pd-btn pd-btn-ghost pd-btn-sm"
                    onClick={() => respond(req.id, 'declined')}
                    disabled={actingId === req.id}
                  >
                    <IconX width={13} height={13} /> Decline
                  </button>
                  <button
                    className="pd-btn pd-btn-primary pd-btn-sm"
                    onClick={() => respond(req.id, 'accepted')}
                    disabled={actingId === req.id}
                  >
                    <IconCheck width={13} height={13} /> Accept
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}