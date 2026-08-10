import { useCallback, useEffect, useState } from 'react';
import LandlordListingCardsGrid from './LandlordListingCardsGrid';
import ListingFormModal from './ListingFormModal';
import ListingRepresentationPicker from '../marketplace/ListingRepresentationPicker';
import PortfolioManagementPicker from './PortfolioManagementPicker';
import {
  fetchLandlordListings,
  createLandlordListing,
  updateLandlordListing,
  submitLandlordListing, // NEW — see note at bottom of this file
} from '../../api/landlordDashboard';

// Fixed set for now — 'office' / 'retail' / 'warehouse' are the commercial
// subtypes ListingFormModal treats as a group (see COMMERCIAL_TYPES there),
// so any of the three brings up size, floors/units, zoning, and deposit.
// These must all exist as values on the property_type Postgres enum —
// see add_property_type_enum_values.sql if any are missing.
export const LANDLORD_PROPERTY_TYPES = ['residential', 'office', 'retail', 'warehouse', 'land'];

/**
 * Owns everything the "Your units" section needs:
 *  - fetching + refetching the landlord's listings
 *  - the create/edit modal (ListingFormModal), also used for "view" — there's
 *    no separate read-only mode, opening a listing just opens this form
 *  - the "get help listing" representation picker (hand off ONE listing to
 *    an agent)
 *  - the "hand off all units" portfolio picker (hand off EVERYTHING this
 *    landlord owns to one agent/manager at once — there's no buildings/
 *    property grouping in this schema, so "the whole building" just means
 *    "every listing this landlord currently has"). This only sends a
 *    request; see api/landlordManagementAssignments.js — the assignee has
 *    to accept it elsewhere before anything is actually applied to listings.
 *  - "list it myself" — submits a listing directly, no agent involved
 *  - the ready-to-render section config object DashboardLayout expects,
 *    and the unit-level stats (listed units / clicks / needs review)
 *
 * `userId` is treated as `seller_id` on `marketplace.listings` — see the
 * note in api/landlordDashboard.js if that FK ever changes. It's also used
 * as `landlord_id` on `marketplace.management_assignments`.
 *
 * Usage in a page:
 *   const { section, stats, modalElement, pickerElement, portfolioPickerElement, error } =
 *     useLandlordUnitsSection(userId);
 *   // include `section` in the array passed to <DashboardLayout sections={...} />
 *   // render {modalElement}, {pickerElement}, and {portfolioPickerElement}
 *   // alongside DashboardLayout
 */
