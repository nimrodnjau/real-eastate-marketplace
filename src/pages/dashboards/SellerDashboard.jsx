// pages/dashboards/SellerDashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient'; // adjust to your actual client path
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import StatCard from '../../components/dashboard/StatCard';
import ListRows from '../../components/dashboard/ListRows';
import ListingCard from '../../components/dashboard/ListingCard';
import ListingFormModal from '../../components/dashboard/ListingFormModal';
import ListingGalleryModal from '../../components/dashboard/ListingGalleryModal';
import ProfileSection from '../../components/dashboard/ProfileSection';
import DocumentsSection from '../../components/dashboard/DocumentsSection';
import FinancialsSection from '../../components/dashboard/FinancialsSection';
import MessagesSection from '../../components/dashboard/MessagesSection';
import SettingsSection from '../../components/dashboard/SettingsSection';
import '../../styles/dashboard.css';
import SubmitListingModal from '../../components/dashboard/SubmitListingModal';

const STATUS_BADGE = {
  draft:           { label: 'Draft',                tone: 'neutral' },
  pending_review:  { label: 'Pending verification',  tone: 'pending' },
  pending_agent_review:  { label: 'Awaiting agent review',  tone: 'pending' }, 
  active:          { label: 'Live',                  tone: 'success' },
  under_offer:     { label: 'Under offer',           tone: 'pending' },
  sold:            { label: 'Sold',                  tone: 'success' },
  rejected:        { label: 'Rejected',              tone: 'danger' },
};

// Statuses where a deal is already in motion — editing here would be
// risky (changing price/terms mid-negotiation or after sale).
const LOCKED_STATUSES = ['under_offer', 'sold'];

const PROPERTY_TYPES = ['land', 'apartment', 'house', 'commercial', 'other'];
// empty-string number inputs should be stored as null, not ''
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

export default function SellerDashboard() {
  const { profile } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [formError, setFormError] = useState(null);
  const [viewingListing, setViewingListing] = useState(null);
  const [submittingListing, setSubmittingListing] = useState(null);

  const fetchListings = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('listings')
      .select('*')
      .eq('seller_id', profile.id)
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

  useEffect(() => { fetchListings(); }, [fetchListings]);

  async function handleCreate(values) {
    const { data, error } = await supabase
      .schema('marketplace')
      .from('listings')
      .insert({
        seller_id: profile.id,
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
        location_lat: values.location_lat ?? null,      // ← add this
        location_lng: values.location_lng ?? null,      // ← add this
        status: 'draft', // seller submits for review as a separate action
      })
      .select()
      .single();

    if (error) { console.error(error); return { ok: false, error: error.message }; }
    await fetchListings();
    return { ok: true, listing: data }; // returned so the modal can move into "add photos" mode
  }

  async function handleUpdate(id, values) {
    const current = listings.find((l) => l.id === id);

    if (current && LOCKED_STATUSES.includes(current.status)) {
      return { ok: false, error: `This listing is ${current.status.replace('_', ' ')} and can't be edited.` };
    }

    // Editing a live listing sends it back into verification —
    // the agent/admin should re-check anything the seller changed.
    const statusUpdate = current?.status === 'active' ? { status: 'pending_review' } : {};

    const { error } = await supabase
      .schema('marketplace')
      .from('listings')
      .update({
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
        location_lat: values.location_lat ?? null,      // ← add this
  location_lng: values.location_lng ?? null,      
        ...statusUpdate,
      })
      .eq('id', id);

    if (error) { console.error(error); return { ok: false, error: error.message }; }
    await fetchListings();
    return { ok: true };
  }

  // Called from SubmitListingModal once the seller picks "via agent" or "without agent".
  // viaAgent = true  -> sent to verification queue (pending_review)
  // viaAgent = false -> goes live immediately, unverified until an agent is assigned
async function handleSubmitWithMode(id, viaAgent, agentId) {
  const update = viaAgent
    ? { status: 'pending_agent_review', requested_agent_id: agentId }
    : { status: 'active', agent_id: null };

  const { error } = await supabase.schema('marketplace').from('listings').update(update).eq('id', id);
  if (error) { console.error(error); return { ok: false, error: error.message }; }
  await fetchListings();
  return { ok: true };
}

  // Requires this RLS policy to exist (not currently in your schema):
  //   create policy "sellers delete their own draft listings"
  //     on marketplace.listings for delete
  //     using (auth.uid() = seller_id and status = 'draft');
  async function handleDelete(id) {
    const { error } = await supabase
      .schema('marketplace')
      .from('listings')
      .delete()
      .eq('id', id);
    if (error) { console.error(error); return false; }
    await fetchListings();
    return true;
  }

  const activeListings = listings.filter(l => l.status === 'active');
  const avgPrice = activeListings.length
    ? activeListings.reduce((sum, l) => sum + Number(l.price || 0), 0) / activeListings.length
    : 0;

  const stats = [
    { label: 'Active listings', value: String(activeListings.length), icon: 'building' },
   
    { label: 'Pending verification', value: String(listings.filter(l => l.status === 'pending_review').length), icon: 'clock' },
    { label: 'Drafts', value: String(listings.filter(l => l.status === 'draft').length), icon: 'fileText' },
    { label: 'Sold', value: String(listings.filter(l => l.status === 'sold').length), icon: 'checkCircle' },
    { label: 'Total clicks', value: String(listings.reduce((sum, l) => sum + (l.view_count || 0), 0)), icon: 'trendingUp' },
    { label: 'Avg. asking price (active)', value: avgPrice ? `KES ${Math.round(avgPrice).toLocaleString()}` : '—', icon: 'trendingUp' },
  ];

  const sections = [
    {
      id: 'listings',
      title: 'Your listings',
      description: 'Performance on each property you have listed.',
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
                    onSubmit={(listing) => setSubmittingListing(listing)}
                  />
                ))}
              </div>
            ),
    },
    {
      id: 'messages',
      title: 'Messages',
      description: 'Inquiries from buyers about your listings.',
      icon: 'messageSquare',
      content: <MessagesSection />,
    },
    {
      id: 'financials',
      title: 'Financials',
      description: 'Value sold, value listed, and payout status.',
      icon: 'wallet',
      content: <FinancialsSection listings={listings} />,
    },
    {
  id: 'documents',
  title: 'Documents',
  description: 'Title deeds, sale agreements, and verification uploads.',
  icon: 'folder',
  content: <DocumentsSection listings={listings} />,
},
    {
      id: 'profile',
      title: 'Profile',
      description: 'Your public seller details.',
      icon: 'user',
      content: <ProfileSection />,
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Password and account preferences.',
      icon: 'settings',
      content: <SettingsSection />,
    },
  ];

  return (
    <DashboardLayout
      roleLabel="Seller"
      pageTitle="Seller dashboard"
      pageSubtitle="Track your listings, sale progress, and the professionals helping you close."
      sections={sections}
      verificationStatus={null}
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

          {viewingListing && (
            <ListingGalleryModal
              listing={viewingListing}
              onClose={() => setViewingListing(null)}
            />
          )}

          {submittingListing && (
            <SubmitListingModal
              listing={submittingListing}
              onConfirm={(viaAgent, agentId) =>
                handleSubmitWithMode(submittingListing.id, viaAgent, agentId).then((result) => {
                  if (result.ok) setSubmittingListing(null);
                  return result;
                })
              }
              onClose={() => setSubmittingListing(null)}
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