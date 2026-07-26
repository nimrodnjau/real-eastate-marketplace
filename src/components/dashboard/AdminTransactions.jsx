import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Clock3, RotateCcw, Search, X } from "lucide-react";
import { supabase } from "../../lib/supabaseclient";
import { timeAgo } from "../../utils/timeAgo";
import "../../styles/AdminTransactions.css";

const mp = () => supabase.schema("marketplace");

// Fetched newest-first and capped, same approach as AdminUsers' roster
// fetch. Fine for now — once escrow_transactions outgrows a single
// fetch, move the stat sums below to a Postgres view/RPC instead of
// summing this capped client-side list.
const PAGE_LIMIT = 500;
const RECENT_DAYS = 30;

// escrow_transactions has three separate FKs into profiles (buyer_id,
// seller_id, agent_id) — same ambiguity as agent_profiles/conversations
// elsewhere, so each embed is aliased rather than left as `profiles`.
const TXN_SELECT = `
  id, listing_id, buyer_id, seller_id, agent_id,
  amount_deposited, commission_rate, commission_amount, net_payout_amount,
  status, mpesa_reference, created_at, released_at, updated_at,
  listing:listings(title, property_type, price, country),
  buyer:profiles!buyer_id(full_name),
  seller:profiles!seller_id(full_name),
  agent:profiles!agent_id(full_name)
`;

const STATUS_FILTERS = ["All", "Pending", "Held", "Released", "Refunded"];

const STATUS_LABEL = {
  pending: "Pending",
  held: "Held",
  released: "Released",
  refunded: "Refunded",
};

// Assumes commission_rate is stored as a plain percentage (5 = 5%), not
// a fraction (0.05) — swap to `${rate * 100}%` if it's the latter.
function fmtRate(rate) {
  return rate != null ? `${rate}%` : "—";
}

