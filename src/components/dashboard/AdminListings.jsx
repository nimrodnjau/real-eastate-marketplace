import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Handshake, CalendarClock, Bed, Bath, Car, LandPlot, MapPin, ImageOff } from "lucide-react";
import { supabase } from "../../lib/supabaseclient";
import { timeAgo } from "../../utils/timeAgo";
import "../../styles/AdminListings.css";

const mp = () => supabase.schema("marketplace");

// Ambiguous-FK note (same issue as agent/seller/landlord profiles in
// AdminDashboard): listings has THREE FKs into profiles (seller_id,
// agent_id, reviewed_by, requested_agent_id even), so each embed must be
// pinned and aliased — `profiles!seller_id(...)` alone still collides
// with `profiles!agent_id(...)` if both come back under the same
// `profiles` key, so we alias them as `seller` / `agent` instead.
const LISTING_SELECT = `
  id, title, property_type, price, address, country, status, view_count,
  created_at, images, bedrooms, bathrooms, parking, size_value, size_unit,
  rejection_reason, seller_id, agent_id,
  seller:profiles!seller_id(full_name),
  agent:profiles!agent_id(full_name, agency_name)
`;

// NOTE: no likes/favorites table exists yet, so "most liked" isn't
// something we can query — leaving it out rather than faking it.
// Once a listing_likes table exists, add a `likes` count the same way
// purchaseCounts/viewingCounts are built below and it'll drop right in.

const PROPERTY_TYPE_LABEL = {
  land: "Land",
  apartment: "Apartment",
  house: "House",
  commercial: "Commercial",
  other: "Property",
};

// listing_status enum: draft | pending_review | active | under_offer |
// sold | rejected | pending_agent_review (confirmed in AdminDashboard.jsx)
const STATUS_META = {
  draft: { label: "Draft", stamp: "stamp-draft" },
  pending_review: { label: "Pending review", stamp: "stamp-pending" },
  pending_agent_review: { label: "Awaiting agent", stamp: "stamp-pending" },
  active: { label: "Active", stamp: "stamp-active" },
  under_offer: { label: "Under offer", stamp: "stamp-offer" },
  sold: { label: "Sold", stamp: "stamp-sold" },
  rejected: { label: "Rejected", stamp: "stamp-rejected" },
};

const STATUS_FILTERS = ["all", ...Object.keys(STATUS_META)];

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "views", label: "Most viewed" },
  { key: "price_high", label: "Price: high to low" },
  { key: "price_low", label: "Price: low to high" },
];

function formatPrice(price) {
  if (price == null) return "Price not set";
  return `KES ${Number(price).toLocaleString()}`;
}

function formatSize(value, unit) {
  if (value == null) return null;
  if (unit === "acres") return `${value} acres`;
  if (unit === "sqm") return `${value} sqm`;
  if (unit === "sqft") return `${value} sq ft`;
  return `${value}`;
}

function filingTag(id) {
  return id ? id.slice(0, 8).toUpperCase() : "————————";
}

