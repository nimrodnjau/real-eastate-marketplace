import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Loader2 } from 'lucide-react';
import { db } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import '../styles/viewing-request.css';

// Drop into a listing detail page: <RequestViewingButton listingId={listing.id} />
//
// Lives flat in components/ (same depth as ListingsMap), not under
// components/dashboard/ — imports are one level up (`../lib`, `../context`,
// `../styles`) to match.
//
// Buyer picks a preferred date/time on request (marketplace.viewing_requests
// now has a preferred_at column — see the migration). The agent still owns
// the final scheduled_for via confirm_viewing_request; preferred_at is what
// the buyer asked for, scheduled_for is what actually got confirmed, and
// they may differ if the agent proposes a different time.
//
// On mount this checks for an existing pending/confirmed request so the
// same buyer can't double-request the same listing, and reflects whatever
// state that request is in instead of showing the form again. If nobody
// is logged in, submitting routes to login and back — same redirectTo
// shape as handleInquiry in ListingDetail.

// ⚠ Confirm these against the actual marketplace.viewing_request_status
// enum values — 'pending' matches the column default, the rest are
// assumptions until verified.
const STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
};
const ACTIVE_STATUSES = [STATUS.PENDING, STATUS.CONFIRMED];

function minDateTimeLocal() {
  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time, not ISO/UTC —
  // toISOString would shift the displayed min by the browser's UTC offset.
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function RequestViewingButton({ listingId }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [existing, setExisting] = useState(undefined); // undefined = loading, null = none found, object = found
  const [preferredAt, setPreferredAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!listingId) return;

    // Logged out: nothing to check against a buyer_id — show the form
    // immediately, submit will redirect to login instead of inserting.
    if (!profile?.id) {
      setExisting(null);
      return;
    }

    let isMounted = true;

    db
      .schema('marketplace')
      .from('viewing_requests')
      .select('id, status, preferred_at, scheduled_for')
      .eq('buyer_id', profile.id)
      .eq('listing_id', listingId)
      .in('status', ACTIVE_STATUSES)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('Failed to check existing viewing request:', error);
          setExisting(null);
          return;
        }
        setExisting(data || null);
      });

    return () => {
      isMounted = false;
    };
  }, [profile?.id, listingId]);

  async function handleRequest(e) {
    e.preventDefault();
    if (submitting) return;

    if (!profile?.id) {
      navigate('/login', { state: { redirectTo: `/listings/${listingId}` } });
      return;
    }

    if (!preferredAt) {
      setError('Pick a date and time first.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data, error } = await db
      .schema('marketplace')
      .from('viewing_requests')
      .insert({
        buyer_id: profile.id,
        listing_id: listingId,
        preferred_at: new Date(preferredAt).toISOString(),
      })
      .select('id, status, preferred_at, scheduled_for')
      .single();

    setSubmitting(false);

    if (error) {
      console.error('Failed to request viewing:', error);
      setError('Could not send your request — try again.');
      return;
    }
    setExisting(data);
  }

  if (existing === undefined) {
    return (
      <button type="button" className="viewing-request-btn viewing-request-btn--loading" disabled>
        <Loader2 size={15} className="viewing-request-spinner" /> Checking…
      </button>
    );
  }

  if (existing?.status === STATUS.CONFIRMED) {
    return (
      <div className="viewing-request-status viewing-request-status--confirmed">
        <CalendarCheck size={15} />
        Viewing confirmed —{' '}
        {new Date(existing.scheduled_for).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
      </div>
    );
  }

  if (existing?.status === STATUS.PENDING) {
    return (
      <div className="viewing-request-status viewing-request-status--pending">
        <CalendarCheck size={15} />
        Requested for{' '}
        {new Date(existing.preferred_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} —
        waiting on the agent to confirm
      </div>
    );
  }

  return (
    <form className="viewing-request-form" onSubmit={handleRequest}>
      <input
        type="datetime-local"
        className="viewing-request-date-input"
        value={preferredAt}
        min={minDateTimeLocal()}
        onChange={(e) => setPreferredAt(e.target.value)}
        aria-label="Preferred viewing date and time"
      />
      <button type="submit" className="viewing-request-btn" disabled={submitting || !preferredAt}>
        <CalendarCheck size={15} />
        {submitting ? 'Requesting…' : 'Request a viewing'}
      </button>
      {error && <p className="viewing-request-error">{error}</p>}
    </form>
  );
}