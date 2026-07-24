// components/dashboard/AgentProfileModal.jsx
import { useState, useEffect } from 'react';
import { X, Star, Building2, Globe, Phone, Mail, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/AgentProfileModal.css';

function Stars({ rating }) {
  const full = Math.round(rating || 0);
  return (
    <span className="agent-stars" aria-label={`${rating ? rating.toFixed(1) : 'No'} rating`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={15} fill={i < full ? '#c9942f' : 'none'} color={i < full ? '#c9942f' : '#c9c2c2'} />
      ))}
    </span>
  );
}

function memberSince(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
}

export default function AgentProfileModal({ agent, onClose, onSelect }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .schema('marketplace')
        .from('listings')
        .select('id, title, price, property_type, images')
        .eq('agent_id', agent.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(6);

      if (!cancelled) {
        if (error) console.error('Failed to load agent listings:', error);
        setListings(data || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [agent.id]);

  return (
    <div className="agent-profile-overlay" onClick={onClose}>
      <div className="agent-profile-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="agent-profile-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="agent-profile-hero">
          <img
            className="agent-profile-avatar"
            src={agent.avatar_url || 'https://placehold.co/160x160?text=%20'}
            alt=""
          />
          <div>
            <h2 className="agent-profile-name">{agent.full_name || 'Agent'}</h2>
            {agent.agency_name && (
              <p className="agent-profile-agency"><Building2 size={14} />{agent.agency_name}</p>
            )}
            <div className="agent-profile-rating">
              <Stars rating={agent.rating_avg} />
              <span>{agent.rating_avg ? agent.rating_avg.toFixed(1) : 'No rating'} · {agent.rating_count || 0} reviews</span>
            </div>
          </div>
        </div>

        <div className="agent-profile-stats">
          <div className="agent-profile-stat">
            <p className="agent-profile-stat-value">{agent.sales_count ?? 0}</p>
            <p className="agent-profile-stat-label">Properties sold</p>
          </div>
          <div className="agent-profile-stat">
            <p className="agent-profile-stat-value">{listings.length}</p>
            <p className="agent-profile-stat-label">Active listings</p>
          </div>
          {agent.distanceKm != null && (
            <div className="agent-profile-stat">
              <p className="agent-profile-stat-value">{agent.distanceKm.toFixed(1)} km</p>
              <p className="agent-profile-stat-label">From you</p>
            </div>
          )}
        </div>

        <div className="agent-profile-contact">
          {agent.phone && (
            <a className="agent-profile-contact-row" href={`tel:${agent.phone}`}>
              <Phone size={15} /> {agent.phone}
            </a>
          )}
          {agent.email && (
            <a className="agent-profile-contact-row" href={`mailto:${agent.email}`}>
              <Mail size={15} /> {agent.email}
            </a>
          )}
          {agent.website && (
            <a
              className="agent-profile-contact-row"
              href={agent.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Globe size={15} /> Visit website
            </a>
          )}
          {agent.created_at && (
            <p className="agent-profile-contact-row agent-profile-contact-row--muted">
              <Calendar size={15} /> Agent since {memberSince(agent.created_at)}
            </p>
          )}
        </div>

        <div className="agent-profile-listings">
          <p className="agent-profile-section-title">Active listings</p>
          {loading ? (
            <p className="agent-picker-empty">Loading listings…</p>
          ) : listings.length === 0 ? (
            <p className="agent-picker-empty">No active listings right now.</p>
          ) : (
            <div className="agent-profile-listing-grid">
              {listings.map((l) => (
                <div key={l.id} className="agent-profile-listing-card">
                  {l.images?.[0]?.url ? (
                    <img src={l.images[0].url} alt="" />
                  ) : (
                    <div className="agent-profile-listing-placeholder">No photo</div>
                  )}
                  <p className="agent-profile-listing-title">{l.title}</p>
                  <p className="agent-profile-listing-price">KES {Number(l.price).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="agent-profile-select-btn" onClick={() => onSelect(agent)}>
          List with {agent.full_name?.split(' ')[0] || 'this agent'}
        </button>
      </div>
    </div>
  );
}