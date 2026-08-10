import { useEffect, useState } from 'react';
import { fetchRepresentatives, requestRepresentation, fetchListingRequests } from '../../api/listingRequests';
import RepresentativeProfilePanel from './RepresentativeProfilePanel';
import './ListingRepresentationPicker.css';

const ROLE_COPY = {
  agent: {
    label: 'Agent',
    heading: 'Choose an agent',
    sub: 'They can manage inquiries and update this listing on your behalf.',
  },
  manager: {
    label: 'Property manager',
    heading: 'Choose a property manager',
    sub: 'They can list and update this unit for you. Day-to-day management stays with you for now.',
  },
};

// listingId: required, the specific unit this request is for.
// onClose(): called when the modal should dismiss.
// onRequested(record, role): called after a request is successfully sent.
export default function ListingRepresentationPicker({ listingId, onClose, onRequested }) {
  const [role, setRole] = useState('agent');
  const [candidates, setCandidates] = useState([]);
  const [existingRequests, setExistingRequests] = useState({ agent: [], manager: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestingId, setRequestingId] = useState(null);

  // Profile panel opened by clicking a card. Stores which candidate + role
  // so the panel knows what to fetch.
  const [viewingProfile, setViewingProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchRepresentatives(role), fetchListingRequests(listingId)])
      .then(([reps, requests]) => {
        if (cancelled) return;
        setCandidates(reps);
        setExistingRequests(requests);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load candidates.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [role, listingId]);

  function statusFor(profileId) {
    const list = existingRequests[role] || [];
    const match = list.find((r) => r.agent_id === profileId || r.manager_id === profileId);
    return match?.status ?? null;
  }

  async function handleRequest(profileId) {
    setRequestingId(profileId);
    setError(null);
    try {
      const record = await requestRepresentation(listingId, profileId, role);
      setExistingRequests((prev) => ({
        ...prev,
        [role]: [...(prev[role] || []), record],
      }));
      onRequested?.(record, role);
    } catch (err) {
      setError(err.message || 'Could not send request.');
    } finally {
      setRequestingId(null);
    }
  }

  const copy = ROLE_COPY[role];

  return (
    <div className="rep-picker-overlay" role="dialog" aria-modal="true" aria-label={copy.heading}>
      <div className="rep-picker">
        <header className="rep-picker__header">
          <div>
            <h2>{copy.heading}</h2>
            <p>{copy.sub}</p>
          </div>
          <button type="button" className="rep-picker__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>

        <div className="rep-picker__tabs" role="tablist">
          {Object.entries(ROLE_COPY).map(([key, { label }]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={role === key}
              className={`rep-picker__tab${role === key ? ' rep-picker__tab--active' : ''}`}
              onClick={() => setRole(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <p className="rep-picker__error">{error}</p>}

        {loading ? (
          <p className="rep-picker__status">Loading {copy.label.toLowerCase()}s…</p>
        ) : candidates.length === 0 ? (
          <p className="rep-picker__status">No verified {copy.label.toLowerCase()}s found yet.</p>
        ) : (
          <ul className="rep-picker__list">
            {candidates.map((c) => {
              const status = statusFor(c.profile_id);
              return (
                <li
                  key={c.id}
                  className="rep-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewingProfile({ userId: c.profile_id, role })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setViewingProfile({ userId: c.profile_id, role });
                    }
                  }}
                >
                  <img
                    className="rep-card__avatar"
                    src={c.profiles?.avatar_url || '/avatar-placeholder.png'}
                    alt=""
                  />
                  <div className="rep-card__body">
                    <div className="rep-card__name">{c.profiles?.full_name || 'Unnamed'}</div>
                    {c.license_number && <div className="rep-card__meta">License {c.license_number}</div>}
                    {typeof c.rating === 'number' && <div className="rep-card__meta">★ {c.rating.toFixed(1)}</div>}
                    {c.bio && <p className="rep-card__bio">{c.bio}</p>}
                  </div>
                  <div className="rep-card__action">
                    {status ? (
                      <span className={`rep-card__badge rep-card__badge--${status}`}>
                        {status === 'requested' ? 'Requested' : status}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="rep-card__request-btn"
                        disabled={requestingId === c.profile_id}
                        onClick={(e) => {
                          e.stopPropagation(); // don't also open the profile panel
                          handleRequest(c.profile_id);
                        }}
                      >
                        {requestingId === c.profile_id ? 'Sending…' : 'Request'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {viewingProfile && (
        <RepresentativeProfilePanel
          userId={viewingProfile.userId}
          role={viewingProfile.role}
          onClose={() => setViewingProfile(null)}
        />
      )}
    </div>
  );
}