function fmtKes(amount) {
  if (amount == null) return "—";
  return `KES ${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function StatusBadge({ status }) {
  return <span className={`txn-status status-${status}`}>{STATUS_LABEL[status] ?? status ?? "Unknown"}</span>;
}

export default function AdminTransactions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const { data, error } = await mp()
      .from("escrow_transactions")
      .select(TXN_SELECT)
      .order("created_at", { ascending: false })
      .limit(PAGE_LIMIT);

    if (error) {
      console.error("Failed loading escrow_transactions:", error.message);
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const cutoff = Date.now() - RECENT_DAYS * 86400000;

    const inEscrow = rows
      .filter((r) => r.status === "held")
      .reduce((sum, r) => sum + Number(r.amount_deposited ?? 0), 0);

    const releasedRecent = rows
      .filter((r) => r.status === "released" && r.released_at && new Date(r.released_at).getTime() >= cutoff)
      .reduce((sum, r) => sum + Number(r.net_payout_amount ?? 0), 0);

    const commissionAccrued = rows
      .filter((r) => r.status === "held" || r.status === "released")
      .reduce((sum, r) => sum + Number(r.commission_amount ?? 0), 0);

    const refundedCount = rows.filter((r) => r.status === "refunded").length;

    return { inEscrow, releasedRecent, commissionAccrued, refundedCount };
  }, [rows]);

  const visible = useMemo(() => {
    let list = rows;

    if (statusFilter !== "All") {
      list = list.filter((r) => r.status === statusFilter.toLowerCase());
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.listing?.title?.toLowerCase().includes(q) ||
          r.buyer?.full_name?.toLowerCase().includes(q) ||
          r.seller?.full_name?.toLowerCase().includes(q) ||
          r.agent?.full_name?.toLowerCase().includes(q) ||
          r.mpesa_reference?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [rows, statusFilter, search]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setSelectedId(null);
    }
    if (selectedId) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  return (
    <div>
      <h2 className="section-heading">Transactions</h2>

      <div className="txn-stats">
        <div className="txn-stat-card">
          <span className="txn-stat-icon"><ArrowDownToLine size={16} /></span>
          <span className="txn-stat-label">Currently in escrow</span>
          <span className="txn-stat-value">{fmtKes(stats.inEscrow)}</span>
        </div>
        <div className="txn-stat-card">
          <span className="txn-stat-icon"><ArrowUpFromLine size={16} /></span>
          <span className="txn-stat-label">Released (last {RECENT_DAYS}d)</span>
          <span className="txn-stat-value">{fmtKes(stats.releasedRecent)}</span>
        </div>
        <div className="txn-stat-card">
          <span className="txn-stat-icon"><Clock3 size={16} /></span>
          <span className="txn-stat-label">Commission accrued</span>
          <span className="txn-stat-value">{fmtKes(stats.commissionAccrued)}</span>
        </div>
        <div className="txn-stat-card">
          <span className="txn-stat-icon"><RotateCcw size={16} /></span>
          <span className="txn-stat-label">Refunded</span>
          <span className="txn-stat-value">{stats.refundedCount}</span>
        </div>
      </div>

      <div className="txn-controls">
        <div className="txn-search-wrap">
          <Search size={15} />
          <input
            type="text"
            className="txn-search"
            placeholder="Search by listing, buyer, seller, agent, or M-Pesa ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="txn-filter-row">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              className={`filter-chip${statusFilter === s ? " is-active" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loadError && <div className="txn-error">Couldn't load transactions — {loadError}</div>}
      {loading && <div className="txn-loading">Loading…</div>}

      {!loading && !loadError && visible.length === 0 && (
        <div className="empty-note">No transactions match this filter.</div>
      )}

      {!loading && visible.length > 0 && (
        <div className="txn-ledger">
          <div className="txn-ledger-head">
            <span>Listing</span>
            <span>Buyer</span>
            <span>Seller</span>
            <span>Deposited</span>
            <span>Commission</span>
            <span>Net payout</span>
            <span>Status</span>
            <span>Date</span>
          </div>

          {visible.map((r) => (
            <button type="button" key={r.id} className="txn-row" onClick={() => setSelectedId(r.id)}>
              <span className="txn-cell txn-cell-listing" data-label="Listing">
                {r.listing?.title ?? "Untitled listing"}
              </span>
              <span className="txn-cell" data-label="Buyer">{r.buyer?.full_name ?? "—"}</span>
              <span className="txn-cell" data-label="Seller">{r.seller?.full_name ?? "—"}</span>
              <span className="txn-cell txn-cell-mono" data-label="Deposited">{fmtKes(r.amount_deposited)}</span>
              <span className="txn-cell txn-cell-mono" data-label="Commission">{fmtKes(r.commission_amount)}</span>
              <span className="txn-cell txn-cell-mono" data-label="Net payout">{fmtKes(r.net_payout_amount)}</span>
              <span className="txn-cell" data-label="Status"><StatusBadge status={r.status} /></span>
              <span className="txn-cell txn-cell-mono" data-label="Date">{timeAgo(r.created_at)}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="txn-drawer-backdrop" onClick={() => setSelectedId(null)} />
          <div className="txn-drawer" role="dialog" aria-modal="true">
            <button type="button" className="txn-drawer-close" onClick={() => setSelectedId(null)} aria-label="Close">
              <X size={18} />
            </button>

            <div className="txn-drawer-header">
              <h3 className="txn-drawer-title">{selected.listing?.title ?? "Untitled listing"}</h3>
              <p className="txn-drawer-subtitle">
                {selected.listing?.property_type ?? "Property"} · {selected.listing?.price != null ? fmtKes(selected.listing.price) : "price not set"} · {selected.listing?.country ?? "—"}
              </p>
              <StatusBadge status={selected.status} />
            </div>

            <section className="txn-drawer-section">
              <span className="txn-drawer-eyebrow">Parties</span>
              <p className="txn-drawer-meta">Buyer: {selected.buyer?.full_name ?? "Unknown"}</p>
              <p className="txn-drawer-meta">Seller: {selected.seller?.full_name ?? "Unknown"}</p>
              <p className="txn-drawer-meta">Agent: {selected.agent?.full_name ?? "None on record"}</p>
            </section>

            <section className="txn-drawer-section">
              <span className="txn-drawer-eyebrow">Amounts</span>
              <div className="txn-amount-grid">
                <span>Deposited</span><span className="txn-cell-mono">{fmtKes(selected.amount_deposited)}</span>
                <span>Commission rate</span><span className="txn-cell-mono">{fmtRate(selected.commission_rate)}</span>
                <span>Commission amount</span><span className="txn-cell-mono">{fmtKes(selected.commission_amount)}</span>
                <span>Net payout</span><span className="txn-cell-mono">{fmtKes(selected.net_payout_amount)}</span>
              </div>
              {/* Per-payee split (listing agent / buyer's agent / platform
                  cut, etc.) goes here once commissions' columns and its
                  link back to escrow_transactions are confirmed. */}
            </section>

            <section className="txn-drawer-section">
              <span className="txn-drawer-eyebrow">M-Pesa</span>
              <p className="txn-drawer-meta">Reference: {selected.mpesa_reference ?? "not recorded"}</p>
            </section>

            <section className="txn-drawer-section">
              <span className="txn-drawer-eyebrow">Timeline</span>
              <p className="txn-drawer-meta">Deposited {timeAgo(selected.created_at)}</p>
              {selected.released_at && <p className="txn-drawer-meta">Released {timeAgo(selected.released_at)}</p>}
              <p className="txn-drawer-meta">Last updated {timeAgo(selected.updated_at)}</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}