export function useLandlordUnitsSection(userId) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state for viewing/creating/editing a listing. There's one modal
  // for all three — "view" just means opening it on an existing listing.
  const [editingListing, setEditingListing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // "Get help listing" representation picker, keyed by listing id.
  const [pickerListingId, setPickerListingId] = useState(null);

  // "Hand off all units" portfolio-wide picker — just open/closed, not
  // keyed to anything since it covers every listing this landlord has.
  const [portfolioPickerOpen, setPortfolioPickerOpen] = useState(false);

  // Per-listing "list it myself" in-flight / error state, keyed by listing id.
  const [submittingId, setSubmittingId] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await fetchLandlordListings(userId);
    if (fetchError) {
      setError(fetchError);
      setLoading(false);
      return;
    }
    setListings(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!userId) return;
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await fetchLandlordListings(userId);
      if (cancelled) return;

      if (fetchError) {
        setError(fetchError);
        setLoading(false);
        return;
      }
      setListings(data ?? []);
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function openCreateModal() {
    setSaveError(null);
    setEditingListing(null);
    setModalOpen(true);
  }

  // Used for both "view" and "edit" — same modal either way.
  function openListingModal(listing) {
    setSaveError(null);
    setEditingListing(listing);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingListing(null);
    setSaveError(null);
  }

  // Passed to ListingFormModal as onSave. Returns { ok, listing } so the
  // modal can move into its "add photos" step right after a create.
  async function handleSaveListing(values) {
    setSaveError(null);

    if (editingListing) {
      const wasActive = editingListing.status === 'active';
      const result = await updateLandlordListing(editingListing.id, values, { wasActive });
      if (!result.ok) {
        setSaveError(result.error?.message || 'Could not save changes.');
        return result;
      }
      setListings((prev) => prev.map((l) => (l.id === result.listing.id ? result.listing : l)));
      setEditingListing(result.listing);
      return result;
    }

    const result = await createLandlordListing(values, userId);
    if (!result.ok) {
      setSaveError(result.error?.message || 'Could not create listing.');
      return result;
    }
    setListings((prev) => [result.listing, ...prev]);
    return result;
  }

  // "List it myself" — submits straight to review, no agent involved.
  // Optimistically flips status to pending_review, rolls back on failure.
  async function handleSubmitListing(listing) {
    setSubmitError(null);
    setSubmittingId(listing.id);

    const previousStatus = listing.status;
    setListings((prev) =>
      prev.map((l) => (l.id === listing.id ? { ...l, status: 'pending_review' } : l))
    );

    const result = await submitLandlordListing(listing.id);

    if (!result.ok) {
      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? { ...l, status: previousStatus } : l))
      );
      setSubmitError(result.error?.message || 'Could not submit this listing.');
      setSubmittingId(null);
      return result;
    }

    setListings((prev) => prev.map((l) => (l.id === result.listing.id ? result.listing : l)));
    setSubmittingId(null);
    return result;
  }

  function openPortfolioPicker() {
    setPortfolioPickerOpen(true);
  }

  function closePortfolioPicker() {
    setPortfolioPickerOpen(false);
  }

  const totalClicks = listings.reduce((sum, l) => sum + (l.view_count ?? 0), 0);
  const needsReview = listings.filter((l) => !l.reviewed_at).length;

  const stats = [
    { label: 'Listed units', value: String(listings.length), icon: 'key' },
    { label: 'Total clicks', value: String(totalClicks), icon: 'trendingUp' },
    { label: 'Needs review', value: String(needsReview), icon: 'clipboardList' },
  ];

  const emptyLabel = loading ? 'Loading your units…' : "You haven't listed a unit yet.";

  const section = {
    id: 'units',
    title: 'Your units',
    description: 'Performance on each unit you have listed.',
    icon: 'key',
    type: 'cards',
    action: { label: 'List a unit', onClick: openCreateModal },
    emptyLabel,
    content: (
      <div className="landlord-units-section-content">
        {listings.length > 0 && (
          <div className="landlord-units-toolbar">
            <button
              type="button"
              className="landlord-units-handoff-btn"
              onClick={openPortfolioPicker}
            >
              Hand off all units to an agent or manager
            </button>
          </div>
        )}
        <LandlordListingCardsGrid
          listings={listings}
          emptyLabel={emptyLabel}
          onOpen={openListingModal}
          onSubmit={handleSubmitListing}
          onRequestAgent={(listing) => setPickerListingId(listing.id)}
        />
      </div>
    ),
  };

  const modalElement = modalOpen ? (
    <ListingFormModal
      listing={editingListing}
      propertyTypes={LANDLORD_PROPERTY_TYPES}
      error={saveError}
      onSave={handleSaveListing}
      onClose={closeModal}
    />
  ) : null;

  const pickerElement = pickerListingId ? (
    <ListingRepresentationPicker
      listingId={pickerListingId}
      onClose={() => setPickerListingId(null)}
      onRequested={() => {
        // Picker stays open so the landlord can request a backup contact
        // too. Swap in a toast/notification here if you'd rather close
        // automatically after one successful request.
      }}
    />
  ) : null;

  const portfolioPickerElement = portfolioPickerOpen ? (
    <PortfolioManagementPicker
      landlordId={userId}
      unitCount={listings.length}
      onClose={closePortfolioPicker}
      onRequested={() => {
        // Same as above — leave it open, swap in a toast if you'd rather
        // close automatically after a successful request.
      }}
    />
  ) : null;

  return {
    section,
    stats,
    listings,
    loading,
    error,
    refetch: load,
    modalElement,
    pickerElement,
    portfolioPickerElement,
    submittingId,
    submitError,
  };
}