import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StampIcon } from '../components/dashboard/icons';
import '../styles/professionals.css';

// Placeholder data — swap this for a real fetch (Supabase table, API, etc.)
// once the backend is ready. Keep the shape (id, name, category, firm,
// region, experienceYears, verifiedSince) the same so this page doesn't
// need rework later.
const mockProfessionals = [
  { id: 1, name: 'Wanjiru & Associates', category: 'Lawyer', firm: 'Wanjiru & Associates Advocates', region: 'Nairobi', experienceYears: 14, verifiedSince: '2022' },
  { id: 2, name: 'Samuel Kiptoo', category: 'Surveyor', firm: 'Rift Land Surveys', region: 'Eldoret', experienceYears: 9, verifiedSince: '2023' },
  { id: 3, name: 'Mercy Adhiambo', category: 'Valuer', firm: 'Lakeside Valuation Services', region: 'Kisumu', experienceYears: 11, verifiedSince: '2022' },
  { id: 4, name: 'Otieno Legal Chambers', category: 'Lawyer', firm: 'Otieno Legal Chambers', region: 'Mombasa', experienceYears: 20, verifiedSince: '2021' },
  { id: 5, name: 'Janet Mumbi', category: 'Surveyor', firm: 'Precision Land Surveys', region: 'Nairobi', experienceYears: 6, verifiedSince: '2024' },
  { id: 6, name: 'Kamau Valuations Ltd', category: 'Valuer', firm: 'Kamau Valuations Ltd', region: 'Nakuru', experienceYears: 16, verifiedSince: '2022' },
  { id: 7, name: 'Fatuma Noor', category: 'Lawyer', firm: 'Noor & Partners Advocates', region: 'Mombasa', experienceYears: 8, verifiedSince: '2023' },
  { id: 8, name: 'David Kiprono', category: 'Surveyor', firm: 'Highland Survey Consultants', region: 'Nakuru', experienceYears: 13, verifiedSince: '2021' },
];

const categories = ['all', 'Lawyer', 'Surveyor', 'Valuer'];

function initialsFor(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfessionalsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [region, setRegion] = useState('all');

  const regions = useMemo(
    () => ['all', ...new Set(mockProfessionals.map((p) => p.region))],
    []
  );

  const filteredProfessionals = useMemo(() => {
    return mockProfessionals.filter((p) => {
      const matchesCategory = category === 'all' || p.category === category;
      const matchesRegion = region === 'all' || p.region === region;
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.firm.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesRegion && matchesSearch;
    });
  }, [search, category, region]);

  return (
    <div className="pros-shell">
      <header className="pros-topnav">
        <div className="pros-brand">
          <span className="dash-brand-mark">
            <StampIcon />
          </span>
          <span>Marketplace</span>
        </div>
        <button type="button" className="pros-back" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
      </header>

      <section className="pros-hero">
        <div className="pros-hero-inner">
          <h1>Legal &amp; Survey Partners</h1>
          <p>Verified lawyers, surveyors, and valuers to support you at every stage of a property deal.</p>
        </div>
      </section>

      <section className="pros-list-section">
        <div className="pros-list-inner">
          <div className="pros-filters">
            <input
              type="text"
              className="pros-search"
              placeholder="Search by name or firm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="pros-category-tabs">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`pros-category-tab${category === c ? ' is-active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c === 'all' ? 'All' : `${c}s`}
                </button>
              ))}
            </div>
            <select
              className="pros-region-select"
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

          {filteredProfessionals.length === 0 ? (
            <p className="pros-empty">No professionals match your search.</p>
          ) : (
            <div className="pros-grid">
              {filteredProfessionals.map((pro) => (
                <div key={pro.id} className="pro-card">
                  <div className="pro-card-top">
                    <div className="pro-avatar">{initialsFor(pro.name)}</div>
                    <span className={`pro-category-badge pro-category-badge--${pro.category.toLowerCase()}`}>
                      {pro.category}
                    </span>
                  </div>
                  <h3>{pro.name}</h3>
                  <p className="pro-firm">{pro.firm}</p>
                  <p className="pro-meta">
                    {pro.region} &middot; {pro.experienceYears} yrs experience &middot; verified {pro.verifiedSince}
                  </p>
                  <button type="button" className="pro-view-btn">
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