import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import ListRows from './ListRows';

// Buyer-side "Viewing requests" section for BuyerDashboard — shows the
// status of every viewing this buyer has requested, most recent first.
// Rendered as a `type: 'component'` section, same as WatchingSection /
// MessagesSection, so it fetches its own data.
//
// Reuses ListRows rather than hand-rolled markup — its {title, meta,
// badge, badgeTone} item shape is already proven out by the static
// "Recent alerts" list in BuyerDashboard, so the badge styling here comes
// free from dashboard.css instead of needing new CSS.
//
// ⚠ badge/badgeTone below assume 'pending' and 'confirmed' are the only
// marketplace.viewing_request_status values reachable from the buyer's
// side — still unconfirmed against the real enum. Anything else falls
// back to a neutral badge showing the raw status.

const STATUS_BADGE = {
  pending: { badge: 'Requested', badgeTone: 'pending' },
  confirmed: { badge: 'Confirmed', badgeTone: 'success' },
};

function formatDate(value) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MyViewingRequestsSection() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!profile?.id) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: rows, error: reqError } = await supabase
        .schema('marketplace')
        .from('viewing_requests')
        .select('id, listing_id, status, preferred_at, scheduled_for, requested_at')
        .eq('buyer_id', profile.id)
        .order('requested_at', { ascending: false });

      if (!isMounted) return;

      if (reqError) {
        console.error('Failed to load viewing requests:', reqError);
        setError(reqError);
        setLoading(false);
        return;
      }

      // Same two-step fetch-then-merge pattern used in
      // ProfessionalProfileModalForBuyer — avoids relying on an embedded
      // foreign-table select across the marketplace schema.
      const listingIds = [...new Set((rows || []).map((r) => r.listing_id))];
      let listingsById = {};

      if (listingIds.length > 0) {
        const { data: listings, error: listingsError } = await supabase
          .schema('marketplace')
          .from('listings')
          .select('id, title')
          .in('id', listingIds);

        if (!listingsError) {
          listingsById = Object.fromEntries((listings || []).map((l) => [l.id, l]));
        }
      }

      if (isMounted) {
        setRequests((rows || []).map((r) => ({ ...r, listing: listingsById[r.listing_id] })));
        setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  if (loading) return <p className="agent-picker-empty">Loading your viewing requests…</p>;
  if (error) return <p className="dashboard-error">Couldn't load your viewing requests.</p>;

  const items = requests.map((r) => {
    const meta = STATUS_BADGE[r.status] || { badge: r.status, badgeTone: 'neutral' };
    const whenLabel =
      r.status === 'confirmed' && r.scheduled_for
        ? `Confirmed for ${formatDate(r.scheduled_for)}`
        : `Requested for ${formatDate(r.preferred_at)}`;

    return {
      title: r.listing?.title || 'Listing',
      meta: whenLabel,
      badge: meta.badge,
      badgeTone: meta.badgeTone,
    };
  });

  return <ListRows items={items} emptyLabel="No viewing requests yet." />;
}