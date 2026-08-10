import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseclient'; // ADJUST to your actual client path

/*
  FinancialSection
  Earnings summary (marketplace.commissions) + payout account details
  (marketplace.payout_accounts) — both tables already exist in your schema,
  per your notes, so this assumes:
    commissions: id, provider_id, transaction_id, amount, status
      ('pending' | 'paid'), created_at
    payout_accounts: id, provider_id, method ('mpesa' | 'bank'),
      mpesa_phone, bank_name, bank_account_number, bank_account_name,
      is_primary
  Adjust column names below if yours differ — the two queries plus the save
  handler are the only places that touch the schema directly.

  Props: userId
*/
export default function FinancialSection({ userId }) {
  const [tab, setTab] = useState('earnings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [commissions, setCommissions] = useState([]);
  const [payoutAccount, setPayoutAccount] = useState(null);
  const [form, setForm] = useState({
    method: 'mpesa',
    mpesa_phone: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: '',
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const [commRes, payoutRes] = await Promise.all([
        supabase
          .schema('marketplace')
          .from('commissions')
          .select('*')
          .eq('provider_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .schema('marketplace')
          .from('payout_accounts')
          .select('*')
          .eq('provider_id', userId)
          .eq('is_primary', true)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      if (commRes.error) setError(commRes.error.message);
      else setCommissions(commRes.data || []);

      if (payoutRes.error) setError((e) => e || payoutRes.error.message);
      else if (payoutRes.data) {
        setPayoutAccount(payoutRes.data);
        setForm({
          method: payoutRes.data.method || 'mpesa',
          mpesa_phone: payoutRes.data.mpesa_phone || '',
          bank_name: payoutRes.data.bank_name || '',
          bank_account_number: payoutRes.data.bank_account_number || '',
          bank_account_name: payoutRes.data.bank_account_name || '',
        });
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const totalPaid = commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalPending = commissions.filter((c) => c.status === 'pending').reduce((s, c) => s + Number(c.amount || 0), 0);

  function formatKES(n) {
    return `KES ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
  }

  async function savePayoutAccount(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      provider_id: userId,
      is_primary: true,
      method: form.method,
      mpesa_phone: form.method === 'mpesa' ? form.mpesa_phone : null,
      bank_name: form.method === 'bank' ? form.bank_name : null,
      bank_account_number: form.method === 'bank' ? form.bank_account_number : null,
      bank_account_name: form.method === 'bank' ? form.bank_account_name : null,
    };
    const query = payoutAccount
      ? supabase.schema('marketplace').from('payout_accounts').update(payload).eq('id', payoutAccount.id).select().single()
      : supabase.schema('marketplace').from('payout_accounts').insert(payload).select().single();

    const { data, error: err } = await query;
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setPayoutAccount(data);
  }

  return (
    <div>
      <div className="pd-subtabs">
        <button className={`pd-subtab ${tab === 'earnings' ? 'active' : ''}`} onClick={() => setTab('earnings')}>
          Earnings
        </button>
        <button className={`pd-subtab ${tab === 'payout' ? 'active' : ''}`} onClick={() => setTab('payout')}>
          Payout details
        </button>
      </div>

      {error && <div className="pd-error">{error}</div>}

      {loading ? (
        <div className="pd-loading">Loading…</div>
      ) : tab === 'earnings' ? (
        <>
          <div className="pd-grid-2" style={{ marginBottom: 4 }}>
            <div className="pd-card">
              <div className="pd-card-sub">Total earned</div>
              <div className="pd-figure" style={{ fontSize: '1.6rem' }}>
                {formatKES(totalPaid)}
              </div>
            </div>
            <div className="pd-card">
              <div className="pd-card-sub">Pending payout</div>
              <div className="pd-figure" style={{ fontSize: '1.6rem', color: 'var(--pd-warn)' }}>
                {formatKES(totalPending)}
              </div>
            </div>
          </div>

          <div className="pd-card">
            <div className="pd-card-head">
              <h2>Recent commissions</h2>
            </div>
            {commissions.length === 0 ? (
              <div className="pd-empty">
                <strong>No commissions yet</strong>
                Earnings from closed transactions will show up here.
              </div>
            ) : (
              commissions.slice(0, 20).map((c) => (
                <div className="pd-list-row" key={c.id}>
                  <div className="pd-list-main">
                    <span className="pd-list-title">{new Date(c.created_at).toLocaleDateString('en-KE')}</span>
                    <span className="pd-list-meta">Transaction {c.transaction_id?.slice?.(0, 8) || c.transaction_id}</span>
                  </div>
                  <span className="pd-figure">{formatKES(Number(c.amount || 0))}</span>
                  <span className={`pd-badge ${c.status === 'paid' ? 'success' : 'warn'}`}>{c.status}</span>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <form className="pd-card" onSubmit={savePayoutAccount}>
          <div className="pd-card-head">
            <div>
              <h2>Where you get paid</h2>
              <div className="pd-card-sub">Commissions are sent here once a transaction closes.</div>
            </div>
          </div>

          <div className="pd-field">
            <label>Payout method</label>
            <select className="pd-select" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank account</option>
            </select>
          </div>

          {form.method === 'mpesa' ? (
            <div className="pd-field">
              <label htmlFor="pd-mpesa">M-Pesa phone number</label>
              <input
                id="pd-mpesa"
                className="pd-input mono"
                placeholder="07XX XXX XXX"
                value={form.mpesa_phone}
                onChange={(e) => setForm((f) => ({ ...f, mpesa_phone: e.target.value }))}
                required
              />
            </div>
          ) : (
            <div className="pd-grid-2">
              <div className="pd-field">
                <label htmlFor="pd-bank-name">Bank</label>
                <input
                  id="pd-bank-name"
                  className="pd-input"
                  value={form.bank_name}
                  onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                  required
                />
              </div>
              <div className="pd-field">
                <label htmlFor="pd-bank-acct-name">Account name</label>
                <input
                  id="pd-bank-acct-name"
                  className="pd-input"
                  value={form.bank_account_name}
                  onChange={(e) => setForm((f) => ({ ...f, bank_account_name: e.target.value }))}
                  required
                />
              </div>
              <div className="pd-field">
                <label htmlFor="pd-bank-acct-num">Account number</label>
                <input
                  id="pd-bank-acct-num"
                  className="pd-input mono"
                  value={form.bank_account_number}
                  onChange={(e) => setForm((f) => ({ ...f, bank_account_number: e.target.value }))}
                  required
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button className="pd-btn pd-btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save payout details'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}