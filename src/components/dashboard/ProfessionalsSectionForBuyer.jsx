import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { db } from '../../lib/supabaseClient';
import ProfessionalProfileModal from './ProfessionalProfileModalForBuyer';

// "Professionals near you" — agents, lawyers, valuers, surveyors.
// Calls marketplace.get_nearby_professionals(), which handles the
// verified-only filter and distance calc server-side. Reuses the
// .agent-card* classes already defined in dashboard.css (agent-picker
// modal) rather than introducing new ones. Clicking a card opens
// ProfessionalProfileModal with the full profile + map.

const TYPE_LABEL = {
  agent: 'Agent',
  lawyer: 'Lawyer',
  valuer: 'Valuer',
  surveyor: 'Surveyor',
};

function StarRating({ rating }) {
  const rounded = Math.round(Number(rating) || 0);
  return (
    <span className="agent-stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          fill={i < rounded ? 'currentColor' : 'none'}
          color={i < rounded ? '#c9972a' : '#cbbfc0'}
        />
      ))}
    </span>
  );
}

export default function ProfessionalsSection() {
  const [pros, setPros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProfessionals() {
      setLoading(true);
      const { data, error } = await db.rpc('get_nearby_professionals', {
        radius_km: 50,
        result_limit: 6,
      });

      if (!isMounted) return;

      if (error) {
        console.error('Failed to load nearby professionals:', error);
        setError(error);
      } else {
        setPros(data || []);
      }
      setLoading(false);
    }

    loadProfessionals();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <p className="list-empty">Loading…</p>;
  }

  if (error) {
    return <p className="list-empty">Couldn't load nearby professionals.</p>;
  }

  if (pros.length === 0) {
    return <p className="list-empty">No verified professionals found near you yet.</p>;
  }

  return (
    <>
      <div className="professionals-grid">
        {pros.map((pro) => (
          <div
            key={pro.professional_id}
            className="agent-card"
            onClick={() => setSelectedId(pro.professional_id)}
          >
            {pro.avatar_url ? (
              <img className="agent-card-avatar" src={pro.avatar_url} alt={pro.full_name} />
            ) : (
              <div className="agent-card-avatar agent-card-avatar--placeholder" />
            )}
            <div className="agent-card-info">
              <p className="agent-card-name">{pro.full_name}</p>
              <p className="agent-card-agency">
                {pro.organization || TYPE_LABEL[pro.professional_type] || pro.professional_type}
              </p>
              <div className="agent-card-meta">
                <StarRating rating={pro.rating_avg} />
                {pro.rating_avg != null && (
                  <span>{Number(pro.rating_avg).toFixed(1)}</span>
                )}
              </div>
              {pro.distance_km != null && (
                <p className="agent-card-distance">{pro.distance_km.toFixed(1)} km away</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedId && (
        <ProfessionalProfileModal
          professionalId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}