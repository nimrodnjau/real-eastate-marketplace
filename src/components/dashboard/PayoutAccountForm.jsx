import { useState, useEffect, useCallback } from 'react';
import { Landmark, Smartphone, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import '../../styles/payout-account-form.css';

const EMPTY_FORM = {
  method: 'bank',
  bank_name: '',
  account_name: '',
  account_number: '',
  branch_code: '',
  mpesa_phone: '',
};

export default function PayoutAccountForm() {
  const { profile } = useAuth();
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  const fetchAccount = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('payout_accounts')
      .select('*')
      .eq('agent_id', profile.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load payout account:', error);
      setError(error.message);
    } else {
      setAccount(data);
      if (data) setForm({ ...EMPTY_FORM, ...data });
      setError(null);
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      agent_id: profile.id,
      method: form.method,
      bank_name: form.method === 'bank' ? form.bank_name || null : null,
      account_name: form.method === 'bank' ? form.account_name || null : null,
      account_number: form.method === 'bank' ? form.account_number || null : null,
      branch_code: form.method === 'bank' ? form.branch_code || null : null,
      mpesa_phone: form.method === 'mpesa' ? form.mpesa_phone || null : null,
      is_verified: false, // any edit resets verification — re-check required
    };

    const { data, error } = await supabase
      .schema('marketplace')
      .from('payout_accounts')
      .upsert(payload, { onConflict: 'agent_id' })
      .select()
      .single();

    setSaving(false);
    if (error) {
      console.error('Failed to save payout account:', error);
      setError(error.message);
      return;
    }
    setAccount(data);
    setEditing(false);
  }

  if (loading) return <p>Loading payout details…</p>;

  const maskedAccount = account?.account_number
    ? `•••• ${account.account_number.slice(-4)}`
    : null;

  if (account && !editing) {
    return (
      <div className="financials-block">
        <h3 className="settings-block-title">Payout account</h3>
        <div className="list-row">
          <div>
            <p className="list-row-title">
              {account.method === 'mpesa' ? (
                <><Smartphone size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />M-Pesa</>
              ) : (
                <><Landmark size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />{account.bank_name}</>
              )}
            </p>
            <p className="list-row-meta">
              {account.method === 'mpesa' ? account.mpesa_phone : `${account.account_name} · ${maskedAccount}`}
            </p>
          </div>
          <div className="list-row-actions">
            <span className={`badge badge--${account.is_verified ? 'success' : 'pending'}`}>
              {account.is_verified ? (<><CheckCircle2 size={13} /> Verified</>) : 'Pending verification'}
            </span>
            <button type="button" className="list-row-edit-btn" onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>
        </div>
        {error && <p className="dashboard-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="financials-block">
      <h3 className="settings-block-title">Payout account</h3>
      <p className="dashboard-empty" style={{ marginBottom: 12 }}>
        Add where commission payouts should be sent once marked paid.
      </p>

      <form onSubmit={handleSave} className="payout-account-form">
        <div className="submit-listing-options" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={`submit-listing-option ${form.method === 'bank' ? 'submit-listing-option--selected' : ''}`}
            onClick={() => updateField('method', 'bank')}
          >
            <Landmark size={20} className="submit-listing-option-icon" />
            <span className="submit-listing-option-title">Bank account</span>
          </button>
          <button
            type="button"
            className={`submit-listing-option ${form.method === 'mpesa' ? 'submit-listing-option--selected' : ''}`}
            onClick={() => updateField('method', 'mpesa')}
          >
            <Smartphone size={20} className="submit-listing-option-icon" />
            <span className="submit-listing-option-title">M-Pesa</span>
          </button>
        </div>

        {form.method === 'bank' ? (
          <>
            <label className="form-field">
              <span>Bank name</span>
              <input type="text" value={form.bank_name} onChange={(e) => updateField('bank_name', e.target.value)} required />
            </label>
            <label className="form-field">
              <span>Account name</span>
              <input type="text" value={form.account_name} onChange={(e) => updateField('account_name', e.target.value)} required />
            </label>
            <label className="form-field">
              <span>Account number</span>
              <input type="text" inputMode="numeric" value={form.account_number} onChange={(e) => updateField('account_number', e.target.value)} required />
            </label>
            <label className="form-field">
              <span>Branch code (optional)</span>
              <input type="text" value={form.branch_code} onChange={(e) => updateField('branch_code', e.target.value)} />
            </label>
          </>
        ) : (
          <label className="form-field">
            <span>M-Pesa phone number</span>
            <input type="tel" placeholder="07XX XXX XXX" value={form.mpesa_phone} onChange={(e) => updateField('mpesa_phone', e.target.value)} required />
          </label>
        )}

        {error && <p className="dashboard-error">{error}</p>}

        <div className="submit-listing-actions">
          {account && (
            <button type="button" className="submit-listing-cancel" onClick={() => { setEditing(false); setForm({ ...EMPTY_FORM, ...account }); setError(null); }}>
              Cancel
            </button>
          )}
          <button type="submit" className="submit-listing-confirm" disabled={saving}>
            {saving ? 'Saving…' : 'Save payout details'}
          </button>
        </div>
      </form>
    </div>
  );
}