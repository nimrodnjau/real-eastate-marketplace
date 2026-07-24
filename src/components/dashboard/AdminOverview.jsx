import React from "react";
import { timeAgo } from "../../utils/timeAgo";

export default function Overview({ stats, feed, errors }) {
  return (
    <div>
      <h2 className="section-heading">Overview</h2>
      <div className="index-row">
        <div className="index-cell">
          <div className="index-label">New signups (7d)</div>
          <div className="index-value">{stats.newSignups7d}</div>
        </div>
        <div className="index-cell">
          <div className="index-label">Pending approvals</div>
          <div className="index-value">{stats.pendingApprovals}</div>
        </div>
        <div className="index-cell">
          <div className="index-label">Active listings</div>
          <div className="index-value">{stats.activeListings}</div>
        </div>
        <div className="index-cell">
          <div className="index-label">Escrow in progress</div>
          <div className="index-value">{stats.escrowInProgress}</div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="error-note">
          Some data failed to load — likely a missing column or table name mismatch:
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="feed">
        {feed.length === 0 ? (
          <div className="empty-note">No recent activity yet.</div>
        ) : (
          feed.map((item) => (
            <div key={item.id} className="feed-row">
              <span className="feed-text">{item.text}</span>
              <span className="feed-time">{timeAgo(item.created_at)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}