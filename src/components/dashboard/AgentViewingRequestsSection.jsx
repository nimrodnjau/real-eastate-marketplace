import { useState, useEffect, useCallback, useMemo } from 'react';
import { Phone, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import '../../styles/viewing-request.css'; // reuses .viewing-request-date-input, adds .list-row-edit-btn--decline + buyer-info rules

// Agent-side "Viewing requests" section for AgentDashboard — drop in as:
//   <AgentViewingRequestsSection listings={listings} />
// (listings prop = same array AgentDashboard already fetches for this
// agent; avoids a second listings query just to get the id list).
//
// Markup deliberately mirrors the commission tracker's inline <ul
// className="list-rows"> block in AgentDashboard.jsx rather than using
// ListRows — ListRows has no per-row action slot, and confirm/decline
// needs one per row, same reason the commission tracker doesn't use it
// either.
//
// Buyer contact info (phone/email/avatar) uses the same select shape as
// fetchSellerProfiles in AgentDashboard for listing requests, so a buyer
// card here shows the same level of detail a seller card does there.
//
// On confirm: calls the confirm_viewing_request RPC (does the
// agent-double-booking conflict check server-side) with whatever
// date/time the agent picked, defaulted to the buyer's preferred_at.
// On decline: plain status update — no conflict check needed, and there's
// no reason/note column on viewing_requests to attach a decline reason to
// (unlike listing requests, which have agent_decision_note). Add one via
// migration later if you want that.
//
// Both actions notify the buyer by dropping a message into the same
// buyer↔agent conversation used elsewhere — same find-or-create shape as
// openChat in ProfessionalsSection — so it shows up exactly where the
// buyer already checks for inquiry replies. Also fires the same
// send-push edge function MessagesSection.jsx's handleSend uses, so a
// confirm/decline reaches the buyer as a push notification too, not just
// a message that sits unread until they happen to open the app.
//
// ⚠ Confirm against the real marketplace.viewing_request_status enum:
// 'pending' matches the column default and 'confirmed' matches what the
// RPC itself sets; 'declined' is a guess for this file's reject action.
const STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
};

