import React, { useState, useMemo } from "react";
import "../../styles/AdminApprovals.css";

const APPROVAL_TYPES = ["All", "Agent", "Seller", "Listing", "Landlord"];

/**
 * AdminApprovals — pending-item ledger with type filter + approve/reject actions.
 *
 * Pure presentational component: all data loading and the approve/reject
 * mutation live in AdminDashboard's loadQueue/handleDecide. This component
 * just renders `queue` and calls `onDecide(id, "approved" | "rejected")`.
 *
 * Expected shape of each item in `queue` (see AdminDashboard's loadQueue):
 *   { id, type, name, detail, submitted, documentUrl }
 */
export default function AdminApprovals({ queue, onDecide }) {
  const [filter, setFilter] = useState("All");

  const filtered = useMemo(
    () => (filter === "All" ? queue : queue.filter((q) => q.type === filter)),
    [queue, filter]
  );

  return (
    <div>
      <h2 className="section-heading">Approval queue</h2>
      <div className="filter-row">
        {APPROVAL_TYPES.map((t) => (
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