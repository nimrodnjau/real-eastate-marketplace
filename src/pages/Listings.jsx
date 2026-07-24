import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/supabaseClient';
import ListingsMap from '../components/ListingsMap';
import CountrySelect from '../components/CountrySelect';
import PublicListingCard from '../components/PublicListingCard';
import '../styles/listings.css';

export default function Listings() {
  const { profile } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Defaults to whatever country the user picked at signup. ProtectedRoute
  // guarantees `profile` is already loaded by the time this page renders.
  const [filters, setFilters] = useState({
    search: '',
    country: profile?.country || '',
    minPrice: '',
    maxPrice: '',
  });

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    async function fetchProperties() {
      setLoading(true);

      let query = db
        .schema('marketplace')
        .from('listings')
        .select(`
          id, title, description, property_type, price, address, country, status,
          location_lat, location_lng, images,agent_id,
          bedrooms, bathrooms, parking, size_value, size_unit
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (filters.search.trim()) {
        // Matches against title OR address
        query = query.or(`title.ilike.%${filters.search}%,address.ilike.%${filters.search}%`);
      }
      if (filters.country.trim()) {
        query = query.ilike('country', `%${filters.country}%`);
      }
      if (filters.minPrice) {
        query = query.gte('price', Number(filters.minPrice));
      }
      if (filters.maxPrice) {
        query = query.lte('price', Number(filters.maxPrice));
      }

      const { data, error } = await query;

      if (error) {
        setError(error.message);
      } else {
        setProperties(data);
      }
      setLoading(false);
    }

    // Debounce so we're not firing a query on every keystroke
    const timeout = setTimeout(fetchProperties, 400);
    return () => clearTimeout(timeout);
  }, [filters]);

  return (
    <div className="listings-page">
      <header className="listings-header">
        <button type="button" className="listings-back" onClick={() => navigate(-1)}>&larr; Back</button>
        <h1>Available properties</h1>
      </header>

      <div className="listings-filters">
        <input
          type="text"
          placeholder="Search by title or address..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="listings-filter-input listings-filter-search"
        />
        <CountrySelect
          id="listings-country-filter"
          value={filters.country}
          onChange={(val) => updateFilter('country', val)}
          allowClear
          clearLabel="All countries"
          className="listings-filter-country country-select-wrap--inline"
        />
        <input
          type="number"
          placeholder="Min price"
          value={filters.minPrice}
          onChange={(e) => updateFilter('minPrice', e.target.value)}
          className="listings-filter-input listings-filter-price"
        />
        <input
          type="number"
          placeholder="Max price"
          value={filters.maxPrice}
          onChange={(e) => updateFilter('maxPrice', e.target.value)}
          className="listings-filter-input listings-filter-price"
        />
      </div>

      {loading ? (
        <div className="listings-state">Loading listings...</div>
      ) : error ? (
        <div className="listings-state listings-error">Couldn't load listings: {error}</div>
      ) : (
        <div className="listings-split">
          <div className="listings-col">
            {properties.length === 0 ? (
              <p className="listings-empty">No listings match your filters.</p>
            ) : (
              <div className="public-listings-grid">
                {properties.map((property) => (
                  <PublicListingCard
                    key={property.id}
                    listing={property}
                    onClick={() => navigate(`/listings/${property.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="listings-map-col">
            <ListingsMap properties={properties} />
          </div>
        </div>
      )}
    </div>
  );
}