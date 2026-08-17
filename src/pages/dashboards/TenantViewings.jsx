// src/pages/dashboards/TenantViewings.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { Calendar, Clock, ArrowLeft, MapPin } from 'lucide-react';
import '../../styles/tenant-dashboard.css';

export default function TenantViewings() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [viewings, setViewings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchViewings = async () => {
      try {
        const { data } = await supabase
          .schema('marketplace')
          .from('viewing_requests')
          .select(`
            *,
            listings:listing_id (
              id,
              title,
              address,
              images
            )
          `)
          .eq('buyer_id', profile.id)
          .order('requested_at', { ascending: false });

        setViewings(data || []);
      } catch (error) {
        console.error('Error fetching viewings:', error);
      } finally {
        setLoading(false);
      }
    };

    if (profile?.id) {
      fetchViewings();
    }
  }, [profile.id]);

  const formatDate = (date) => {
    if (!date) return 'Not scheduled';
    return new Date(date).toLocaleDateString('en-KE', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Pending', class: 'badge-pending' },
      confirmed: { label: 'Confirmed', class: 'badge-confirmed' },
      declined: { label: 'Declined', class: 'badge-declined' },
      completed: { label: 'Completed', class: 'badge-completed' }
    };
    return badges[status] || badges.pending;
  };

  if (loading) {
    return <div className="tenant-page-loading">Loading your viewings...</div>;
  }

  return (
    <div className="tenant-page">
      <button className="back-btn" onClick={() => navigate('/dashboard')}>
        <ArrowLeft size={18} /> Back to Dashboard
      </button>

      <div className="tenant-page-header">
        <h1><Calendar size={24} /> Viewing Requests</h1>
        <p>{viewings.length} viewing requests</p>
      </div>

      {viewings.length === 0 ? (
        <div className="tenant-empty-state">
          <Calendar size={48} />
          <p>No viewing requests yet</p>
          <button className="browse-btn" onClick={() => navigate('/listings')}>
            Find Properties
          </button>
        </div>
      ) : (
        <div className="tenant-list">
          {viewings.map(viewing => {
            const status = getStatusBadge(viewing.status);
            return (
              <div key={viewing.id} className={`tenant-list-item status-${viewing.status}`}>
                <div className="tenant-list-item-left">
                  <img 
                    src={viewing.listings?.images?.[0]?.url || 'https://placehold.co/80x80?text=🏠'} 
                    alt={viewing.listings?.title}
                    onClick={() => navigate(`/listings/${viewing.listing_id}`)}
                    className="tenant-list-item-image"
                  />
                </div>
                <div className="tenant-list-item-content">
                  <h3 onClick={() => navigate(`/listings/${viewing.listing_id}`)}>
                    {viewing.listings?.title || 'Property'}
                  </h3>
                  <p className="tenant-list-item-address">
                    <MapPin size={14} /> {viewing.listings?.address || 'No address'}
                  </p>
                  <div className="tenant-list-item-details">
                    <span><Calendar size={14} /> {formatDate(viewing.scheduled_for || viewing.preferred_at)}</span>
                  </div>
                  {viewing.message && (
                    <p className="tenant-list-item-message">"{viewing.message}"</p>
                  )}
                  <span className={`tenant-badge ${status.class}`}>
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}