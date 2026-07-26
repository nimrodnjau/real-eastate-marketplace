import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabaseclient";
import { useAuth } from "../context/AuthContext";
import { timeAgo } from "../utils/timeAgo";
import Overview from "../components/dashboard/AdminOverview";
import "../styles/AdminDashboard.css";
import AdminApprovals from "../components/dashboard/AdminApprovals";
import AdminListings from "../components/dashboard/AdminListings";
import AdminUsers from "../components/dashboard/AdminUsers";
import AdminTransactions from "../components/dashboard/AdminTransactions";

// All our tables live in the `marketplace` Postgres schema, not the
// default `public` one — every query needs to go through this.
const mp = () => supabase.schema("marketplace");

/**
 * Office Dashboard — internal ops shell for the marketplace platform.
 *
 * Two jobs:
 *  1. Monitor  — what's happening across the marketplace right now
 *  2. Approve  — gate agents/sellers/listings before they go live
 *
 * Wire-up notes:
 *  - Most tables use `id` + `status`. Where a table differs (e.g.
 *    agent_profiles uses `user_id` + `verification_status`), set
 *    `idField` / `statusField` in that entry's config below — loadQueue
 *    and handleDecide both read from the config instead of assuming
 *    `id`/`status` everywhere.
 *  - agent_profiles / seller_profiles / landlord_profiles each carry
 *    TWO foreign keys into `profiles`: one via `user_id` (the person
 *    being reviewed) and one via `verified_by` (the admin who reviewed
 *    them). PostgREST can't infer which one `profiles(full_name)` means
 *    when both exist, and errors with "more than one relationship was
 *    found". Fix is to pin the embed to the FK explicitly with
 *    `profiles!user_id(full_name)`.
 *  - Route this behind /admin, gated by a check against `marketplace.admin_users`
 *    (see AdminRoute + AdminLogin).
 *  - Every approve/reject also inserts a row into `admin_actions` for audit.
 *  - Postgres enum reference (marketplace schema), confirmed via
 *    pg_enum — use these exact labels, nothing else is valid:
 *      verification_status: unverified | pending | verified | rejected
 *      listing_status: draft | pending_review | active | under_offer |
 *                       sold | rejected | pending_agent_review
 *      escrow_status: pending | held | released | refunded
 *        ("in progress" == held: funds captured, deal not yet closed)
 */

const PENDING_QUERIES = [
  {
    type: "Agent",
    table: "agent_profiles",
    // agent_profiles has no `id`/`full_name`/`city`/`status` columns —
    // it's keyed by user_id and uses verification_status instead.
    idField: "user_id",
    statusField: "verification_status",
    // verification_status is an enum: unverified | pending | verified | rejected —
    // approve must write "verified", there's no "approved" label.
    approvedValue: "verified",
    // profiles!user_id(...) pins the embed to the user_id FK — agent_profiles
    // also has a verified_by FK into profiles, so the unqualified
    // "profiles(full_name)" form is ambiguous and PostgREST rejects it.
    select:
      "user_id, agency_name, bio, location_lat, location_lng, gazette_proof_url, verification_status, created_at, profiles!user_id(full_name)",
    // Prefer the real person's name (joined from profiles); fall back to
    // the agency name if the join comes back empty for any reason.
    getName: (row) => row.profiles?.full_name ?? row.agency_name ?? "Unnamed agent",
    detailFn: (row) => {
      const loc =
        row.location_lat != null && row.location_lng != null
          ? `${row.location_lat.toFixed(3)}, ${row.location_lng.toFixed(3)}`
          : "location not set";
      return `${row.agency_name ?? "Unknown agency"} · ${loc}`;
    },
    // Link to the credential proof so the admin can review it before deciding.
    documentFn: (row) => row.gazette_proof_url ?? null,
  },
  {
    type: "Seller",
    table: "seller_profiles",
    // Confirmed via information_schema: user_id, id_doc_url,
    // verification_status, verified_by, verified_at, created_at —
    // no `id`, no `full_name`, no `city` on this table itself.
    // Name comes from the profiles join, same pattern as Agent.
    idField: "user_id",
    statusField: "verification_status",
    // Same enum as Agent: unverified | pending | verified | rejected.
    approvedValue: "verified",
    // profiles!user_id(...) — same ambiguity as agent_profiles above,
    // this table also has a verified_by FK into profiles.
    select:
      "user_id, id_doc_url, verification_status, verified_by, verified_at, created_at, profiles!user_id(full_name)",
    getName: (row) => row.profiles?.full_name ?? "Unnamed seller",
    detailFn: (row) =>
      row.verified_by
        ? `ID verification · previously reviewed by ${row.verified_by}`
        : "ID verification · awaiting first review",
    documentFn: (row) => row.id_doc_url ?? null,
  },
  {
    type: "Landlord",
    table: "landlord_profiles",
    // Same shape as Seller above — verify this table matches too if
    // it wasn't included in the information_schema check.
    idField: "user_id",
    statusField: "verification_status",
    // profiles!user_id(...) — same fix as agent_profiles/seller_profiles.
    select:
      "user_id, id_doc_url, verification_status, verified_by, verified_at, created_at, profiles!user_id(full_name)",
    getName: (row) => row.profiles?.full_name ?? "Unnamed landlord",
    detailFn: (row) =>
      row.verified_by
        ? `ID + title deed review · previously reviewed by ${row.verified_by}`
        : "ID + title deed review · awaiting first review",
    documentFn: (row) => row.id_doc_url ?? null,
  },
  {
    type: "Listing",
    table: "listings",
    // status is a Postgres enum (marketplace.listing_status), not free text:
    // draft | pending_review | active | under_offer | sold | rejected |
    // pending_agent_review. Admin queue = pending_review; approve writes
    // "active" (there's no "approved" label); pending_agent_review is a
    // separate stage (agent hasn't acted yet) so it's excluded here.
    pendingValue: "pending_review",
    approvedValue: "active",
    rejectedValue: "rejected",
    select: "id, title, property_type, price, country, created_at",
    nameField: "title",
    detailFn: (row) => {
      const priceStr = row.price != null ? `KES ${Number(row.price).toLocaleString()}` : "price not set";
      return `${row.property_type ?? "Property"} · ${priceStr} · ${row.country ?? "country not set"}`;
    },
  },
];

