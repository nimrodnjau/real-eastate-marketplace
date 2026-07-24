import { useEffect, useState } from 'react';
import { db } from '../lib/supabaseClient';
import ProviderDirectory from './ProviderDirectory';
import { PROVIDER_TASK_CONFIG } from '../lib/providerTaskConfig';

export default function HireProviderTask({ transactionId, task, editable, onTaskCompleted }) {
  const config = PROVIDER_TASK_CONFIG[task.task_key];

  const [engagement, setEngagement] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await db
        .schema('marketplace')
        .from('transaction_provider_engagements')
        .select('provider_id, service_provider_profiles!provider_id(profiles:user_id(full_name))')
        .eq('transaction_id', transactionId)
        .eq('task_key', task.task_key)
        .maybeSingle();

      if (cancelled) return;

      if (!error) setEngagement(data || null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [transactionId, task.task_key]);

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    setError(null);

    const { data: nextStage, error: rpcError } = await db
      .schema('marketplace')
      .rpc('engage_provider_task', {
        p_transaction_id: transactionId,
        p_task_key: task.task_key,
        p_provider_id: selected.user_id,
      });

    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setEngagement({ provider_id: selected.user_id, profiles: selected.profiles });
    onTaskCompleted?.(nextStage);
  }

  if (loading) return <p className="provider-task-state">Loading…</p>;

  if (engagement) {
    return (
      <p className="provider-task-done">
        Engaged <strong>{engagement.profiles?.full_name || 'a provider'}</strong> as your {config.roleLabel}.
      </p>
    );
  }

  if (!editable) {
    return <p className="provider-task-waiting">Waiting on the buyer to choose a {config.roleLabel}.</p>;
  }

  return (
    <div className="provider-task">
      <p className="provider-task-title">{config.directoryTitle}</p>
      <ProviderDirectory
        providerType={config.providerType}
        selectedProviderId={selected?.user_id}
        onSelect={setSelected}
      />
      {error && <p className="provider-task-error">{error}</p>}
      <button
        type="button"
        className="provider-task-confirm"
        disabled={!selected || saving}
        onClick={handleConfirm}
      >
        {saving ? 'Engaging…' : `Engage this ${config.roleLabel}`}
      </button>
    </div>
  );
}