// components/dashboard/FinancialsSection.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Landmark, ShieldCheck, Clock, CheckCircle2, RotateCcw, ChevronDown, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import '../../styles/FinancialsSection.css';

const STATUS_META = {
  pending:  { label: 'Awaiting deposit', icon: Clock,        className: 'escrow-status--pending' },
  held:     { label: 'Held in escrow',   icon: ShieldCheck,  className: 'escrow-status--pending' },
  released: { label: 'Released',         icon: CheckCircle2, className: 'escrow-status--verified' },
  refunded: { label: 'Refunded',         icon: RotateCcw,    className: 'escrow-status--rejected' },
};

// Fixed step order for the happy path. 'refunded' is handled separately
// since it can branch off from either 'pending' or 'held'.
const HAPPY_PATH_STEPS = [
  { key: 'deposited', label: 'Deposited' },
  { key: 'held',      label: 'Held in escrow' },
  { key: 'completed',status: 'released', label: 'Sale completed' },
  { key: 'disbursed', label: 'Funds released' },
];

function getStepIndex(status) {
  // Maps a transaction's current status to how many happy-path steps are complete.
  switch (status) {
    case 'pending':  return 0; // deposit not yet confirmed
    case 'held':     return 2; // deposited + held both done
    case 'released': return 4; // all steps done
    default:         return 0;
  }
}