const NAV_ITEMS = [
  { key: "overview", label: "Overview" },
  { key: "approvals", label: "Approvals" },
  { key: "listings", label: "Listings" },
  { key: "users", label: "Users" },
  { key: "transactions", label: "Transactions" },
];

function ApprovalsView({ queue, onDecide }) {
  const [filter, setFilter] = useState("All");
  const types = ["All", "Agent", "Seller", "Listing", "Landlord"];
  const filtered = useMemo(
    () => (filter === "All" ? queue : queue.filter((q) => q.type === filter)),
    [queue, filter]
  );

  return (
    <div>
      <h2 className="section-heading">Approval queue</h2>
      <div className="filter-row">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`filter-chip${filter === t ? " is-active" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-note">Nothing waiting on review for this filter.</div>
      )}

      {filtered.length > 0 && (
        <div className="ledger">
          {filtered.map((item) => (
            <div key={item.id} className="ledger-row">
              <div className="ledger-main">
                <div className="ledger-heading">
                  <span className={`ledger-type type-${item.type.toLowerCase()}`}>
                    {item.type}
                  </span>
                  <span className="ledger-name">{item.name}</span>
                </div>
                <span className="ledger-detail">
                  {item.detail} · {item.submitted}
                  {item.documentUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={item.documentUrl} target="_blank" rel="noreferrer">
                        view document
                      </a>
                    </>
                  )}
                </span>
              </div>
              <div className="ledger-actions">
                <button className="btn btn-secondary" onClick={() => onDecide(item.id, "rejected")}>
                  Reject
                </button>
                <button className="btn btn-primary" onClick={() => onDecide(item.id, "approved")}>
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceholderView({ title }) {
  return (
    <div>
      <h2 className="section-heading">{title}</h2>
      <div className="placeholder-note">Not built yet — next module to wire up.</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [active, setActive] = useState("overview");
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({
    newSignups7d: 0,
    pendingApprovals: 0,
    activeListings: 0,
    escrowInProgress: 0,
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [feed, setFeed] = useState([]);
  const [loadErrors, setLoadErrors] = useState([]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    const errors = [];

    const results = await Promise.all(
      PENDING_QUERIES.map(async (cfg) => {
        // Per-table overrides: most tables use `id` + `status`, but
        // some (e.g. agent_profiles) use different column names.
        const idField = cfg.idField ?? "id";
        const statusField = cfg.statusField ?? "status";
        const pendingValue = cfg.pendingValue ?? "pending";

        const { data, error } = await mp()
          .from(cfg.table)
          .select(cfg.select)
          .eq(statusField, pendingValue)
          .order("created_at", { ascending: false });

        if (error) {
          console.error(`Failed loading pending ${cfg.table}:`, error.message);
          errors.push(`${cfg.table}: ${error.message}`);
          return [];
        }

        return (data ?? []).map((row) => ({
          id: row[idField],
          idField,
          statusField,
          approvedValue: cfg.approvedValue ?? "approved",
          rejectedValue: cfg.rejectedValue ?? "rejected",
          type: cfg.type,
          table: cfg.table,
          name: cfg.getName ? cfg.getName(row) : row[cfg.nameField] ?? "Untitled",
          detail: cfg.detailFn(row),
          documentUrl: cfg.documentFn ? cfg.documentFn(row) : null,
          createdAt: row.created_at, // keep raw timestamp for sorting
          submitted: timeAgo(row.created_at), // display string only
        }));
      })
    );

    // Sort on the raw timestamp, not the formatted "x ago" string —
    // string comparison doesn't give chronological order.
    const flat = results
      .flat()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setQueue(flat);

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const [signupsRes, listingsRes, escrowRes] = await Promise.all([
      mp().from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      // listing_status enum: draft | pending_review | active | under_offer |
      // sold | rejected | pending_agent_review — "active" matches the
      // approvedValue used for the Listing entry in PENDING_QUERIES above.
      mp().from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
      // escrow_status enum: pending | held | released | refunded — no
      // "in_progress" label exists. "held" is the closest match for
      // "escrow in progress" (funds captured, deal not yet closed).
      // If "in progress" should also include not-yet-funded escrows,
      // switch this to .in("status", ["pending", "held"]).
      mp().from("escrow_transactions").select("id", { count: "exact", head: true }).eq("status", "held"),
    ]);

    [
      ["profiles (signups)", signupsRes],
      ["listings (active)", listingsRes],
      ["escrow_transactions", escrowRes],
    ].forEach(([label, res]) => {
      if (res.error) {
        console.error(`Failed loading ${label}:`, res.error.message);
        errors.push(`${label}: ${res.error.message}`);
      }
    });

    setStats({
      newSignups7d: signupsRes.count ?? 0,
      pendingApprovals: flat.length,
      activeListings: listingsRes.count ?? 0,
      escrowInProgress: escrowRes.count ?? 0,
    });

    // Recent activity feed: latest listings, escrow updates, and new profiles
    const [recentListings, recentEscrow, recentProfiles] = await Promise.all([
      mp().from("listings").select("id, title, status, created_at").order("created_at", { ascending: false }).limit(5),
      mp().from("escrow_transactions").select("id, status, created_at").order("created_at", { ascending: false }).limit(5),
      mp().from("profiles").select("id, full_name, role, created_at").order("created_at", { ascending: false }).limit(5),
    ]);

    [recentListings, recentEscrow, recentProfiles].forEach((res, i) => {
      const labels = ["listings", "escrow_transactions", "profiles"];
      if (res.error) {
        console.error(`Failed loading recent ${labels[i]}:`, res.error.message);
        errors.push(`${labels[i]} (feed): ${res.error.message}`);
      }
    });

    const feedItems = [
      ...(recentListings.data ?? []).map((r) => ({
        id: `listing-${r.id}`,
        text: `New listing "${r.title ?? "Untitled"}" — ${r.status ?? "unknown"}`,
        created_at: r.created_at,
      })),
      ...(recentEscrow.data ?? []).map((r) => ({
        id: `escrow-${r.id}`,
        text: `Escrow transaction updated — ${r.status ?? "unknown"}`,
        created_at: r.created_at,
      })),
      ...(recentProfiles.data ?? []).map((r) => ({
        id: `profile-${r.id}`,
        text: `New signup: ${r.full_name ?? "Unnamed"} (${r.role ?? "unknown role"})`,
        created_at: r.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

    setFeed(feedItems);
    setLoadErrors(errors);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const handleDecide = async (id, decision) => {
    const item = queue.find((q) => q.id === id);
    if (!item) return;

    setQueue((prev) => prev.filter((q) => q.id !== id));

    const newStatus = decision === "approved" ? item.approvedValue : item.rejectedValue;

    const { error: updateError } = await mp()
      .from(item.table)
      .update({ [item.statusField]: newStatus })
      .eq(item.idField, item.id);

    if (updateError) {
      console.error("Failed to update status:", updateError.message);
      setToast(`Couldn't update ${item.name} — reload and retry`);
      loadQueue();
      return;
    }

    const { error: auditError } = await mp().from("admin_actions").insert({
      admin_id: user?.id,
      action: decision === "approved" ? `approve_${item.type.toLowerCase()}` : `reject_${item.type.toLowerCase()}`,
      target_table: item.table,
      target_id: item.id,
    });

    if (auditError) {
      console.error("Failed to log admin action:", auditError.message);
    }

    setToast(`${item.name} ${decision}`);
    setStats((prev) => ({ ...prev, pendingApprovals: Math.max(0, prev.pendingApprovals - 1) }));
  };

  return (
    <div className="office">
      <div className="office-sidebar">
        <div className="office-title">Office</div>
        {NAV_ITEMS.map((n) => (
          <button
            key={n.key}
            onClick={() => setActive(n.key)}
            className={`office-nav-item${active === n.key ? " is-active" : ""}`}
          >
            {n.label}
          </button>
        ))}
      </div>

      <div className="office-body">
        {loading && <div className="office-loading">Loading…</div>}
        {active === "overview" && <Overview stats={stats} feed={feed} errors={loadErrors} />}
        {active === "approvals" && <ApprovalsView queue={queue} onDecide={handleDecide} />}
        {active === "listings" && <AdminListings />}
        {active === "users" && <AdminUsers />}
        {active === "transactions" && <AdminTransactions />}

        {toast && <div className="office-toast">{toast}</div>}
      </div>
    </div>
  );
}