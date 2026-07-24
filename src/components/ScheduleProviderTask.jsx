import { useEffect, useMemo, useState } from 'react';
import { db } from '../lib/supabaseClient';
import ProviderDirectory from './ProviderDirectory';
import { PROVIDER_TASK_CONFIG } from '../lib/providerTaskConfig';

const DAYS_AHEAD = 14;

function formatDay(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function ScheduleProviderTask({ transactionId, task, editable, onTaskCompleted }) {
  const config = PROVIDER_TASK_CONFIG[task.task_key];

  const [booking, setBooking] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [provider, setProvider] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBooking() {
      setLoadingBooking(true);
      const { data, error } = await db
        .schema('marketplace')
        .from('provider_bookings')
        .select('provider_id, slot_start, slot_end, status, profiles:provider_id (full_name)')
        .eq('transaction_id', transactionId)
        .eq('task_key', task.task_key)
        .maybeSingle();

      if (cancelled) return;
      if (!error) setBooking(data || null);
      setLoadingBooking(false);
    }

    loadBooking();
    return () => {
      cancelled = true;
    };
  }, [transactionId, task.task_key]);

  useEffect(() => {
    if (!provider) return;
    let cancelled = false;

    async function loadSlots() {
      setLoadingSlots(true);
      setSelectedSlot(null);

      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + DAYS_AHEAD);

      const { data, error } = await db
        .schema('marketplace')
        .rpc('get_provider_open_slots', {
          p_provider_id: provider.user_id,
          p_from: from.toISOString().slice(0, 10),
          p_to: to.toISOString().slice(0, 10),
        });

      if (cancelled) return;

      if (error) {
        setError(error.message);
      } else {
        setSlots(data || []);
      }
      setLoadingSlots(false);
    }

    loadSlots();
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const slotsByDay = useMemo(() => {
    const groups = new Map();
    slots.forEach((s) => {
      const start = new Date(s.slot_start);
      const key = start.toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });
    return groups;
  }, [slots]);

  async function handleConfirm() {
    if (!provider || !selectedSlot) return;
    setSaving(true);
    setError(null);

    const { data: nextStage, error: rpcError } = await db
      .schema('marketplace')
      .rpc('request_provider_booking', {
        p_transaction_id: transactionId,
        p_task_key: task.task_key,
        p_provider_id: provider.user_id,
        p_slot_start: selectedSlot.slot_start,
        p_slot_end: selectedSlot.slot_end,
      });

    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setBooking({
      provider_id: provider.user_id,
      slot_start: selectedSlot.slot_start,
      slot_end: selectedSlot.slot_end,
      status: 'pending',
      profiles: provider.profiles,
    });
    onTaskCompleted?.(nextStage);
  }

  if (loadingBooking) return <p className="provider-task-state">Loading…</p>;

  if (booking) {
    const start = new Date(booking.slot_start);
    return (
      <p className="provider-task-done">
        Booked <strong>{booking.profiles?.full_name || 'a provider'}</strong> for {formatDay(start)} at{' '}
        {formatTime(start)}.{' '}
        {booking.status === 'pending' && (
          <span className="provider-task-pending">Awaiting their confirmation.</span>
        )}
        {booking.status === 'confirmed' && <span className="provider-task-confirmed">Confirmed.</span>}
        {booking.status === 'declined' && (
          <span className="provider-task-declined">They declined — please pick another slot.</span>
        )}
      </p>
    );
  }

  if (!editable) {
    return <p className="provider-task-waiting">Waiting on the buyer to schedule a {config.roleLabel}.</p>;
  }

  return (
    <div className="provider-task">
      <p className="provider-task-title">{config.directoryTitle}</p>
      <ProviderDirectory
        providerType={config.providerType}
        selectedProviderId={provider?.user_id}
        onSelect={setProvider}
      />

      {provider && (
        <div className="provider-task-slots">
          <p className="provider-task-subtitle">Pick a time with {provider.profiles?.full_name || 'this provider'}</p>

          {loadingSlots && <p className="provider-task-state">Loading open times…</p>}

          {!loadingSlots && slots.length === 0 && (
            <p className="provider-task-state">No open slots in the next {DAYS_AHEAD} days.</p>
          )}

          {!loadingSlots &&
            Array.from(slotsByDay.entries()).map(([dayKey, daySlots]) => (
              <div key={dayKey} className="provider-task-day">
                <span className="provider-task-day-label">{formatDay(new Date(daySlots[0].slot_start))}</span>
                <div className="provider-task-day-slots">
                  {daySlots.map((s) => {
                    const isSelected = selectedSlot?.slot_start === s.slot_start;
                    return (
                      <button
                        key={s.slot_start}
                        type="button"
                        className={`provider-task-slot-button${isSelected ? ' is-selected' : ''}`}
                        onClick={() => setSelectedSlot(s)}
                      >
                        {formatTime(new Date(s.slot_start))}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {error && <p className="provider-task-error">{error}</p>}

      <button
        type="button"
        className="provider-task-confirm"
        disabled={!selectedSlot || saving}
        onClick={handleConfirm}
      >
        {saving ? 'Booking…' : 'Request this slot'}
      </button>
    </div>
  );
}