function EscrowProgressTracker({ transaction }) {
  const { status, created_at, released_at, updated_at } = transaction;

  if (status === 'refunded') {
    return (
      <div className="escrow-tracker escrow-tracker--refunded">
        <RotateCcw size={16} />
        <div>
          <p className="escrow-tracker-title">Refunded to buyer</p>
          <p className="escrow-tracker-date">
            {new Date(updated_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
    );
  }

  const completedSteps = getStepIndex(status);

  const stepDates = [
    created_at,                                  // deposited
    status === 'held' || status === 'released' ? updated_at : null, // held (approx)
    status === 'released' ? released_at : null,  // completed
    status === 'released' ? released_at : null,  // disbursed
  ];

  return (
    <div className="escrow-tracker">
      {HAPPY_PATH_STEPS.map((step, i) => {
        const isDone = i < completedSteps;
        const isCurrent = i === completedSteps;
        const date = stepDates[i];
        return (
          <div key={step.key} className={`escrow-step ${isDone ? 'escrow-step--done' : ''} ${isCurrent ? 'escrow-step--current' : ''}`}>
            <div className="escrow-step-dot" />
            <div className="escrow-step-body">
              <p className="escrow-step-label">{step.label}</p>
              {date && (
                <p className="escrow-step-date">
                  {new Date(date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
            {i < HAPPY_PATH_STEPS.length - 1 && <div className={`escrow-step-line ${isDone ? 'escrow-step-line--done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function FinancialsSection({ listings }) {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [txError, setTxError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [payoutAccount, setPayoutAccount] = useState(null);
  const [form, setForm] = useState({ bank_name: '', account_name: '', account_number: '' });
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const sold = listings.filter((l) => l.status === 'sold');
  const totalSoldValue = sold.reduce((sum, l) => sum + Number(l.price || 0), 0);
  const activeValue = listings
    .filter((l) => l.status === 'active' || l.status === 'under_offer')
    .reduce((sum, l) => sum + Number(l.price || 0), 0);

  const escrowSummary = useMemo(() => {
    const inEscrow = transactions.filter((t) => t.status === 'pending' || t.status === 'held');
    const totalHeld = inEscrow.reduce((sum, t) => sum + Number(t.amount_deposited || 0), 0);
    const totalPendingPayout = inEscrow.reduce((sum, t) => sum + Number(t.net_payout_amount || 0), 0);
    return { count: inEscrow.length, totalHeld, totalPendingPayout };
  }, [transactions]);

  const fetchTransactions = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingTx(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('escrow_transactions')
      .select(`
        id, amount_deposited, commission_rate, commission_amount, net_payout_amount,
        status, created_at, released_at, updated_at,
        listing:listings(id, title),
        agent:profiles!escrow_transactions_agent_id_fkey(id, full_name)
      `)
      .eq('seller_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) setTxError(error.message);
    else { setTransactions(data || []); setTxError(null); }
    setLoadingTx(false);
  }, [profile?.id]);

  const fetchPayoutAccount = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingAccount(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('payout_accounts')
      .select('*')
      .eq('seller_id', profile.id)
      .maybeSingle();

    if (!error && data) {
      setPayoutAccount(data);
      setForm({ bank_name: data.bank_name, account_name: data.account_name, account_number: data.account_number });
    }
    setLoadingAccount(false);
  }, [profile?.id]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
  useEffect(() => { fetchPayoutAccount(); }, [fetchPayoutAccount]);

  async function handleSaveAccount(e) {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);

    const payload = {
      seller_id: profile.id,
      bank_name: form.bank_name.trim(),
      account_name: form.account_name.trim(),
      account_number: form.account_number.trim(),
    };

    if (payoutAccount?.is_verified) payload.is_verified = false;

    const { data, error } = await supabase
      .schema('marketplace')
      .from('payout_accounts')
      .upsert(payload, { onConflict: 'seller_id' })
      .select()
      .single();

    setSaving(false);
    if (error) {
      setSaveStatus({ ok: false, message: error.message });
    } else {
      setPayoutAccount(data);
      setSaveStatus({ ok: true, message: 'Payout account saved.' });
    }
  }

  return (
    <div className="financials-section">
      <div className="financials-stat-grid">
        <div className="financials-stat-card">
          <p className="financials-stat-value">KES {totalSoldValue.toLocaleString()}</p>
          <p className="financials-stat-label">Total value sold</p>
        </div>
        <div className="financials-stat-card">
          <p className="financials-stat-value">KES {activeValue.toLocaleString()}</p>
          <p className="financials-stat-label">Value currently listed</p>
        </div>
        <div className="financials-stat-card">
          <p className="financials-stat-value">{sold.length}</p>
          <p className="financials-stat-label">Properties sold</p>
        </div>
      </div>

      {escrowSummary.count > 0 && (
        <div className="escrow-summary-banner">
          <Wallet size={18} />
          <div>
            <p className="escrow-summary-amount">KES {escrowSummary.totalHeld.toLocaleString()}</p>
            <p className="escrow-summary-label">
              currently in escrow across {escrowSummary.count} transaction{escrowSummary.count === 1 ? '' : 's'}
              {' '}· you'll receive KES {escrowSummary.totalPendingPayout.toLocaleString()} once released
            </p>
          </div>
        </div>
      )}

      <div className="financials-block">
        <h3 className="financials-block-title">Escrow deposits</h3>
        {loadingTx ? (
          <p className="financials-empty">Loading…</p>
        ) : txError ? (
          <p className="financials-error">{txError}</p>
        ) : transactions.length === 0 ? (
          <p className="financials-empty">
            No buyer deposits yet. They'll show up here as soon as a buyer puts funds into escrow
            for one of your listings.
          </p>
        ) : (
          <div className="escrow-table">
            <div className="escrow-row escrow-row--head">
              <span>Listing</span>
              <span>Deposited</span>
              <span>Commission</span>
              <span>You receive</span>
              <span>Status</span>
            </div>
            {transactions.map((t) => {
              const status = STATUS_META[t.status] || STATUS_META.pending;
              const StatusIcon = status.icon;
              const isExpanded = expandedId === t.id;
              return (
                <div key={t.id} className="escrow-row-wrap">
                  <button
                    type="button"
                    className="escrow-row escrow-row--clickable"
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  >
                    <span className="escrow-listing-title">{t.listing?.title || '—'}</span>
                    <span>KES {Number(t.amount_deposited).toLocaleString()}</span>
                    <span className="escrow-commission">
                      − KES {Number(t.commission_amount).toLocaleString()}
                      <span className="escrow-commission-rate">({(t.commission_rate * 100).toFixed(0)}%{t.agent ? ` to ${t.agent.full_name}` : ''})</span>
                    </span>
                    <span className="escrow-net">KES {Number(t.net_payout_amount).toLocaleString()}</span>
                    <span className={`escrow-status ${status.className}`}>
                      <StatusIcon size={13} /> {status.label}
                      <ChevronDown size={13} className={`escrow-chevron ${isExpanded ? 'escrow-chevron--open' : ''}`} />
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="escrow-row-expanded">
                      <EscrowProgressTracker transaction={t} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="financials-block">
        <h3 className="financials-block-title">Payout account</h3>
        <p className="financials-block-desc" style={{ marginBottom: 14 }}>
          Funds are released here once a sale completes and escrow clears — the commission shown
          above is deducted automatically before release.
        </p>

        {payoutAccount?.is_verified && (
          <p className="payout-verified-badge"><ShieldCheck size={14} /> Verified account</p>
        )}
        {payoutAccount && !payoutAccount.is_verified && (
          <p className="payout-pending-badge"><Clock size={14} /> Pending verification</p>
        )}

        {loadingAccount ? (
          <p className="financials-empty">Loading…</p>
        ) : (
          <form className="payout-form" onSubmit={handleSaveAccount}>
            <label>Bank name
              <input
                value={form.bank_name}
                onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                placeholder="e.g. Equity Bank"
                required
              />
            </label>
            <div className="payout-form-row">
              <label>Account name
                <input
                  value={form.account_name}
                  onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))}
                  placeholder="As it appears on the account"
                  required
                />
              </label>
              <label>Account number
                <input
                  value={form.account_number}
                  onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
                  required
                />
              </label>
            </div>

            {saveStatus && (
              <p className={saveStatus.ok ? 'payout-form-success' : 'payout-form-error'}>{saveStatus.message}</p>
            )}

            <div className="payout-form-actions">
              <button type="submit" disabled={saving}>
                <Landmark size={15} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                {saving ? 'Saving…' : payoutAccount ? 'Update account' : 'Save account'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="coming-soon">
        <p className="coming-soon-title">M-Pesa deposit flow — not yet connected</p>
        <p className="coming-soon-desc">
          The table above reads real <code>marketplace.escrow_transactions</code> rows, but nothing
          writes to that table yet — it needs an STK-push edge function (buyer initiates deposit) and
          a callback handler (M-Pesa confirms payment, using the service role key to insert/update the
          row, bypassing RLS by design). Your M-Pesa secrets are already configured, so this is ready
          to build whenever you want it.
        </p>
      </div>
    </div>
  );
}