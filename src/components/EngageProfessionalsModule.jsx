// components/EngageProfessionalsModule.jsx
//
// Group renderer for the 'connect' stage's three provider-engagement tasks
// (hire_lawyer, schedule_valuer, schedule_surveyor). Rendered by
// StageTaskModule (see TASK_GROUPS in providerTaskConfig.js) in place of
// the three individual rows, walking the buyer through them one at a time
// using this module's own card-based provider picker — avatar, license,
// rating, bio, credentials link, and a Message button — instead of the
// plain ProviderDirectory list HireProviderTask/ScheduleProviderTask use.
//
// Engagement/booking is written through the SAME RPCs the plain per-task
// renderers use (engage_provider_task / request_provider_booking), so
// anything downstream that reads transaction_provider_engagements /
// provider_bookings still sees this module's confirmations. This module
// does NOT write to transaction_task_completions directly — StageTaskModule
// already tracks that from the RPCs' own side effects and passes the
// result down via the `completions` prop below.
//
// Renders as a floating overlay window (.engage-professionals-overlay /
// -window in the CSS) instead of inline content. Closing it (X button,
// Escape, or clicking the backdrop) collapses to a slim reopen bar via
// local `isOpen` state — provider/slot selection stays intact since none
// of it lives outside this component.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Star, X } from 'lucide-react';
import { db } from '../lib/supabaseClient';
import ProcessTracker from './dashboard/ProcessTracker';
import { PROVIDER_TASK_CONFIG } from '../lib/providerTaskConfig';
import '../styles/engage-professionals-module.css';

const DAYS_AHEAD = 14;

