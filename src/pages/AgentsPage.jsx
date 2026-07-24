import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StampIcon } from '../components/dashboard/icons';
import '../styles/agents.css';

// Placeholder data — swap this for a real fetch (Supabase table, API, etc.)
// once the backend is ready. Keep the shape (id, name, agency, region,
// listings, verifiedSince) the same so AgentsPage doesn't need rework.
const mockAgents = [
  { id: 1, name: 'Grace Mwangi', agency: 'Kilimani Realty', region: 'Nairobi', listings: 18, verifiedSince: '2023' },
  { id: 2, name: 'Brian Otieno', agency: 'Lakeview Properties', region: 'Kisumu', listings: 9, verifiedSince: '2024' },
  { id: 3, name: 'Amina Hassan', agency: 'Coastal Homes Ltd', region: 'Mombasa', listings: 24, verifiedSince: '2022' },
  { id: 4, name: 'Peter Kamau', agency: 'Highlands Estate Agents', region: 'Nakuru', listings: 12, verifiedSince: '2023' },
  { id: 5, name: 'Faith Chebet', agency: 'Rift Valley Realty', region: 'Eldoret', listings: 7, verifiedSince: '2024' },
  { id: 6, name: 'Daniel Njoroge', agency: 'Karen Prime Properties', region: 'Nairobi', listings: 31, verifiedSince: '2021' },
];

function initialsFor(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function AgentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('all');

  const regions = useMemo(
    () => ['all', ...new Set(mockAgents.map((a) => a.region))],
    []
  );

  const filteredAgents = useMemo(() => {
    return mockAgents.filter((a) => {
      const matchesRegion = region === 'all' || a.region === region;
      const matchesSearch =
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.agency.toLowerCase().includes(search.toLowerCase());
      return matchesRegion && matchesSearch;
    });
  }, [search, region]);

  return (
    <div className="agents-shell">
      <header className="agents-topnav">
        <div className="agents-brand">
          <span className="dash-brand-mark">
            <StampIcon />
          </span>
          <span>Marketplace</span>
        </div>
        <button type="button" className="agents-back" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
      </header>

      <section className="agents-hero">
        <div className="agents-hero-inner">
          <h1>Verified Agents</h1>
          <p>Every agent listed here is checked against gazette records before they can list.</p>
        </div>
      </section>

      <section className="agents-list-section">
        <div className="agents-list-inner">
          <div className="agents-filters">
            <input
              type="text"
              className="agents-search"
              placeholder="Search by name or agency"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="agents-region-select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r === 'all' ? 'All regions' : r}
                </option>
              ))}
            </select>
          </div>

          {filteredAgents.length === 0 ? (
            <p className="agents-empty">No agents match your search.</p>
          ) : (
            <div className="agents-grid">
              {filteredAgents.map((agent) => (
                <div key={agent.id} className="agent-card">
                  <div className="agent-card-top">
                    <div className="agent-avatar">{initialsFor(agent.name)}</div>
                    <span className="agent-verified-badge" title="Verified against gazette records">
                      Verified
                    </span>
                  </div>
                  <h3>{agent.name}</h3>
                  <p className="agent-agency">{agent.agency}</p>
                  <p className="agent-meta">
                    {agent.region} &middot; {agent.listings} listings &middot; verified {agent.verifiedSince}
                  </p>
                  <button type="button" className="agent-view-btn">
                    View profile
                    <span aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}