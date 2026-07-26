import React from "react";

// Same rules as AdminOverview.css — embedded here via <style> so this
// file renders standalone. Drop the real AdminOverview.css into your
// project unchanged; this block exists only for this preview.
const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap");

:root {
  --maroon-900: #3f0f1c;
  --maroon-700: #5c1626;
  --maroon-50: #faf5f4;
  --ink: #211613;
  --ink-soft: #7a6b67;
  --ink-faint: #a89c98;
  --line: #e8e0dd;
  --line-strong: #d8cdc9;
  --danger: #7d2036;
  --danger-bg: #f4e9ec;
  --shadow-rgb: 63, 15, 28;
  --font-display: "Spectral", Georgia, serif;
  --font-ui: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --radius: 3px;
}

.office-overview-preview {
  font-family: var(--font-ui);
  background: #f4efec;
  padding: 32px;
  border-radius: 8px;
}

.section-heading {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.4rem;
  color: #faf3f1;
  background: var(--maroon-900);
  margin: 0 0 28px;
  padding: 18px 24px;
  border-radius: var(--radius);
  letter-spacing: 0.01em;
}

.index-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.index-cell {
  background: #fff;
  border: 1px solid var(--line-strong);
  border-top: 3px solid var(--maroon-900);
  border-radius: var(--radius);
  padding: 20px 22px;
  box-shadow: 0 1px 2px rgba(var(--shadow-rgb), 0.05);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.index-cell:hover {
  box-shadow: 0 6px 16px rgba(var(--shadow-rgb), 0.12);
  transform: translateY(-1px);
}

.index-label {
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ink-soft);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
}

.index-value {
  font-family: var(--font-mono);
  font-size: 1.8rem;
  font-weight: 500;
  color: var(--maroon-900);
  font-variant-numeric: tabular-nums;
}

.error-note {
  font-family: var(--font-ui);
  font-size: 0.82rem;
  color: var(--danger);
  background: var(--danger-bg);
  border: 1px solid rgba(125, 32, 54, 0.2);
  border-radius: var(--radius);
  padding: 14px 18px;
  margin-bottom: 24px;
}

.error-note ul {
  margin: 8px 0 0;
  padding-left: 18px;
}

.error-note li {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  margin-bottom: 3px;
}

.feed {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  padding: 4px 0;
}

.feed-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  padding: 13px 18px;
  border-bottom: 1px solid var(--line);
  border-left: 2px solid transparent;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.feed-row:hover {
  background: var(--maroon-50);
  border-left-color: var(--maroon-900);
}

.feed-row:last-child {
  border-bottom: none;
}

.feed-text {
  font-family: var(--font-ui);
  font-size: 0.88rem;
  color: var(--ink);
}

.feed-time {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--ink-faint);
  white-space: nowrap;
  letter-spacing: 0.02em;
}

.empty-note {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  color: var(--ink-soft);
  padding: 20px 18px;
}

@media (max-width: 760px) {
  .index-row { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .index-row { grid-template-columns: 1fr; }
  .section-heading { padding: 16px 18px; font-size: 1.25rem; }
}
`;

const DEFAULT_STATS = {
  newSignups7d: 38,
  pendingApprovals: 12,
  activeListings: 214,
  escrowInProgress: 6,
};

const DEFAULT_FEED = [
  { id: "1", text: 'New listing "3-bed townhouse, Kilimani" — pending_review', created_at: new Date(Date.now() - 12 * 60000).toISOString() },
  { id: "2", text: "New signup: Wanjiru Kamau (agent)", created_at: new Date(Date.now() - 48 * 60000).toISOString() },
  { id: "3", text: "Escrow transaction updated — held", created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: "4", text: 'New listing "0.5 acre plot, Kitengela" — active', created_at: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: "5", text: "New signup: David Otieno (buyer)", created_at: new Date(Date.now() - 7 * 3600000).toISOString() },
];

const DEFAULT_ERRORS = [
  "agent_profiles: permission denied for schema marketplace",
  "escrow_transactions (feed): JWT expired",
];

// Stand-in for ../../utils/timeAgo so this file has no external
// imports. Swap back to your real timeAgo when you use this in place.
function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Structurally identical to your real Overview component — same
// className usage throughout, same two conditionals (errors present,
// feed empty). Only the props default to sample data here so it can
// render on its own.
export default function OverviewPreview({
  stats = DEFAULT_STATS,
  feed = DEFAULT_FEED,
  errors = DEFAULT_ERRORS,
}) {
  return (
    <div className="office-overview-preview">
      <style>{CSS}</style>
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