function ListingCard({ listing }) {
  const meta = STATUS_META[listing.status] ?? { label: listing.status, stamp: "stamp-draft" };
  const cover = listing.images?.[0]?.url;
  const photoCount = listing.images?.length ?? 0;
  const isLand = listing.property_type === "land";
  const size = isLand ? formatSize(listing.size_value, listing.size_unit) : null;
  const contactName = listing.agent?.full_name ?? listing.seller?.full_name ?? "Unassigned";
  const contactSub = listing.agent?.agency_name ?? (listing.agent ? null : "Seller-listed");

  return (
    <div className="listing-card">
      <div className="listing-card-media">
        {cover ? <img src={cover} alt={listing.title} /> : (
          <div className="listing-card-media-empty">
            <ImageOff size={20} />
            <span>No photos yet</span>
          </div>
        )}
        <span className="listing-card-tag">{filingTag(listing.id)}</span>
        <span className={`listing-card-stamp ${meta.stamp}`}>{meta.label}</span>
        {photoCount > 1 && <span className="listing-card-photocount">1/{photoCount}</span>}
      </div>

      <div className="listing-card-body">
        <div className="listing-card-toprow">
          <span className="listing-card-type">{PROPERTY_TYPE_LABEL[listing.property_type] ?? "Property"}</span>
          <span className="listing-card-price">{formatPrice(listing.price)}</span>
        </div>

        <h3 className="listing-card-title">{listing.title}</h3>

        {(listing.address || listing.country) && (
          <p className="listing-card-location">
            <MapPin size={13} />
            {[listing.address, listing.country].filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="listing-card-facts">
          {isLand ? (
            size && <span className="listing-card-fact"><LandPlot size={14} />{size}</span>
          ) : (
            <>
              {listing.bedrooms != null && <span className="listing-card-fact"><Bed size={14} />{listing.bedrooms}</span>}
              {listing.bathrooms != null && <span className="listing-card-fact"><Bath size={14} />{listing.bathrooms}</span>}
              {listing.parking != null && <span className="listing-card-fact"><Car size={14} />{listing.parking}</span>}
            </>
          )}
        </div>

        {listing.status === "rejected" && listing.rejection_reason && (
          <p className="listing-card-rejection">{listing.rejection_reason}</p>
        )}

        <div className="listing-card-activity">
          <span className="listing-card-activity-label">Activity</span>
          <div className="listing-card-activity-row">
            <span className="listing-card-stat" title="Total views">
              <Eye size={14} />
              {(listing.view_count ?? 0).toLocaleString()}
            </span>
            <span className="listing-card-stat" title="Purchase transactions started">
              <Handshake size={14} />
              {listing.purchaseCount} in progress
            </span>
            <span className="listing-card-stat" title="Viewing requests">
              <CalendarClock size={14} />
              {listing.viewingCount}
              {listing.viewingPendingCount > 0 && ` (${listing.viewingPendingCount} pending)`}
            </span>
          </div>
        </div>

        <div className="listing-card-footer">
          <div className="listing-card-contact">
            <span className="listing-card-contact-name">{contactName}</span>
            {contactSub && <span className="listing-card-contact-sub">{contactSub}</span>}
          </div>
          <span className="listing-card-posted">{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const loadListings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const { data, error } = await mp()
      .from("listings")
      .select(LISTING_SELECT)
      .order("created_at", { ascending: false })
      .limit(200); // simple cap for now — swap for real pagination once volume grows

    if (error) {
      console.error("Failed loading listings:", error.message);
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    const rows = data ?? [];
    const listingIds = rows.map((r) => r.id);

    // Per-listing counts: PostgREST has no group-by-count in a single
    // call, so pull the raw rows for just these listing_ids and tally
    // client-side (same approach as the signup/active-listing counts
    // in AdminDashboard, just keyed per-row instead of a single total).
    let purchaseCounts = new Map();
    let viewingCounts = new Map();
    let viewingPendingCounts = new Map();

    if (listingIds.length > 0) {
      const [txRes, vrRes] = await Promise.all([
        mp().from("transactions").select("listing_id").in("listing_id", listingIds),
        mp().from("viewing_requests").select("listing_id, status").in("listing_id", listingIds),
      ]);

      if (txRes.error) {
        console.error("Failed loading transaction counts:", txRes.error.message);
      } else {
        (txRes.data ?? []).forEach((r) => {
          purchaseCounts.set(r.listing_id, (purchaseCounts.get(r.listing_id) ?? 0) + 1);
        });
      }

      if (vrRes.error) {
        console.error("Failed loading viewing request counts:", vrRes.error.message);
      } else {
        (vrRes.data ?? []).forEach((r) => {
          viewingCounts.set(r.listing_id, (viewingCounts.get(r.listing_id) ?? 0) + 1);
          if (r.status === "pending") {
            viewingPendingCounts.set(r.listing_id, (viewingPendingCounts.get(r.listing_id) ?? 0) + 1);
          }
        });
      }
    }

    const enriched = rows.map((row) => ({
      ...row,
      purchaseCount: purchaseCounts.get(row.id) ?? 0,
      viewingCount: viewingCounts.get(row.id) ?? 0,
      viewingPendingCount: viewingPendingCounts.get(row.id) ?? 0,
    }));

    setListings(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const visible = useMemo(() => {
    let rows = listings;

    if (statusFilter !== "all") {
      rows = rows.filter((l) => l.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (l) =>
          l.title?.toLowerCase().includes(q) ||
          l.address?.toLowerCase().includes(q) ||
          l.country?.toLowerCase().includes(q)
      );
    }

    const sorted = [...rows];
    switch (sort) {
      case "oldest":
        sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case "views":
        sorted.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0));
        break;
      case "price_high":
        sorted.sort((a, b) => Number(b.price ?? 0) - Number(a.price ?? 0));
        break;
      case "price_low":
        sorted.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
        break;
      default:
        sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return sorted;
  }, [listings, statusFilter, search, sort]);

  return (
    <div>
      <h2 className="section-heading">Listings</h2>

      <div className="listing-controls">
        <input
          type="text"
          className="listing-search"
          placeholder="Search by title, address, or country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select className="listing-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="filter-row">
        {STATUS_FILTERS.map((key) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`filter-chip${statusFilter === key ? " is-active" : ""}`}
          >
            {key === "all" ? "All" : STATUS_META[key].label}
          </button>
        ))}
      </div>

      {loadError && <div className="listing-error">Couldn't load listings — {loadError}</div>}
      {loading && <div className="listing-loading">Loading listings…</div>}

      {!loading && !loadError && visible.length === 0 && (
        <div className="empty-note">No listings match this filter.</div>
      )}

      {!loading && visible.length > 0 && (
        <div className="listing-grid">
          {visible.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}