import React, { useState, useMemo } from "react";

export default function AdminApprovals({ queue, onDecide }) {
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