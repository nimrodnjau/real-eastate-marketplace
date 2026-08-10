// pages/dashboards/AgentDashboard.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient'; // adjust to your actual client path
import { useAuth } from '../../context/AuthContext';
import { uploadAvatarToR2 } from '../../api/uploads';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import StatCard from '../../components/dashboard/StatCard';
import AgentCredentialsSection from '../../components/dashboard/AgentCredentialsSection';
import ListingCard from '../../components/dashboard/ListingCard';
import ListingRequestCard from '../../components/dashboard/ListingRequestCard';
import ListingFormModal from '../../components/dashboard/ListingFormModal';
import ListingGalleryModal from '../../components/dashboard/ListingGalleryModal';
import ListingRequestDetailModal from '../../components/dashboard/ListingRequestDetailModal';
import LogCommissionModal from '../../components/dashboard/LogCommissionModal';
import MessagesSection from '../../components/dashboard/MessagesSection';
import '../../styles/dashboard.css';
import AgentFinancialsSection from '../../components/dashboard/AgentFinancialsSection';
import AgentProfileSection from '../../components/dashboard/AgentProfileSection';
import ProfileFormModal from '../../components/dashboard/AgentProfileFormModal';
import ProfessionalsSection from '../../components/dashboard/ProfessionalsSection';
import '../../styles/ProfessionalsSection.css';
import AgentViewingRequestsSection from '../../components/dashboard/AgentViewingRequestsSection';
import AgentActiveDealsSection from '../../components/dashboard/AgentActiveDealsSection';


// Agent dashboard — listings section wired to Supabase, following the
// same shape as SellerDashboard (ListingFormModal / ListingCard /
// ListingGalleryModal are reused unchanged; they don't reference seller_id
// or agent_id themselves, only the parent's handleCreate does).
//
// Difference from SellerDashboard: an agent is already gazetted/verified,
// so listings they add go straight to status 'active' with agent_id set
// to themselves — no pending_review step. If you'd rather agent-added
// listings still go through admin review, change the `status:` line in
// handleCreate below to 'pending_review'.
//
// "Listing requests" — sellers submit a listing from their own dashboard
// and target it at a specific agent (`requested_agent_id`). The agent
// reviews verification documents (now pulled from marketplace.documents,
// see ListingRequestDetailModal) and either approves (agent_id = this
// agent, status = 'active') or declines (status = 'rejected').
//
// "Commission tracker" — reads/writes marketplace.commissions. An agent
// logs a commission after closing a deal, then advances it through
// requested -> processing -> paid manually (no PSP/payout integration
// exists yet, same caveat as the escrow feature elsewhere in this app).
//
// Credentials section is still a placeholder array — swap for a real
// query once there's a credentials table.

const PROPERTY_TYPES = ['land', 'apartment', 'house', 'commercial', 'other'];
// empty-string number inputs should be stored as null, not ''
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

const COMMISSION_TYPE_LABEL = { sale: 'Sale', lease: 'Lease', referral: 'Referral' };
const COMMISSION_STATUS_LABEL = { requested: 'Requested', processing: 'Processing', paid: 'Paid' };
const COMMISSION_STATUS_TONE = { requested: 'neutral', processing: 'pending', paid: 'success' };
const COMMISSION_NEXT_STATUS = { requested: 'processing', processing: 'paid', paid: null };




