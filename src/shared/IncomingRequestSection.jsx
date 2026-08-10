import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseclient'; // ADJUST to your actual client path
import { IconCheck, IconX } from './Icons';

/*
  IncomingRequestsSection
  Requests that land here when a buyer picks this professional through
  EngageProfessionalsModule (hire_lawyer / schedule_valuer / schedule_surveyor).

  IMPORTANT - VERIFY THIS TABLE NAME:
  I don't have visibility into what table EngageProfessionalsModule actually
  writes to when a buyer selects a provider. I've named it
  `provider_engagement_requests` below as a placeholder — point this at
  whatever real table/RPC backs that selection so accepted requests here
  actually reflect on the buyer's StageTaskModule checklist. Everything else
  in this component (the list, accept/decline UI) will work unchanged once
  the table/column names match.

  Assumed columns: id, provider_id, transaction_id, task_key, client_name,
  listing_title, note, status ('pending' | 'accepted' | 'declined'), created_at.

  Props:
  - userId, roleConfig (see roleConfigs.js)
*/
export default function IncomingRequestsSection({ userId, roleConfig }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requests, setRequests] = useState([]);
  const [actingId, setActingId] = useState(null);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .schema('marketplace')
        .from('provider_engagement_requests')
        .select('*')
        .eq('provider_id', userId)
        .eq('task_key', roleConfig.taskKey)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (err) setError(err.message);
      else setRequests(data || []);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, roleConfig.taskKey]);

  async function respond(id, status) {
    setActingId(id);
    const { data, error: err } = await supabase
      .schema('marketplace')
      .from('provider_engagement_requests')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    setActingId(null);
    if (err) {
      setError(err.message);
      return;
    }
    setRequests((rows) => rows.map((r) => (r.id === id ? data : r)));
  }

  const visible = requests.filter((r) => (filter === 'all' ? true : r.status === filter));

  return (
    <div>
      <div className="pd-card-head" style={{ marginBottom: 6 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--pd-font-display)', fontSize: '1.15rem', fontWeight: 600 }}>
            Client requests
          </h2>
          <div className="pd-card-sub">New engagements from buyers who selected you.</div>
        </div>
      </div>

      <div className="pd-subtabs">
        {['pending', 'accepted', 'declined', 'all'].map((f) => (
          <button
            key={f}
            className={`pd-subtab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="pd-error">{error}</div>}

      <div className="pd-card">
        {loading ? (
          <div className="pd-loading">Loading requests…</div>
        ) : visible.length === 0 ? (
          <div className="pd-empty">
            <strong>Nothing here yet</strong>
            New requests from buyers will show up in this list.
          </div>
        ) : (
          visible.map((req) => (
            <div className="pd-list-row" key={req.id}>
              <div className="pd-list-main">
                <span className="pd-list-title">{req.client_name || 'A buyer'}</span>
                <span className="pd-list-meta">
                  {req.listing_title || 'Listing not specified'}
                  {req.note ? ` — "${req.note}"` : ''}
                </span>
              </div>
              {req.status === 'pending' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="pd-btn pd-btn-ghost pd-btn-sm"
                    onClick={() => respond(req.id, 'declined')}
                    disabled={actingId === req.id}
                  >
                    <IconX width={13} height={13} /> Decline
                  </button>
                  <button
                    className="pd-btn pd-btn-primary pd-btn-sm"
                    onClick={() => respond(req.id, 'accepted')}
                    disabled={actingId === req.id}
                  >
                    <IconCheck width={13} height={13} /> Accept
                  </button>
                </div>
              ) : (
                <span className={`pd-badge ${req.status === 'accepted' ? 'success' : 'danger'}`}>
                  {req.status}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}