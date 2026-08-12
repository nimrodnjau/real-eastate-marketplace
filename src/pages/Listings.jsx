import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/supabaseClient';
import ListingsMap from '../components/ListingsMap';
import CountrySelect from '../components/CountrySelect';
import PublicListingCard from '../components/PublicListingCard';
import ListingUnlockGate from '../components/ListingUnlockGate';
import '../styles/listings.css';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Listings() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Which listing the buyer just clicked — drives the paywall modal.
  const [pendingListingId, setPendingListingId] = useState(null);

  const [filters, setFilters] = useState(() => ({
    search: searchParams.get('search') || '',
    country: searchParams.get('country') || profile?.country || '',
    propertyType: searchParams.get('type') || '',
    minPrice: '',
    maxPrice: '',
  }));

  // Sync filters whenever the user arrives from the landing page with URL
  // parameters such as /listings?country=Kenya&type=house.
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlCountry = searchParams.get('country') || profile?.country || '';
    const urlPropertyType = searchParams.get('type') || '';

    setFilters((previous) => ({
      ...previous,
      search: urlSearch,
      country: urlCountry,
      propertyType: urlPropertyType,
    }));
  }, [searchParams, profile?.country]);

  const updateFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  useEffect(() => {
    let isCurrentRequest = true;
setLoading(true);
    async function fetchProperties() {
      
      setError(null);

      // NOTE: `description` intentionally excluded here — this is the
      // paywalled full write-up and has no reason to reach the browser
      // before a buyer has paid. Cards/map only need the preview fields.
      let query = db
        .schema('marketplace')
        .from('listings')
        .select(`
          id,
          title,
          property_type,
          price,
          address,
          country,
          status,
          location_lat,
          location_lng,
          images,
          agent_id,
          bedrooms,
          bathrooms,
          parking,
          size_value,
          size_unit
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (filters.search.trim()) {
        const safeSearch = filters.search.trim().replace(/[(),]/g, ' ');

        query = query.or(
          `title.ilike.%${safeSearch}%,address.ilike.%${safeSearch}%`
        );
      }

      if (filters.country.trim()) {
        // CountrySelect returns a complete country name, so an exact match is
        // safer and more predictable than a partial text match.
        query = query.eq('country', filters.country.trim());
      }

      // The landing page sends property type as `type`.
      // "rentals" needs a separate `listing_type` / `transaction_type` column
      // in your database before it can be filtered accurately.
      if (
        filters.propertyType &&
        filters.propertyType !== 'all' &&
        filters.propertyType !== 'rentals'
      ) {
        query = query.eq('property_type', filters.propertyType);
      }

      if (filters.minPrice) {
        query = query.gte('price', Number(filters.minPrice));
      }

      if (filters.maxPrice) {
        query = query.lte('price', Number(filters.maxPrice));
      }

      const { data, error: queryError } = await query;

      if (!isCurrentRequest) return;

      if (queryError) {
        setError('Unable to load listings right now. Please try again.');
        setProperties([]);
      } else {
        setProperties(data || []);
      }

      setLoading(false);
    }

    const timeout = window.setTimeout(fetchProperties, 400);

    return () => {
      isCurrentRequest = false;
      window.clearTimeout(timeout);
    };
  }, [filters]);

  // Single entry point for both the card grid and the map — nobody sees
  // detail without going through this gate first.
  const requestListingDetail = (listingId) => setPendingListingId(listingId);

  return (
    <div className="listings-page">
      <header className="listings-header">
        <button
          type="button"
          className="listings-back"
          onClick={() => navigate(-1)}
        >
          &larr; Back
        </button>

        <h1>Available properties</h1>
      </header>

      <div className="listings-filters">
        <input
          type="text"
          placeholder="Search by title or address..."
          value={filters.search}
          onChange={(event) => updateFilter('search', event.target.value)}
          className="listings-filter-input listings-filter-search"
          aria-label="Search properties"
        />

        <CountrySelect
          id="listings-country-filter"
          value={filters.country}
          onChange={(value) => updateFilter('country', value)}
          allowClear
          clearLabel="All countries"
          className="listings-filter-country country-select-wrap--inline"
        />

        <input
          type="number"
          min="0"
          placeholder="Min price"
          value={filters.minPrice}
          onChange={(event) => updateFilter('minPrice', event.target.value)}
          className="listings-filter-input listings-filter-price"
          aria-label="Minimum price"
        />

        <input
          type="number"
          min="0"
          placeholder="Max price"
          value={filters.maxPrice}
          onChange={(event) => updateFilter('maxPrice', event.target.value)}
          className="listings-filter-input listings-filter-price"
          aria-label="Maximum price"
        />
      </div>

      {loading ? (
        <div className="listings-state">   <LoadingSpinner message="Loading listings..." /></div>
      ) : error ? (
        <div className="listings-state listings-error">{error}</div>
      ) : (
        <div className="listings-split">
          <div className="listings-col">
            {properties.length === 0 ? (
              <p className="listings-empty">
                No listings match your filters.
              </p>
            ) : (
              <div className="public-listings-grid">
                {properties.map((property) => (
                  <PublicListingCard
                    key={property.id}
                    listing={property}
                    onClick={() => requestListingDetail(property.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="listings-map-col">
            <ListingsMap
              properties={properties}
              onMarkerClick={requestListingDetail}
            />
          </div>
        </div>
      )}

      {pendingListingId && (
        <ListingUnlockGate
          listingId={pendingListingId}
          onClose={() => setPendingListingId(null)}
          onUnlocked={() => navigate(`/listings/${pendingListingId}`)}
        />
      )}
    </div>
  );
}