export default function AgentDashboard() {
  const { profile } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [formError, setFormError] = useState(null);
  const [viewingListing, setViewingListing] = useState(null);
  const [viewingRequest, setViewingRequest] = useState(null);
// ---- Profile ----
const [profileData, setProfileData] = useState(profile || null);
const [profileModalOpen, setProfileModalOpen] = useState(false);
const [profileFormError, setProfileFormError] = useState(null);
  // ---- Listing requests (seller-submitted, pending this agent's review) ----
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState(null);
  const [actionId, setActionId] = useState(null); // request currently being approved/declined

  // seller_id -> profile, so each request card can show who submitted it
  const sellerCacheRef = useRef(new Map());
  const [sellerProfiles, setSellerProfiles] = useState({});

  // ---- Commissions ----
  const [commissions, setCommissions] = useState([]);
  const [commissionsLoading, setCommissionsLoading] = useState(true);
  const [commissionsError, setCommissionsError] = useState(null);
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [commissionFormError, setCommissionFormError] = useState(null);
  const [advancingId, setAdvancingId] = useState(null);

  const fetchListings = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('listings')
      .select('*')
      .eq('agent_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load listings:', error);
      setError(error.message);
    } else {
      setListings(data || []);
      setError(null);
    }
    setLoading(false);
  }, [profile?.id]);

  const fetchSellerProfiles = useCallback(async (sellerIds) => {
    const idsToFetch = [...new Set(sellerIds)].filter(
      (id) => id && !sellerCacheRef.current.has(id)
    );
    if (idsToFetch.length === 0) return;
    const { data } = await supabase
      .schema('marketplace')
      .from('profiles')
      .select('id, full_name, phone, email')
      .in('id', idsToFetch);
    (data || []).forEach((p) => sellerCacheRef.current.set(p.id, p));
    setSellerProfiles(Object.fromEntries(sellerCacheRef.current));
  }, []);

  const fetchRequests = useCallback(async () => {
    if (!profile?.id) return;
    setRequestsLoading(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('listings')
      .select('*')
      .eq('requested_agent_id', profile.id)
      .eq('status', 'pending_agent_review')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load listing requests:', error);
      setRequestsError(error.message);
    } else {
      setRequests(data || []);
      setRequestsError(null);
      fetchSellerProfiles((data || []).map((r) => r.seller_id));
    }
    setRequestsLoading(false);
  }, [profile?.id, fetchSellerProfiles]);

  const fetchCommissions = useCallback(async () => {
    if (!profile?.id) return;
    setCommissionsLoading(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('commissions')
      .select('*')
      .eq('agent_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load commissions:', error);
      setCommissionsError(error.message);
    } else {
      setCommissions(data || []);
      setCommissionsError(null);
    }
    setCommissionsLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchListings(); }, [fetchListings]);
  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useEffect(() => { fetchCommissions(); }, [fetchCommissions]);
  useEffect(() => {
  if (profile) setProfileData(profile);
}, [profile]);

  async function handleApprove(requestId) {
    setActionId(requestId);
    const { error } = await supabase
      .schema('marketplace')
      .from('listings')
      .update({ agent_id: profile.id, status: 'active' })
      .eq('id', requestId);

    setActionId(null);
    if (error) {
      console.error('Failed to approve listing request:', error);
      setRequestsError(error.message);
      return;
    }
    // The approved listing now belongs in "Your listings" too.
    await Promise.all([fetchRequests(), fetchListings()]);
  }

  async function handleReject(requestId, reason) {
    setActionId(requestId);
    const { error } = await supabase
      .schema('marketplace')
      .from('listings')
      .update({ status: 'rejected', agent_decision_note: reason })
      .eq('id', requestId);

    setActionId(null);
    if (error) {
      console.error('Failed to decline listing request:', error);
      setRequestsError(error.message);
      return;
    }
    await fetchRequests();
  }

  async function handleCreate(values) {
    const { data, error } = await supabase
      .schema('marketplace')
      .from('listings')
      .insert({
        agent_id: profile.id,
        title: values.title,
        description: values.description,
        property_type: values.property_type,
        price: values.price,
        address: values.address,
        bedrooms: numOrNull(values.bedrooms),
        bathrooms: numOrNull(values.bathrooms),
        parking: numOrNull(values.parking),
        size_value: numOrNull(values.size_value),
        size_unit: values.property_type === 'land' ? (values.size_unit || null) : null,
        location_lat: values.location_lat ?? null,
        location_lng: values.location_lng ?? null,
        status: 'active', // agent is already verified — no review queue
      })
      .select()
      .single();

    if (error) { console.error(error); return { ok: false, error: error.message }; }
    await fetchListings();
    return { ok: true, listing: data }; // returned so the modal can move into "add photos" mode
  }

  async function handleUpdateProfile(values, avatarFile) {
  if (avatarFile) {
    try {
      await uploadAvatarToR2(avatarFile);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      setProfileFormError(err.message || 'Photo upload failed. Try a different image.');
      return { ok: false, error: err.message || 'Photo upload failed.' };
    }
  }

  const { data, error } = await supabase
    .schema('marketplace')
    .from('profiles')
    .update({
      full_name: values.full_name,
      phone: values.phone,
      email: values.email,
      agency_name: values.agency_name,
      license_number: values.license_number,
      bio: values.bio,
      location_lat: values.location_lat ?? null,
      location_lng: values.location_lng ?? null,
      // avatar_url intentionally omitted — the upload-avatar edge function
      // already wrote it server-side; the select() below just re-reads it.
    })
    .eq('id', profile.id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update profile:', error);
    setProfileFormError(error.message);
    return { ok: false, error: error.message };
  }
  setProfileFormError(null);
  setProfileData(data);
  return { ok: true };
}

  async function handleLogCommission(values) {
    const { error } = await supabase
      .schema('marketplace')
      .from('commissions')
      .insert({
        agent_id: profile.id,
        listing_id: values.listing_id,
        type: values.type,
        amount: values.amount,
        status: 'requested',
      });

    if (error) {
      console.error('Failed to log commission:', error);
      setCommissionFormError(error.message);
      return { ok: false, error: error.message };
    }
    setCommissionFormError(null);
    await fetchCommissions();
    return { ok: true };
  }
