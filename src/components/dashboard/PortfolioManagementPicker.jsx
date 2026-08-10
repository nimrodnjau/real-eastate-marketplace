// components/dashboard/PortfolioManagementPicker.jsx
import { useEffect, useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { fetchNearbyAgentsAndManagers } from '../../lib/landlordListings';
import { requestPortfolioManagement } from '../../api/landlordManagementAssignments';
import '../../styles/AgentProfileModal.css';

const RADIUS_KM = 80;

/**
 * "Hand off all my units" modal. Reuses the same nearby-agents/managers
 * lookup as the dashboard's "near you" sections, but instead of opening a
 * profile, picking someone here sends a portfolio-wide management request
 * (see api/landlordManagementAssignments.js) rather than anything tied to
 * a single listing.
 *
 * Props:
 *   landlordId  - the landlord's user id
 *   unitCount   - optional, just for the copy ("all 6 of your units")
 *   onClose     - called to dismiss the modal
 *   onRequested - called with the created assignment row on success
 */
export default function PortfolioManagementPicker({ landlordId, unitCount, onClose, onRequested }) {
  const [status, setStatus] = useState('locating'); // locating | ready | denied | error
  const [managers, setManagers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(null); // { kind, userId, name }
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!('geolocation' in navigator)) {
      setStatus('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;
        const { latitude, longitude } = position.coords;
        const { managers: nearbyManagers, agents: nearbyAgents, error } =
          await fetchNearbyAgentsAndManagers(latitude, longitude, RADIUS_KM);

        if (cancelled) return;
        if (error) {
          setStatus('error');
          return;
        }
        setManagers(nearbyManagers);
        setAgents(nearbyAgents);
        setStatus('ready');
      },
      () => {
        if (cancelled) return;
        setStatus('denied');
      },
      { timeout: 10000 }
    );

    return () => { cancelled = true; };
  }, []);

  async function handleSubmit() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const result = await requestPortfolioManagement(
      landlordId,
      selected.userId,
      selected.kind,
      message.trim() || null
    );

    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error?.message || 'Could not send this request.');
      return;
    }
    setSubmitted(true);
    onRequested?.(result.assignment);
  }

  const nothingNearby = status === 'ready' && agents.length === 0 && managers.length === 0;

  return (
    <div className="agent-profile-overlay" onClick={onClose}>
      <div className="agent-profile-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="agent-profile-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <h2 className="agent-profile-name">Hand off your units</h2>
        <p className="agent-picker-empty">
          {unitCount != null
            ? `Choose an agent or property manager to take over all ${unitCount} of your listed units.`
            : 'Choose an agent or property manager to take over all of your listed units.'}
        </p>

        {submitted ? (
          <p className="agent-picker-empty">
            Request sent to {selected?.name || 'them'}. They\u2019ll need to accept it before anything changes \u2014 you\u2019ll be notified once they respond.
          </p>
        ) : (
          <>
            {status === 'locating' && <p className="agent-picker-empty">Finding people near you\u2026</p>}
            {status === 'denied' && <p className="agent-picker-empty">Enable location access to see who\u2019s near you.</p>}
            {status === 'error' && <p className="agent-picker-empty">Couldn\u2019t load nearby people \u2014 try again.</p>}
            {nothingNearby && <p className="agent-picker-empty">No verified agents or property managers nearby yet.</p>}

            {status === 'ready' && !nothingNearby && (
              <>
                <div className="agent-profile-listing-grid">
                  {agents.map((a) => {
                    const isSelected = selected?.kind === 'agent' && selected.userId === a.user_id;
                    return (
                      <button
                        type="button"
                        key={`agent-${a.user_id}`}
                        className={`agent-profile-listing-card${isSelected ? ' agent-profile-listing-card--selected' : ''}`}
                        onClick={() => setSelected({ kind: 'agent', userId: a.user_id, name: a.agency_name || 'Agent' })}
                      >
                        <Building2 size={16} />
                        <p className="agent-profile-listing-title">{a.agency_name || 'Agent'}</p>
                        <p className="agent-profile-listing-price">{a.distanceKm.toFixed(1)} km away</p>
                      </button>
                    );
                  })}
                  {managers.map((m) => {
                    const isSelected = selected?.kind === 'manager' && selected.userId === m.user_id;
                    return (
                      <button
                        type="button"
                        key={`manager-${m.user_id}`}
                        className={`agent-profile-listing-card${isSelected ? ' agent-profile-listing-card--selected' : ''}`}
                        onClick={() => setSelected({ kind: 'manager', userId: m.user_id, name: m.company_name || 'Property manager' })}
                      >
                        <Building2 size={16} />
                        <p className="agent-profile-listing-title">{m.company_name || 'Property manager'}</p>
                        <p className="agent-profile-listing-price">{m.distanceKm.toFixed(1)} km away</p>
                      </button>
                    );
                  })}
                </div>

                <textarea
                  className="agent-picker-message-input"
                  placeholder="Add a note (optional)\u2026"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />

                {submitError && <p className="messaging-attach-error">{submitError}</p>}

                <button
                  type="button"
                  className="agent-profile-select-btn"
                  disabled={!selected || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Sending\u2026' : selected ? `Request ${selected.name}` : 'Select someone above'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}