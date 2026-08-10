import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Star, Calendar } from 'lucide-react';
import StageWindow, { StageSubsteps } from './StageWindow';
import ConversationThread from '../dashboard/ConversationThread';
import { supabase } from '../../lib/supabaseClient';
import {
  findConversation,
  findOrCreateConversation,
  sendTextMessage,
  hasSentMessage,
} from '../../lib/conversations';
import '../../styles/stage1-connect.css';

const MOCK_SLOTS = [
  { start: '2026-08-05T09:00:00', label: 'Wed, Aug 5 · 9:00 AM' },
  { start: '2026-08-05T14:00:00', label: 'Wed, Aug 5 · 2:00 PM' },
  { start: '2026-08-06T10:30:00', label: 'Thu, Aug 6 · 10:30 AM' },
];

const PRO_ROLES = [
  { key: 'lawyer', label: 'Lawyer', mode: 'engage' },
  { key: 'valuer', label: 'Valuer', mode: 'schedule' },
  { key: 'surveyor', label: 'Surveyor', mode: 'schedule' },
];

function formatSlot(start) {
  const existingSlot = MOCK_SLOTS.find((slot) => slot.start === start);

  if (existingSlot) {
    return existingSlot.label;
  }

  return new Date(start).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function Stage1Connect({
  transactionId,
  listing,
  buyerId,
  buyerName,
  agentId,
  agentName,
  sellerId,
  sellerName,
  viewerId,
  viewerName,
  onAdvanceStage,
}) {
  const isBuyer = viewerId === buyerId;
  const counterpartId = agentId || sellerId;
  const counterpartName = agentId ? agentName : sellerName;

  // --- Inquiry ---
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquiryStatus, setInquiryStatus] = useState('checking');
  const [inquirySending, setInquirySending] = useState(false);
  const [inquiryError, setInquiryError] = useState('');
  const [conversationId, setConversationId] = useState(null);

  // --- Site visit ---
  const [visitStatus, setVisitStatus] = useState('loading');
  const [proposedSlots, setProposedSlots] = useState([]);
  const [confirmedSlot, setConfirmedSlot] = useState(null);
  const [visitSaving, setVisitSaving] = useState(false);
  const [visitError, setVisitError] = useState('');

  // --- Professionals ---
  const [providersByRole, setProvidersByRole] = useState({
    lawyer: [],
    valuer: [],
    surveyor: [],
  });
  const [providersLoading, setProvidersLoading] = useState(true);
  const [engagementError, setEngagementError] = useState('');
  const [engagementSaving, setEngagementSaving] = useState(false);
  const [engaged, setEngaged] = useState({
    lawyer: null,
    valuer: null,
    surveyor: null,
  });
  const [activeRoleKey, setActiveRoleKey] = useState('lawyer');
  const [selectedProviderId, setSelectedProviderId] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const activeRole = PRO_ROLES.find((role) => role.key === activeRoleKey);
  const nextUnengaged = PRO_ROLES.find((role) => !engaged[role.key]);

  // Check whether the buyer already sent an inquiry.
  useEffect(() => {
    let cancelled = false;

    if (!buyerId || !counterpartId) {
      setInquiryStatus('none');
      return undefined;
    }

    async function loadInquiry() {
      try {
        const id = await findConversation(
          supabase,
          buyerId,
          counterpartId,
          listing?.id
        );

        if (cancelled) return;

        setConversationId(id);

        if (id) {
          const sent = await hasSentMessage(supabase, id, buyerId);

          if (!cancelled) {
            setInquiryStatus(sent ? 'sent' : 'none');
          }
        } else {
          setInquiryStatus('none');
        }
      } catch (error) {
        console.error('Failed to check inquiry status:', error);

        if (!cancelled) {
          setInquiryStatus('none');
        }
      }
    }

    loadInquiry();

    return () => {
      cancelled = true;
    };
  }, [buyerId, counterpartId, listing?.id]);

  // Load saved viewing requests, real providers, and saved engagements.
  const loadStageData = useCallback(async () => {
    if (!buyerId || !listing?.id || !transactionId) return;

    setVisitStatus('loading');
    setProvidersLoading(true);
    setVisitError('');
    setEngagementError('');

    const [
      { data: viewingRequests, error: viewingRequestsError },
      { data: providerRecords, error: providersError },
      { data: engagementRecords, error: engagementsError },
    ] = await Promise.all([
      supabase
        .schema('marketplace')
        .from('viewing_requests')
        .select('id, status, preferred_at, scheduled_for')
        .eq('buyer_id', buyerId)
        .eq('listing_id', listing.id)
        .eq('transaction_id', transactionId)
        .in('status', ['pending', 'confirmed'])
        .order('requested_at', { ascending: true }),

      supabase
        .schema('marketplace')
        .from('service_provider_profiles')
        .select('user_id, provider_type, license_number, bio, rating_avg')
        .in('provider_type', ['lawyer', 'valuer', 'surveyor'])
        .eq('verification_status', 'verified'),

      supabase
        .schema('marketplace')
        .from('transaction_provider_engagements')
        .select('task_key, provider_id, appointment_at')
        .eq('transaction_id', transactionId),
    ]);

    if (viewingRequestsError) {
      console.error('Failed to load viewing requests:', viewingRequestsError);
      setVisitError("Couldn't load site-visit details.");
      setVisitStatus('none');
    } else {
      const confirmedRequest = viewingRequests?.find(
        (request) => request.status === 'confirmed'
      );

      if (confirmedRequest) {
        const start =
          confirmedRequest.scheduled_for || confirmedRequest.preferred_at;

        setConfirmedSlot({
          id: confirmedRequest.id,
          start,
          label: formatSlot(start),
        });
        setVisitStatus('confirmed');
      } else if (viewingRequests?.length) {
        setProposedSlots(
          viewingRequests.map((request) => ({
            id: request.id,
            start: request.preferred_at,
            label: formatSlot(request.preferred_at),
          }))
        );
        setVisitStatus('requested');
      } else {
        setVisitStatus('none');
      }
    }

    if (providersError) {
      console.error('Failed to load service providers:', providersError);
      setEngagementError("Couldn't load available professionals.");
      setProvidersByRole({ lawyer: [], valuer: [], surveyor: [] });
    } else {
      const providerIds = providerRecords?.map((provider) => provider.user_id) || [];

      const { data: profiles, error: profilesError } = providerIds.length
        ? await supabase
            .schema('marketplace')
            .from('profiles')
            .select('id, full_name')
            .in('id', providerIds)
        : { data: [], error: null };

      if (profilesError) {
        console.error('Failed to load provider names:', profilesError);
      }

      const namesById = new Map(
        (profiles || []).map((profile) => [profile.id, profile.full_name])
      );

      const groupedProviders = {
        lawyer: [],
        valuer: [],
        surveyor: [],
      };

      (providerRecords || []).forEach((provider) => {
        groupedProviders[provider.provider_type]?.push({
          id: provider.user_id,
          name: namesById.get(provider.user_id) || 'Verified professional',
          license: provider.license_number,
          rating: Number(provider.rating_avg || 0),
          bio: provider.bio || 'Verified service provider.',
        });
      });

      setProvidersByRole(groupedProviders);
    }

    if (engagementsError) {
      console.error('Failed to load engagements:', engagementsError);
      setEngagementError("Couldn't load saved professional engagements.");
    } else {
      setEngaged(() => {
        const savedEngagements = {
          lawyer: null,
          valuer: null,
          surveyor: null,
        };

        (engagementRecords || []).forEach((engagement) => {
          if (engagement.task_key in savedEngagements) {
            savedEngagements[engagement.task_key] = engagement.provider_id;
          }
        });

        return savedEngagements;
      });
    }

    setProvidersLoading(false);
  }, [buyerId, listing?.id, transactionId]);

  useEffect(() => {
    loadStageData();
  }, [loadStageData]);

  async function handleSendInquiry(event) {
    event.preventDefault();

    if (!inquiryMessage.trim() || inquirySending || !counterpartId) return;

    setInquirySending(true);
    setInquiryError('');

    try {
      const id =
        conversationId ||
        (await findOrCreateConversation(
          supabase,
          buyerId,
          counterpartId,
          listing?.id
        ));

      await sendTextMessage(supabase, id, buyerId, inquiryMessage.trim());

      setConversationId(id);
      setInquiryStatus('sent');
      setInquiryMessage('');
    } catch (error) {
      console.error('Failed to send inquiry:', error);
      setInquiryError("Couldn't send your inquiry — try again.");
    }

    setInquirySending(false);
  }

  function toggleProposedSlot(slot) {
    setProposedSlots((previous) =>
      previous.some((selectedSlotItem) => selectedSlotItem.start === slot.start)
        ? previous.filter(
            (selectedSlotItem) => selectedSlotItem.start !== slot.start
          )
        : [...previous, slot]
    );
  }

  async function handleRequestVisit() {
    if (!proposedSlots.length || visitSaving) return;

    setVisitSaving(true);
    setVisitError('');

    const rows = proposedSlots.map((slot) => ({
      transaction_id: transactionId,
      buyer_id: buyerId,
      listing_id: listing.id,
      preferred_at: slot.start,
      status: 'pending',
    }));

    const { data, error } = await supabase
      .schema('marketplace')
      .from('viewing_requests')
      .insert(rows)
      .select('id, preferred_at');

    if (error) {
      console.error('Failed to request site visit:', error);
      setVisitError("Couldn't save your visit request. Please try again.");
      setVisitSaving(false);
      return;
    }

    setProposedSlots(
      (data || []).map((request) => ({
        id: request.id,
        start: request.preferred_at,
        label: formatSlot(request.preferred_at),
      }))
    );
    setVisitStatus('requested');
    setVisitSaving(false);
  }

  async function handleConfirmVisit(slot) {
    if (!slot.id || visitSaving) return;

    setVisitSaving(true);
    setVisitError('');

    const now = new Date().toISOString();

    const { error: confirmError } = await supabase
      .schema('marketplace')
      .from('viewing_requests')
      .update({
        status: 'confirmed',
        scheduled_for: slot.start,
        responded_at: now,
      })
      .eq('id', slot.id);

    if (confirmError) {
      console.error('Failed to confirm site visit:', confirmError);
      setVisitError("Couldn't confirm this visit. Please try again.");
      setVisitSaving(false);
      return;
    }

    // Close the buyer's other proposed times after one is confirmed.
    await supabase
      .schema('marketplace')
      .from('viewing_requests')
      .update({
        status: 'declined',
        responded_at: now,
      })
      .eq('transaction_id', transactionId)
      .eq('buyer_id', buyerId)
      .eq('listing_id', listing.id)
      .eq('status', 'pending')
      .neq('id', slot.id);

    setConfirmedSlot(slot);
    setVisitStatus('confirmed');
    setVisitSaving(false);
  }

  async function handleEngage() {
    if (!selectedProviderId || engagementSaving) return;
    if (activeRole.mode === 'schedule' && !selectedSlot) return;

    setEngagementSaving(true);
    setEngagementError('');

    const { error } = await supabase
      .schema('marketplace')
      .from('transaction_provider_engagements')
      .upsert(
        {
          transaction_id: transactionId,
          task_key: activeRoleKey,
          provider_id: selectedProviderId,
          engaged_by: viewerId,
          appointment_at: selectedSlot?.start || null,
        },
        {
          onConflict: 'transaction_id,task_key',
        }
      );

    if (error) {
      console.error('Failed to save professional engagement:', error);
      setEngagementError(
        `Couldn't engage this ${activeRole.label.toLowerCase()}. Please try again.`
      );
      setEngagementSaving(false);
      return;
    }

    setEngaged((previous) => ({
      ...previous,
      [activeRoleKey]: selectedProviderId,
    }));
    setSelectedProviderId(null);
    setSelectedSlot(null);

    const next = PRO_ROLES.find(
      (role) => role.key !== activeRoleKey && !engaged[role.key]
    );

    if (next) {
      setActiveRoleKey(next.key);
    }

    setEngagementSaving(false);
  }

  const allProsEngaged = PRO_ROLES.every((role) => engaged[role.key]);
  const stageComplete =
    inquiryStatus === 'sent' &&
    visitStatus === 'confirmed' &&
    allProsEngaged;

  useEffect(() => {
    if (!stageComplete) return;

    async function advanceTransaction() {
      const { error } = await supabase
        .schema('marketplace')
        .from('transactions')
        .update({
          stage: 'negotiate',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      if (error) {
        console.error('Failed to advance transaction stage:', error);
        setEngagementError(
          "Your tasks are complete, but we couldn't move the purchase to Negotiation."
        );
        return;
      }

      onAdvanceStage?.('negotiation');
    }

    advanceTransaction();
  }, [stageComplete, transactionId, onAdvanceStage]);

  const substeps = [
    {
      key: 'inquiry',
      label: 'Inquiry',
      status: inquiryStatus === 'sent' ? 'done' : 'active',
    },
    {
      key: 'visit',
      label: 'Site visit',
      status:
        visitStatus === 'confirmed'
          ? 'done'
          : inquiryStatus === 'sent'
            ? 'active'
            : 'upcoming',
    },
    {
      key: 'pros',
      label: 'Engage pros',
      status:
        allProsEngaged
          ? 'done'
          : visitStatus === 'confirmed'
            ? 'active'
            : 'upcoming',
    },
  ];

  const activeProviders = providersByRole[activeRoleKey] || [];
  const engagedProvider = activeProviders.find(
    (provider) => provider.id === engaged[activeRoleKey]
  );

  return (
    <StageWindow
      stageNumber={1}
      title="Connect"
      subtitle={`Reach out on ${listing?.title || 'this listing'}, book a site visit, and bring in your lawyer, valuer, and surveyor.`}
      isComplete={stageComplete}
      clearedTitle="Connect stage cleared"
      clearedSubtitle="Moving to Negotiation."
      messagesSlot={
        counterpartId ? (
          <ConversationThread
            viewerId={viewerId}
            viewerName={viewerName}
            otherUserId={counterpartId}
            otherUserName={counterpartName}
            listingId={listing?.id}
            conversationId={conversationId}
            onConversationReady={setConversationId}
          />
        ) : null
      }
    >
      <StageSubsteps steps={substeps} />

      <section className="stage1-section">
        <h3 className="stage1-section-title">1. Send an inquiry</h3>

        {inquiryStatus === 'checking' ? (
          <p className="stage-empty">Checking…</p>
        ) : inquiryStatus === 'sent' ? (
          <p className="stage-pill stage-pill--verified">Inquiry sent</p>
        ) : isBuyer ? (
          <form onSubmit={handleSendInquiry} className="stage1-inquiry-form">
            <div className="stage-field">
              <label htmlFor="inquiry-msg">Message to the seller/agent</label>
              <textarea
                id="inquiry-msg"
                rows={3}
                value={inquiryMessage}
                onChange={(event) => setInquiryMessage(event.target.value)}
                placeholder="I'm interested in this property and would like to know more…"
              />
            </div>

            {inquiryError && (
              <p className="messaging-attach-error">{inquiryError}</p>
            )}

            <button
              type="submit"
              className="stage-btn stage-btn--primary"
              disabled={!inquiryMessage.trim() || inquirySending}
            >
              {inquirySending ? 'Sending…' : 'Send inquiry'}
            </button>
          </form>
        ) : (
          <p className="stage-empty">
            Waiting on the buyer to send an inquiry.
          </p>
        )}
      </section>

      <hr className="stage-divider" />

      <section className="stage1-section">
        <h3 className="stage1-section-title">2. Book a site visit</h3>

        {visitError && <p className="messaging-attach-error">{visitError}</p>}

        {visitStatus === 'loading' ? (
          <p className="stage-empty">Loading visit details…</p>
        ) : visitStatus === 'confirmed' ? (
          <p className="stage-pill stage-pill--verified">
            <Calendar size={12} /> Confirmed — {confirmedSlot?.label}
          </p>
        ) : visitStatus === 'requested' ? (
          isBuyer ? (
            <p className="stage-empty">
              Waiting on the agent to confirm one of your proposed times.
            </p>
          ) : (
            <div className="stage1-slot-confirm">
              <p className="stage1-section-hint">
                The buyer proposed these times — confirm one:
              </p>

              <div className="stage1-slot-grid">
                {proposedSlots.map((slot) => (
                  <button
                    key={slot.id || slot.start}
                    type="button"
                    className="stage1-slot-button"
                    disabled={visitSaving}
                    onClick={() => handleConfirmVisit(slot)}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : isBuyer ? (
          <div>
            <p className="stage1-section-hint">
              Pick one or more times that work for you:
            </p>

            <div className="stage1-slot-grid">
              {MOCK_SLOTS.map((slot) => {
                const selected = proposedSlots.some(
                  (selectedSlotItem) => selectedSlotItem.start === slot.start
                );

                return (
                  <button
                    key={slot.start}
                    type="button"
                    className={`stage1-slot-button${selected ? ' is-selected' : ''}`}
                    onClick={() => toggleProposedSlot(slot)}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="stage-btn stage-btn--primary"
              style={{ marginTop: 12 }}
              disabled={!proposedSlots.length || visitSaving}
              onClick={handleRequestVisit}
            >
              {visitSaving ? 'Saving…' : 'Request visit'}
            </button>
          </div>
        ) : (
          <p className="stage-empty">
            Waiting on the buyer to propose visit times.
          </p>
        )}
      </section>

      <hr className="stage-divider" />

      <section className="stage1-section">
        <h3 className="stage1-section-title">3. Engage your professionals</h3>

        {engagementError && (
          <p className="messaging-attach-error">{engagementError}</p>
        )}

        <div className="stage1-role-tabs">
          {PRO_ROLES.map((role) => (
            <button
              key={role.key}
              type="button"
              className={`stage1-role-tab${role.key === activeRoleKey ? ' is-active' : ''}${engaged[role.key] ? ' is-done' : ''}`}
              onClick={() => setActiveRoleKey(role.key)}
            >
              {engaged[role.key] ? '✓ ' : ''}
              {role.label}
            </button>
          ))}
        </div>

        {!isBuyer ? (
          <p className="stage-empty">
            Waiting on the buyer to{' '}
            {nextUnengaged
              ? `engage a ${nextUnengaged.label.toLowerCase()}`
              : 'finish engaging professionals'}
            .
          </p>
        ) : engaged[activeRoleKey] ? (
          <p className="stage-pill stage-pill--verified">
            {activeRole.label} engaged —{' '}
            {engagedProvider?.name || 'Verified professional'}
          </p>
        ) : providersLoading ? (
          <p className="stage-empty">Loading professionals…</p>
        ) : activeProviders.length === 0 ? (
          <p className="stage-empty">
            No verified {activeRole.label.toLowerCase()}s are currently
            available.
          </p>
        ) : (
          <>
            <div className="stage1-provider-grid">
              {activeProviders.map((provider) => {
                const isSelected = selectedProviderId === provider.id;

                return (
                  <div
                    key={provider.id}
                    className={`stage1-provider-card${isSelected ? ' is-selected' : ''}`}
                  >
                    <p className="stage1-provider-name">{provider.name}</p>

                    <p className="stage1-provider-meta">
                      <ShieldCheck size={12} /> {provider.license}
                      <span className="stage1-provider-dot">·</span>
                      <Star size={12} /> {provider.rating.toFixed(1)}
                    </p>

                    <p className="stage1-provider-bio">{provider.bio}</p>

                    <div className="stage1-provider-actions">
                      <button
                        type="button"
                        className="stage-btn stage-btn--ghost"
                      >
                        Message
                      </button>

                      <button
                        type="button"
                        className="stage-btn stage-btn--brass"
                        onClick={() => setSelectedProviderId(provider.id)}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedProviderId && activeRole.mode === 'schedule' && (
              <div className="stage1-slot-grid" style={{ marginTop: 12 }}>
                {MOCK_SLOTS.map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    className={`stage1-slot-button${selectedSlot?.start === slot.start ? ' is-selected' : ''}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            )}

            {selectedProviderId && (
              <button
                type="button"
                className="stage-btn stage-btn--primary"
                style={{ marginTop: 12 }}
                disabled={
                  engagementSaving ||
                  (activeRole.mode === 'schedule' && !selectedSlot)
                }
                onClick={handleEngage}
              >
                {engagementSaving
                  ? 'Saving…'
                  : activeRole.mode === 'schedule'
                    ? 'Request this slot'
                    : `Engage this ${activeRole.label.toLowerCase()}`}
              </button>
            )}
          </>
        )}
      </section>
    </StageWindow>
  );
}