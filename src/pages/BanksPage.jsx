import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StampIcon } from '../components/dashboard/icons';
import '../styles/banks.css';

// Placeholder data — swap this for a real fetch (Supabase table, API, etc.)
// once the backend is ready. Keep the shape (id, name, services, region,
// partnerSince) the same so this page doesn't need rework later.
const mockBanks = [
  { id: 1, name: 'Equity Bank', services: ['Mortgage', 'Asset Finance'], region: 'Nairobi', partnerSince: '2021' },
  { id: 2, name: 'KCB Bank', services: ['Mortgage', 'Escrow'], region: 'Nairobi', partnerSince: '2020' },
  { id: 3, name: 'Absa Bank Kenya', services: ['Mortgage'], region: 'Mombasa', partnerSince: '2022' },
  { id: 4, name: 'Co-operative Bank', services: ['Mortgage', 'Asset Finance', 'Escrow'], region: 'Kisumu', partnerSince: '2021' },
  { id: 5, name: 'NCBA Bank', services: ['Asset Finance'], region: 'Nakuru', partnerSince: '2023' },
  { id: 6, name: 'Stanbic Bank', services: ['Mortgage', 'Escrow'], region: 'Nairobi', partnerSince: '2022' },
];

function initialsFor(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function BanksPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('all');

  const regions = useMemo(
    () => ['all', ...new Set(mockBanks.map((b) => b.region))],
    []
  );

  const filteredBanks = useMemo(() => {
    return mockBanks.filter((b) => {
      const matchesRegion = region === 'all' || b.region === region;
      const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase());
      return matchesRegion && matchesSearch;
    });
  }, [search, region]);

  return (
    <div className="banks-shell">
      <header className="banks-topnav">
        <div className="banks-brand">
          <span className="dash-brand-mark">
            <StampIcon />
          </span>
          <span>Marketplace</span>
        </div>
        <button type="button" className="banks-back" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
      </header>

      <section className="banks-hero">
        <div className="banks-hero-inner">
          <h1>Bank &amp; Mortgage Partners</h1>
          <p>Partner banks offering mortgages, asset finance, and escrow-backed payments.</p>
        </div>
      </section>

      <section className="banks-list-section">
        <div className="banks-list-inner">
          <div className="banks-filters">
            <input
              type="text"
              className="banks-search"
              placeholder="Search by bank name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="banks-region-select"
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

          {filteredBanks.length === 0 ? (
            <p className="banks-empty">No banks match your search.</p>
          ) : (
            <div className="banks-grid">
              {filteredBanks.map((bank) => (
                <div key={bank.id} className="bank-card">
                  <div className="bank-card-top">
                    <div className="bank-avatar">{initialsFor(bank.name)}</div>
                    <span className="bank-partner-badge">Partner since {bank.partnerSince}</span>
                  </div>
                  <h3>{bank.name}</h3>
                  <p className="bank-region">{bank.region}</p>
                  <div className="bank-services">
                    {bank.services.map((s) => (
                      <span key={s} className="bank-service-tag">{s}</span>
                    ))}
                  </div>
                  <button type="button" className="bank-view-btn">
                    View details
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