function formatDay(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function EngageProfessionalsModule({
  transactionId,
  tasks, // this group's task rows, already sorted by sort_order
  completions, // full completions map from StageTaskModule: task_key -> completed_by
  canToggle, // (ownerRole) => bool
  justAdvanced,
  onTaskCompleted, // (taskKey, nextStage) => void
  listingId, // forwarded from PurchaseTracker -> StageTaskModule -> here, for messaging
}) {
  const navigate = useNavigate();

  const doneKeys = new Set(tasks.filter((t) => completions[t.task_key]).map((t) => t.task_key));
  const activeTask = tasks.find((t) => !doneKeys.has(t.task_key));
  const allDone = !activeTask;

  const config = activeTask ? PROVIDER_TASK_CONFIG[activeTask.task_key] : null;
  const editable = activeTask ? canToggle(activeTask.owner_role) && !justAdvanced : false;

  // Floating window can be collapsed to the reopen bar without losing any
  // selection state below — it just toggles what's rendered.
  const [isOpen, setIsOpen] = useState(true);

  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  // Esc collapses the window to the reopen bar, same as the close button.
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Reset per-role selection whenever the active task changes.
  useEffect(() => {
    setSelectedProvider(null);
    setSelectedSlot(null);
    setSlots([]);
    setError(null);
  }, [activeTask?.task_key]);

  useEffect(() => {
    if (!activeTask || !config) {
      setProviders([]);
      return;
    }
    let cancelled = false;
    setLoadingProviders(true);

    db.schema('marketplace')
      .from('service_provider_profiles')
      .select(`
        user_id, provider_type, license_number, bio, rating_avg, credential_url,
        profile:profiles!service_provider_profiles_user_id_fkey(id, full_name, avatar_url, phone, email)
      `)
      // TODO: confirm 'verified' matches your verification_status enum value
      // (carried over from the original draft — same assumption HireProviderTask
      // and ScheduleProviderTask make implicitly via ProviderDirectory).
      .eq('provider_type', config.providerType)
      .eq('verification_status', 'verified')
      .order('rating_avg', { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          setProviders([]);
        } else {
          setProviders(data || []);
        }
        setLoadingProviders(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTask?.task_key, config]);

  // For schedule-mode roles (valuer, surveyor), load open slots once a
  // provider is picked — mirrors ScheduleProviderTask's own slot fetch.
  useEffect(() => {
    if (!selectedProvider || config?.mode !== 'schedule') {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedSlot(null);

    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + DAYS_AHEAD);

    db.schema('marketplace')
      .rpc('get_provider_open_slots', {
        p_provider_id: selectedProvider.user_id,
        p_from: from.toISOString().slice(0, 10),
        p_to: to.toISOString().slice(0, 10),
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setSlots(data || []);
        setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProvider, config?.mode]);

  const slotsByDay = useMemo(() => {
    const groups = new Map();
    slots.forEach((s) => {
      const key = new Date(s.slot_start).toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });
    return groups;
  }, [slots]);

  function handleMessage(provider) {
    // Same pattern ListingDetail's handleInquiry already uses — MessagesSection
    // picks this up via location.state and finds-or-creates the conversation.
    navigate('/dashboard/messages', {
      state: { startConversationWith: provider.user_id, listingId },
    });
  }

  async function handleConfirm() {
    if (!activeTask || !selectedProvider || confirming) return;
    if (config.mode === 'schedule' && !selectedSlot) return;

    setConfirming(true);
    setError(null);

    const rpcName = config.mode === 'schedule' ? 'request_provider_booking' : 'engage_provider_task';
    const rpcArgs =
      config.mode === 'schedule'
        ? {
            p_transaction_id: transactionId,
            p_task_key: activeTask.task_key,
            p_provider_id: selectedProvider.user_id,
            p_slot_start: selectedSlot.slot_start,
            p_slot_end: selectedSlot.slot_end,
          }
        : {
            p_transaction_id: transactionId,
            p_task_key: activeTask.task_key,
            p_provider_id: selectedProvider.user_id,
          };

    const { data: nextStage, error: rpcError } = await db.schema('marketplace').rpc(rpcName, rpcArgs);

    setConfirming(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    // StageTaskModule only advances the stage if nextStage differs from the
    // current one, so intermediate confirmations (e.g. lawyer done, stage
    // still 'connect') are safe to always report the same way.
    onTaskCompleted(activeTask.task_key, nextStage);
  }

  const steps = tasks.map((t) => ({
    label: t.label,
    status: doneKeys.has(t.task_key) ? 'done' : t.task_key === activeTask?.task_key ? 'active' : 'upcoming',
  }));

  if (!isOpen) {
    return (
      <button type="button" className="engage-professionals-reopen" onClick={() => setIsOpen(true)}>
        {activeTask ? `Continue: ${activeTask.label}` : 'Continue engaging professionals'}
      </button>
    );
  }

  return (
    <div
      className="engage-professionals-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div
        className="engage-professionals-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="engage-professionals-title"
      >
        <div className="engage-professionals-window-header">
          <h2 id="engage-professionals-title" className="engage-professionals-window-title">
            Engage your professionals
          </h2>
          <button
            type="button"
            className="engage-professionals-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="engage-professionals-window-body">
          <ProcessTracker steps={steps} />

          {error && <p className="engage-professionals-error">{error}</p>}

          {allDone ? (
            <p className="engage-professionals-complete">
              {tasks.map((t) => t.label).join(', ')} are all confirmed. Moving to the next step.
            </p>
          ) : !editable ? (
            <p className="engage-professionals-state">
              Waiting on the buyer to {config.mode === 'schedule' ? 'schedule' : 'choose'} a {config.roleLabel}.
            </p>
          ) : (
            <>
              <h3 className="engage-professionals-heading">{config.directoryTitle}</h3>

              {loadingProviders ? (
                <p className="engage-professionals-state">Loading {config.roleLabel}s…</p>
              ) : providers.length === 0 ? (
                <p className="engage-professionals-state">No verified {config.roleLabel}s available yet.</p>
              ) : (
                <div className="engage-professionals-grid">
                  {providers.map((p) => {
                    const isSelected = selectedProvider?.user_id === p.user_id;
                    return (
                      <div
                        key={p.user_id}
                        className={`engage-professionals-card${isSelected ? ' is-selected' : ''}`}
                      >
                        <img
                          className="engage-professionals-avatar"
                          src={p.profile?.avatar_url || 'https://placehold.co/64x64?text=%20'}
                          alt=""
                        />
                        <p className="engage-professionals-name">{p.profile?.full_name}</p>
                        <p className="engage-professionals-license">
                          <ShieldCheck size={13} /> License {p.license_number}
                        </p>
                        {p.rating_avg != null && (
                          <p className="engage-professionals-rating">
                            <Star size={13} /> {Number(p.rating_avg).toFixed(1)}
                          </p>
                        )}
                        {p.bio && <p className="engage-professionals-bio">{p.bio}</p>}
                        {p.credential_url && (
                          <a
                            href={p.credential_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="engage-professionals-credential-link"
                          >
                            View credentials
                          </a>
                        )}

                        <div className="engage-professionals-card-actions">
                          <button type="button" onClick={() => handleMessage(p)}>
                            Message
                          </button>
                          <button type="button" onClick={() => setSelectedProvider(p)}>
                            {isSelected ? 'Selected' : `Select as ${config.roleLabel}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedProvider && config.mode === 'schedule' && (
                <div className="engage-professionals-slots">
                  <p className="engage-professionals-subtitle">
                    Pick a time with {selectedProvider.profile?.full_name || 'this provider'}
                  </p>

                  {loadingSlots && <p className="engage-professionals-state">Loading open times…</p>}
                  {!loadingSlots && slots.length === 0 && (
                    <p className="engage-professionals-state">No open slots in the next {DAYS_AHEAD} days.</p>
                  )}
                  {!loadingSlots &&
                    Array.from(slotsByDay.entries()).map(([dayKey, daySlots]) => (
                      <div key={dayKey} className="engage-professionals-day">
                        <span className="engage-professionals-day-label">
                          {formatDay(new Date(daySlots[0].slot_start))}
                        </span>
                        <div className="engage-professionals-day-slots">
                          {daySlots.map((s) => {
                            const isSlotSelected = selectedSlot?.slot_start === s.slot_start;
                            return (
                              <button
                                key={s.slot_start}
                                type="button"
                                className={`engage-professionals-slot-button${isSlotSelected ? ' is-selected' : ''}`}
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

              {selectedProvider && (
                <button
                  type="button"
                  className="engage-professionals-confirm"
                  disabled={confirming || (config.mode === 'schedule' && !selectedSlot)}
                  onClick={handleConfirm}
                >
                  {confirming
                    ? config.mode === 'schedule'
                      ? 'Booking…'
                      : 'Engaging…'
                    : config.mode === 'schedule'
                    ? 'Request this slot'
                    : `Engage this ${config.roleLabel}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}