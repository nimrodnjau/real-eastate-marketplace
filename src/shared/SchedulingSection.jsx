import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseclient';// ADJUST to your actual client path
import { IconPlus, IconX } from './Icons';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/*
  SchedulingSection
  Weekly recurring availability + one-off blocked dates.

  IMPORTANT - VERIFY AGAINST YOUR EXISTING BOOKING FLOW:
  Your EngageProfessionalsModule already does slot-booking for
  schedule_valuer / schedule_surveyor. Whatever table it reads available
  slots from should be the SAME table this component writes to — otherwise a
  professional can mark themselves unavailable here and buyers will still see
  open slots on their end. I've assumed two tables below
  (`provider_weekly_availability`, `provider_blocked_dates`); point them at
  your real ones if they're named differently, or if slots are generated some
  other way (e.g. a single jsonb column) the fetch/save calls below are the
  only two things that need to change.

  Props: userId, roleConfig
*/
export default function SchedulingSection({ userId, roleConfig }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [weekly, setWeekly] = useState(
    WEEKDAYS.map((_, i) => ({ weekday: i, is_active: false, start_time: '09:00', end_time: '17:00' }))
  );
  const [blockedDates, setBlockedDates] = useState([]);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const [weeklyRes, blockedRes] = await Promise.all([
        supabase.schema('marketplace').from('provider_weekly_availability').select('*').eq('provider_id', userId),
        supabase
          .schema('marketplace')
          .from('provider_blocked_dates')
          .select('*')
          .eq('provider_id', userId)
          .gte('date', new Date().toISOString().slice(0, 10))
          .order('date', { ascending: true }),
      ]);

      if (cancelled) return;
      if (weeklyRes.error) setError(weeklyRes.error.message);
      else if (weeklyRes.data && weeklyRes.data.length) {
        setWeekly(
          WEEKDAYS.map((_, i) => {
            const existing = weeklyRes.data.find((r) => r.weekday === i);
            return existing || { weekday: i, is_active: false, start_time: '09:00', end_time: '17:00' };
          })
        );
      }
      if (blockedRes.error) setError(blockedRes.error.message);
      else setBlockedDates(blockedRes.data || []);

      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function updateDay(weekday, patch) {
    setWeekly((rows) => rows.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
  }

  async function saveWeekly() {
    setSaving(true);
    setError(null);
    const rows = weekly.map((r) => ({ ...r, provider_id: userId }));
    const { error: err } = await supabase
      .schema('marketplace')
      .from('provider_weekly_availability')
      .upsert(rows, { onConflict: 'provider_id,weekday' });
    setSaving(false);
    if (err) setError(err.message);
  }

  async function addBlockedDate() {
    if (!newBlockDate) return;
    const { data, error: err } = await supabase
      .schema('marketplace')
      .from('provider_blocked_dates')
      .insert({ provider_id: userId, date: newBlockDate, reason: newBlockReason || null })
      .select()
      .single();
    if (err) {
      setError(err.message);
      return;
    }
    setBlockedDates((rows) => [...rows, data].sort((a, b) => a.date.localeCompare(b.date)));
    setNewBlockDate('');
    setNewBlockReason('');
  }

  async function removeBlockedDate(id) {
    const { error: err } = await supabase.schema('marketplace').from('provider_blocked_dates').delete().eq('id', id);
    if (err) {
      setError(err.message);
      return;
    }
    setBlockedDates((rows) => rows.filter((r) => r.id !== id));
  }

  if (loading) return <div className="pd-loading">Loading availability…</div>;

  return (
    <div>
      {error && <div className="pd-error">{error}</div>}

      <div className="pd-card">
        <div className="pd-card-head">
          <div>
            <h2>Weekly availability</h2>
            <div className="pd-card-sub">
              {roleConfig.role === 'lawyer'
                ? 'Days you can take consultation calls or meetings.'
                : 'Days and hours clients can book you for a site visit.'}
            </div>
          </div>
          <button className="pd-btn pd-btn-primary" onClick={saveWeekly} disabled={saving}>
            {saving ? 'Saving…' : 'Save availability'}
          </button>
        </div>

        {weekly.map((day) => (
          <div className="pd-list-row" key={day.weekday}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={day.is_active}
                onChange={(e) => updateDay(day.weekday, { is_active: e.target.checked })}
              />
              {WEEKDAYS[day.weekday]}
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="time"
                className="pd-input mono"
                style={{ width: 120 }}
                disabled={!day.is_active}
                value={day.start_time}
                onChange={(e) => updateDay(day.weekday, { start_time: e.target.value })}
              />
              <span className="pd-hint">to</span>
              <input
                type="time"
                className="pd-input mono"
                style={{ width: 120 }}
                disabled={!day.is_active}
                value={day.end_time}
                onChange={(e) => updateDay(day.weekday, { end_time: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="pd-card">
        <div className="pd-card-head">
          <div>
            <h2>Blocked dates</h2>
            <div className="pd-card-sub">One-off days you're unavailable, even during your usual hours.</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            type="date"
            className="pd-input mono"
            style={{ maxWidth: 170 }}
            value={newBlockDate}
            onChange={(e) => setNewBlockDate(e.target.value)}
          />
          <input
            type="text"
            className="pd-input"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="Reason (optional)"
            value={newBlockReason}
            onChange={(e) => setNewBlockReason(e.target.value)}
          />
          <button className="pd-btn pd-btn-ghost" onClick={addBlockedDate} disabled={!newBlockDate}>
            <IconPlus width={15} height={15} /> Add
          </button>
        </div>

        {blockedDates.length === 0 ? (
          <div className="pd-empty">
            <strong>No blocked dates</strong>
            You're bookable on every active day above until you add one.
          </div>
        ) : (
          blockedDates.map((b) => (
            <div className="pd-list-row" key={b.id}>
              <div className="pd-list-main">
                <span className="pd-list-title mono">{b.date}</span>
                {b.reason && <span className="pd-list-meta">{b.reason}</span>}
              </div>
              <button className="pd-btn pd-btn-ghost pd-btn-sm" onClick={() => removeBlockedDate(b.id)}>
                <IconX width={13} height={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}