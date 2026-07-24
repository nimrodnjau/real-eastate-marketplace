// components/dashboard/AgentFinancialsSection.jsx
import StatCard from './StatCard';
import '../../styles/agent-financials.css';
import PayoutAccountForm from './PayoutAccountForm';

// Takes the same `commissions` and `listings` data AgentDashboard already
// has loaded — no separate fetch, this is purely a different view over
// data that's already real (see marketplace.commissions).

const TYPE_LABEL = { sale: 'Sale', lease: 'Lease', referral: 'Referral' };
const STATUS_LABEL = { requested: 'Requested', processing: 'Processing', paid: 'Paid' };
const STATUS_TONE = { requested: 'neutral', processing: 'pending', paid: 'success' };

const money = (v) => (v ? `KES ${Math.round(v).toLocaleString()}` : '—');

export default function AgentFinancialsSection({ commissions, listings }) {
  const totalPaid = commissions
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const pending = commissions
    .filter((c) => c.status !== 'paid')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const avgCommission = commissions.length
    ? commissions.reduce((sum, c) => sum + Number(c.amount || 0), 0) / commissions.length
    : 0;

  const byType = ['sale', 'lease', 'referral'].map((type) => {
    const rows = commissions.filter((c) => c.type === type);
    return {
      type,
      count: rows.length,
      paid: rows.filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount || 0), 0),
      pending: rows.filter((c) => c.status !== 'paid').reduce((sum, c) => sum + Number(c.amount || 0), 0),
    };
  });

  const recent = [...commissions]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  return (
    <div className="financials-section">
      <div className="stat-grid">
        <StatCard icon="wallet" label="Total paid" value={money(totalPaid)} />
        <StatCard icon="clock" label="Pending" value={money(pending)} />
        <StatCard icon="fileText" label="Commissions logged" value={String(commissions.length)} />
        <StatCard icon="trendingUp" label="Average commission" value={money(avgCommission)} />
      </div>
        <PayoutAccountForm />
      <div className="financials-block">
        <h3 className="settings-block-title">By deal type</h3>
        {commissions.length === 0 ? (
          <p className="dashboard-empty">No commissions logged yet.</p>
        ) : (
          <ul className="list-rows">
            {byType.filter((t) => t.count > 0).map((t) => (
              <li key={t.type} className="list-row">
                <div>
                  <p className="list-row-title">{TYPE_LABEL[t.type]}</p>
                  <p className="list-row-meta">{t.count} logged</p>
                </div>
                <div className="list-row-actions">
                  <span className="badge badge--success">{money(t.paid)} paid</span>
                  {t.pending > 0 && <span className="badge badge--pending">{money(t.pending)} pending</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="financials-block">
        <h3 className="settings-block-title">Recent activity</h3>
        {recent.length === 0 ? (
          <p className="dashboard-empty">Nothing logged yet — commissions you record will show up here.</p>
        ) : (
          <div className="commission-activity-table">
            <div className="commission-activity-row commission-activity-row--head">
              <span>Date</span>
              <span>Deal</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {recent.map((c) => {
              const listingTitle = listings.find((l) => l.id === c.listing_id)?.title;
              return (
                <div className="commission-activity-row" key={c.id}>
                  <span className="commission-activity-date">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                  <span className="commission-activity-title">
                    {TYPE_LABEL[c.type] || c.type}
                    {listingTitle ? ` — ${listingTitle}` : ''}
                  </span>
                  <span className="commission-activity-amount">{money(c.amount)}</span>
                  <span className={`badge badge--${STATUS_TONE[c.status] || 'neutral'}`}>
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}