const STATUS_META = {
  [STATUS.PENDING]: { label: 'Requested', tone: 'pending' },
  [STATUS.CONFIRMED]: { label: 'Confirmed', tone: 'success' },
  [STATUS.DECLINED]: { label: 'Declined', tone: 'neutral' },
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function toDatetimeLocal(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function AgentViewingRequestsSection({ listings }) {
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [buyerProfiles, setBuyerProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null); // request currently being confirmed/declined
  const [actionError, setActionError] = useState(null);
  const [scheduledDrafts, setScheduledDrafts] = useState({}); // request_id -> datetime-local string

  const listingsById = useMemo(
    () => Object.fromEntries((listings || []).map((l) => [l.id, l])),
    [listings]
  );
  const listingIds = useMemo(() => (listings || []).map((l) => l.id), [listings]);

  const fetchBuyerProfiles = useCallback(async (buyerIds) => {
    const ids = [...new Set(buyerIds)];
    if (ids.length === 0) return;
    const { data } = await supabase
      .schema('marketplace')
      .from('profiles')
      .select('id, full_name, phone, email, avatar_url')
      .in('id', ids);
    setBuyerProfiles((prev) => ({
      ...prev,
      ...Object.fromEntries((data || []).map((p) => [p.id, p])),
    }));
  }, []);

  const fetchRequests = useCallback(async () => {
    if (listingIds.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('viewing_requests')
      .select('id, listing_id, buyer_id, status, preferred_at, scheduled_for, requested_at')
      .in('listing_id', listingIds)
      .order('requested_at', { ascending: true });

    if (error) {
      console.error('Failed to load viewing requests:', error);
      setError(error.message);
    } else {
      setRequests(data || []);
      setError(null);
      fetchBuyerProfiles((data || []).map((r) => r.buyer_id));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingIds.join(',')]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function notifyBuyer(buyerId, listingTitle, outcomeText) {
    if (!profile?.id || !buyerId) return;
    const [a, b] = [profile.id, buyerId].sort();

    const { data: existing } = await supabase
      .schema('marketplace')
      .from('conversations')
      .select('id')
      .eq('participant_one', a)
      .eq('participant_two', b)
      .maybeSingle();

    let conversationId = existing?.id;

    if (!conversationId) {
      const { data: created, error } = await supabase
        .schema('marketplace')
        .from('conversations')
        .insert({ participant_one: a, participant_two: b })
        .select('id')
        .single();
      if (error) {
        console.error('Failed to start conversation for viewing notification:', error);
        return;
      }
      conversationId = created.id;
    }

    const body = `Your viewing request for "${listingTitle || 'the listing'}" has been ${outcomeText}.`;

    const { error: messageError } = await supabase
      .schema('marketplace')
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        body,
      });

    if (messageError) {
      console.error('Failed to send viewing notification message:', messageError);
      return; // don't push a notification for a message that never sent
    }

    // Fire-and-forget, same as MessagesSection.jsx's handleSend — a push
    // failure shouldn't block or roll back the confirm/decline action,
    // the message itself has already landed either way.
    supabase.functions.invoke('send-push', {
      body: {
        user_id: buyerId,
        title: profile.full_name ? `New message from ${profile.full_name}` : 'New message',
        body,
        url: '/dashboard/messages',
      },
    }).catch((err) => console.error('Push notification failed:', err));
  }

  async function handleConfirm(request) {
    const draftValue = scheduledDrafts[request.id] ?? toDatetimeLocal(request.preferred_at);
    if (!draftValue || busyId) return;

    setBusyId(request.id);
    setActionError(null);

    const { error } = await supabase
      .schema('marketplace')
      .rpc('confirm_viewing_request', {
        request_id: request.id,
        new_scheduled_for: new Date(draftValue).toISOString(),
      });

    if (error) {
      console.error('Failed to confirm viewing request:', error);
      setActionError(
        error.message?.includes('agent_double_booked')
          ? 'You already have a viewing booked at that time — pick a different slot.'
          : 'Could not confirm this request — try again.'
      );
      setBusyId(null);
      return;
    }

    await notifyBuyer(
      request.buyer_id,
      listingsById[request.listing_id]?.title,
      `confirmed for ${formatDate(draftValue)}`
    );
    setBusyId(null);
    await fetchRequests();
  }

  async function handleDecline(request) {
    if (busyId) return;
    setBusyId(request.id);
    setActionError(null);

    const { error } = await supabase
      .schema('marketplace')
      .from('viewing_requests')
      .update({ status: STATUS.DECLINED, responded_at: new Date().toISOString() })
      .eq('id', request.id);

    if (error) {
      console.error('Failed to decline viewing request:', error);
      setActionError('Could not decline this request — try again.');
      setBusyId(null);
      return;
    }

    await notifyBuyer(request.buyer_id, listingsById[request.listing_id]?.title, 'declined');
    setBusyId(null);
    await fetchRequests();
  }

  if (loading) return <p>Loading requests…</p>;
  if (error) return <p className="dashboard-error">Couldn't load viewing requests: {error}</p>;
  if (requests.length === 0) return <p className="dashboard-empty">No viewing requests right now.</p>;

  return (
    <>
      {actionError && <p className="dashboard-error">{actionError}</p>}
      <ul className="list-rows">
        {requests.map((r) => {
          const listing = listingsById[r.listing_id];
          const buyer = buyerProfiles[r.buyer_id];
          const meta = STATUS_META[r.status] || { label: r.status, tone: 'neutral' };
          const isPending = r.status === STATUS.PENDING;
          const draftValue = scheduledDrafts[r.id] ?? toDatetimeLocal(r.preferred_at);

          return (
            <li key={r.id} className="list-row">
              <div className="viewing-request-buyer-info">
                {buyer?.avatar_url ? (
                  <img className="viewing-request-buyer-avatar" src={buyer.avatar_url} alt={buyer.full_name || 'Buyer'} />
                ) : (
                  <div className="viewing-request-buyer-avatar" />
                )}
                <div>
                  <p className="list-row-title">
                    {listing?.title || 'Listing'} — {buyer?.full_name || 'Buyer'}
                  </p>
                  <p className="list-row-meta">
                    Requested for {formatDate(r.preferred_at)}
                    {r.status === STATUS.CONFIRMED && r.scheduled_for && ` · Confirmed for ${formatDate(r.scheduled_for)}`}
                  </p>
                  {(buyer?.phone || buyer?.email) && (
                    <p className="viewing-request-buyer-contact">
                      {buyer?.phone && (
                        <a href={`tel:${buyer.phone}`}>
                          <Phone size={12} /> {buyer.phone}
                        </a>
                      )}
                      {buyer?.email && (
                        <a href={`mailto:${buyer.email}`}>
                          <Mail size={12} /> {buyer.email}
                        </a>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="list-row-actions">
                <span className={`badge badge--${meta.tone}`}>{meta.label}</span>
                {isPending && (
                  <>
                    <input
                      type="datetime-local"
                      className="viewing-request-date-input"
                      value={draftValue}
                      onChange={(e) =>
                        setScheduledDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="list-row-edit-btn"
                      onClick={() => handleConfirm(r)}
                      disabled={busyId === r.id}
                    >
                      {busyId === r.id ? 'Confirming…' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      className="list-row-edit-btn list-row-edit-btn--decline"
                      onClick={() => handleDecline(r)}
                      disabled={busyId === r.id}
                    >
                      Decline
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}