async function handlePublishDraft(listing) {
  const { error } = await supabase
    .schema('marketplace')
    .from('listings')
    .update({ status: 'active' })
    .eq('id', listing.id);

  if (error) {
    console.error('Failed to publish listing:', error);
    setError(error.message);
    return;
  }
  await fetchListings();
}
  async function handleAdvanceCommission(id, nextStatus) {
    setAdvancingId(id);
    const { error } = await supabase
      .schema('marketplace')
      .from('commissions')
      .update({
        status: nextStatus,
        paid_at: nextStatus === 'paid' ? new Date().toISOString() : null,
      })
      .eq('id', id);

    setAdvancingId(null);
    if (error) {
      console.error('Failed to update commission:', error);
      setCommissionsError(error.message);
      return;
    }
    await fetchCommissions();
  }

  const activeListings = listings.filter((l) => l.status === 'active');

  // Distinct sellers this agent actually represents — derived from real
  // listings (their own additions + approved seller requests), since
  // there's no separate CRM/clients table to pull from.
  const clientIds = new Set(listings.filter((l) => l.seller_id).map((l) => l.seller_id));

  const portfolioValue = activeListings.reduce((sum, l) => sum + Number(l.price || 0), 0);
  const pendingCommission = commissions
    .filter((c) => c.status !== 'paid')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const stats = [
    { label: 'Active listings', value: String(activeListings.length), icon: 'building' },
    { label: 'Pending requests', value: String(requests.length), icon: 'inbox' },
    { label: 'Active clients', value: String(clientIds.size), hint: 'Sellers you represent', icon: 'users' },
    {
      label: 'Pending commission',
      value: pendingCommission ? `KES ${Math.round(pendingCommission).toLocaleString()}` : '—',
      icon: 'wallet',
    },
    {
      label: 'Portfolio value',
      value: portfolioValue ? `KES ${Math.round(portfolioValue).toLocaleString()}` : '—',
      icon: 'trendingUp',
    },
  ];

  const commissionsContent = commissionsLoading
    ? <p>Loading commissions…</p>
    : commissionsError
      ? <p className="dashboard-error">Couldn't load commissions: {commissionsError}</p>
      : commissions.length === 0
        ? <p className="dashboard-empty">No commissions logged yet.</p>
        : (
          <ul className="list-rows">
            {commissions.map((c) => {
              const listingTitle = listings.find((l) => l.id === c.listing_id)?.title;
              const nextStatus = COMMISSION_NEXT_STATUS[c.status];
              return (
                <li key={c.id} className="list-row">
                  <div>
                    <p className="list-row-title">
                      {COMMISSION_TYPE_LABEL[c.type] || c.type}
                      {listingTitle ? ` — ${listingTitle}` : ''}
                    </p>
                    <p className="list-row-meta">KES {Number(c.amount).toLocaleString()}</p>
                  </div>
                  <div className="list-row-actions">
                    <span className={`badge badge--${COMMISSION_STATUS_TONE[c.status] || 'neutral'}`}>
                      {COMMISSION_STATUS_LABEL[c.status] || c.status}
                    </span>
                    {nextStatus && (
                      <button
                        type="button"
                        className="list-row-edit-btn"
                        onClick={() => handleAdvanceCommission(c.id, nextStatus)}
                        disabled={advancingId === c.id}
                      >
                        {advancingId === c.id ? 'Updating…' : `Mark ${COMMISSION_STATUS_LABEL[nextStatus].toLowerCase()}`}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        );

  const sections = [
    {
      id: 'listing-requests',
      title: 'Listing requests',
      description: 'Properties sellers have asked you to verify and list. Check the documents before publishing.',
      icon: 'inbox',
      content: requestsLoading
        ? <p>Loading requests…</p>
        : requestsError
          ? <p className="dashboard-error">Couldn't load requests: {requestsError}</p>
          : requests.length === 0
            ? <p className="dashboard-empty">No pending requests right now.</p>
            : (
              <div className="listing-request-grid">
                {requests.map((r) => (
                  <ListingRequestCard
                    key={r.id}
                    request={r}
                    seller={sellerProfiles[r.seller_id]}
                    onOpen={setViewingRequest}
                  />
                ))}
              </div>
            ),
    },
    {
      id: 'listings',
      title: 'Your listings',
      description: 'Properties you manage, including listings taken on from other agents.',
      icon: 'building',
      action: { label: 'Add listing', onClick: () => { setEditingListing(null); setFormError(null); setModalOpen(true); } },
      content: loading
        ? <p>Loading listings…</p>
        : error
          ? <p className="dashboard-error">Couldn't load listings: {error}</p>
          : listings.length === 0
            ? <p className="dashboard-empty">No listings yet — add your first property.</p>
            : (
              <div className="listing-card-grid">
                {listings.map((l) => (
                 <ListingCard
  key={l.id}
  listing={l}
  onEdit={(listing) => { setEditingListing(listing); setFormError(null); setModalOpen(true); }}
  onViewPhotos={(listing) => setViewingListing(listing)}
  onSubmit={handlePublishDraft}
/>
                ))}
              </div>
            ),
    },
    {
  id: 'active-deals',
  title: 'Active deals',
  description: 'Purchase transactions that need your attention, including buyer offers to accept or reject.',
  icon: 'handshake',
  content: <AgentActiveDealsSection agentId={profile?.id} />,
},
    {
      id: 'messages',
      title: 'Messages',
      description: 'Conversations with buyers and sellers about your listings.',
      icon: 'messageSquare',
      content: <MessagesSection />,
    },
    {
  id: 'professionals',
  title: 'Professionals & banks',
  description: 'Find and message valuers, lawyers, surveyors, and partner banks on the platform.',
  icon: 'briefcase',
  content: <ProfessionalsSection />,
},
    {
      id: 'commissions',
      title: 'Commission tracker',
      description: 'Commissions you\u2019ve logged, from requested through to paid.',
      icon: 'wallet',
      action: { label: 'Log commission', onClick: () => { setCommissionFormError(null); setCommissionModalOpen(true); } },
      content: commissionsContent,
    },
    {
  id: 'financials',
  title: 'Financials',
  description: 'Where your commission income actually stands.',
  icon: 'trendingUp',
  content: <AgentFinancialsSection commissions={commissions} listings={listings} />,
},
   {
      id: 'credentials',
      title: 'Credentials & team',
      description: 'Your verification status and onboarded staff.',
      icon: 'shieldCheck',
      content: <AgentCredentialsSection />,
    },
    {
  id: 'viewing-requests',
  title: 'Viewing requests',
  description: 'Buyers who want to view your listings — confirm a time or decline.',
  icon: 'calendarCheck', // ⚠ same icon-key guess as the buyer side — verify against the real icon map
  content: <AgentViewingRequestsSection listings={listings} />,
},
    {
  id: 'profile',
  title: 'Profile',
  description: 'Your contact details, agency, and license info.',
  icon: 'user',
  action: { label: 'Edit profile', onClick: () => { setProfileFormError(null); setProfileModalOpen(true); } },
  content: <AgentProfileSection profile={profileData} onEdit={() => { setProfileFormError(null); setProfileModalOpen(true); }} />,
},
  
  ].map((section) =>
    section.type === 'list'
      ? { ...section, content: <ListRows items={section.items} emptyLabel={section.emptyLabel} /> }
      : section
  );

  return (
    <DashboardLayout
      roleLabel="Agent"
      pageTitle="Agent dashboard"
      pageSubtitle="Your listings, commissions, and clients in one place."
      sections={sections}
      verificationStatus="Gazetted & verified"
      modal={
        <>
          {modalOpen && (
            <ListingFormModal
              listing={editingListing}
              propertyTypes={PROPERTY_TYPES}
              error={formError}
              onSave={async (values) => {
                const result = editingListing
                  ? await handleUpdate(editingListing.id, values)
                  : await handleCreate(values);

                if (result.ok) {
                  setFormError(null);
                  if (editingListing) setModalOpen(false);
                } else {
                  setFormError(result.error);
                }
                return result;
              }}
              onClose={() => { setModalOpen(false); fetchListings(); }}
            />
          )}

          {profileModalOpen && (
  <ProfileFormModal
    profile={profileData}
    error={profileFormError}
    onSave={handleUpdateProfile}
    onClose={() => setProfileModalOpen(false)}
  />
)}
          {viewingRequest && (
            <ListingRequestDetailModal
              request={viewingRequest}
              seller={sellerProfiles[viewingRequest.seller_id]}
              busy={actionId === viewingRequest.id}
              onClose={() => setViewingRequest(null)}
              onApprove={async (id) => {
                await handleApprove(id);
                setViewingRequest(null);
              }}
              onReject={async (id, reason) => {
                await handleReject(id, reason);
                setViewingRequest(null);
              }}
            />
          )}

          {viewingListing && (
            <ListingGalleryModal
              listing={viewingListing}
              onClose={() => setViewingListing(null)}
            />
          )}


          {commissionModalOpen && (
            <LogCommissionModal
              listings={listings}
              error={commissionFormError}
              onSave={handleLogCommission}
              onClose={() => setCommissionModalOpen(false)}
            />
          )}
        </>
      }
    >
      <div className="stat-grid">
        {stats.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} hint={s.hint} />
        ))}
      </div>
    </DashboardLayout>
  );
}