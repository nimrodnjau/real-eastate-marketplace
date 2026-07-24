import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROLES } from '../components/RoleSelector';
import '../styles/landing.css';

// Swap these for your own licensed / free-to-use photos (see chat for
// Unsplash/Pexels/Pixabay sourcing). Keep 3-5 images — more than that and
// the crossfade interval feels slow; fewer and it feels repetitive.
const HERO_IMAGES = [
  '/src/assets/image.png',
  '/src/assets/image2.png',
  '/src/assets/image1.png',
];

const HERO_INTERVAL_MS = 6000;

// NOTE: 'rentals' has no backing column yet — marketplace.listings only
// has property_type (land/apartment/house/commercial/other), no rent-vs-
// sale distinction. This option is wired into the UI and URL param now,
// but Listings.jsx will need a matching filter (and likely a schema
// change, e.g. a listing_type enum) before it actually narrows results.
const PROPERTY_TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'rentals', label: 'Rentals' },
  { value: 'apartment', label: 'Apartments' },
  { value: 'house', label: 'Houses' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Offices' },
];

// Public marketing landing page — reached at "/". Structured like
// AuthLayout's split-screen siblings but full-width: sticky top bar, hero
// with the two entry CTAs (sign up / log in), a "role strip" that doubles
// as navigation into Signup pre-selecting a role, a trust/verification
// section, and a footer. No property search lives here — Listings is
// behind auth (see ProtectedRoute), so the hero sells the marketplace
// itself rather than search.
export default function LandingPage() {
  const navigate = useNavigate();
  const [heroIndex, setHeroIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyType, setPropertyType] = useState('all');

  useEffect(() => {
    if (HERO_IMAGES.length < 2) return; // nothing to cycle
    const id = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, HERO_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const goToSignup = (role) => {
    navigate(role ? `/signup?role=${role}` : '/signup');
  };

  // Listings is behind ProtectedRoute (see App.jsx) — a logged-out visitor
  // submitting this search will be redirected to /login first, then land
  // on /listings after auth. The query params below survive that redirect
  // as long as Login.jsx eventually navigates back to the intended
  // destination rather than hardcoding '/welcome' after sign-in.
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (propertyType !== 'all') params.set('type', propertyType);
    navigate(`/listings${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="landing-shell">
      <header className="landing-topbar">
        <div className="landing-topbar-inner">
          <span className="landing-mark">Marketplace</span>
          <nav className="landing-topnav" aria-label="Primary">
            <a href="#roles">Who it's for</a>
            <a href="#trust">Verification</a>
            <a href="#professionals">Professionals</a>
          </nav>
          <div className="landing-topbar-actions">
            <Link className="landing-btn landing-btn--ghost" to="/login">Log in</Link>
            <Link className="landing-btn landing-btn--solid" to="/signup">Sign up</Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-photos" aria-hidden="true">
          {HERO_IMAGES.map((src, i) => (
            <div
              key={src}
              className="landing-hero-photo"
              style={{
                backgroundImage: `url(${src})`,
                opacity: i === heroIndex ? 1 : 0,
              }}
            />
          ))}
        </div>
        <div className="landing-hero-overlay" aria-hidden="true" />
        <div className="landing-hero-inner">
          <p className="landing-eyebrow">Every side of the transaction, one platform</p>
          <h1 className="landing-hero-title">
            Buy, sell, let, and close &mdash; with everyone you need already on the platform.
          </h1>
          <p className="landing-hero-sub">
            Buyers, sellers, agents, lawyers, valuers, surveyors, banks, landlords, property
            managers, and tenants, working from one verified record of the deal, escrow-backed
            from offer to closing.
          </p>

          <form className="landing-hero-search" onSubmit={handleSearchSubmit}>
            <fieldset className="landing-search-types">
              <legend className="sr-only">Filter by property type</legend>
              {PROPERTY_TYPE_FILTERS.map((option) => (
                <label
                  key={option.value}
                  className={`landing-search-type${propertyType === option.value ? ' landing-search-type--active' : ''}`}
                >
                  <input
                    type="radio"
                    name="propertyType"
                    value={option.value}
                    checked={propertyType === option.value}
                    onChange={() => setPropertyType(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>

            <div className="landing-search-bar">
              <input
                type="text"
                className="landing-search-input"
                placeholder="Search by town, city, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search listings"
              />
              <button type="submit" className="landing-search-submit">
                Search listings
              </button>
            </div>
          </form>

          <p className="landing-hero-footnote">Verified agents &middot; Escrow-backed &middot; Licensed professionals</p>
        </div>
      </section>

      <section className="landing-roles" id="roles">
        <div className="landing-roles-inner">
          <h2 className="landing-section-title">Built around ten kinds of people, not one</h2>
          <p className="landing-section-sub">
            Every role below gets its own dashboard. Pick yours to start signing up &mdash;
            you can always change details later.
          </p>
          <div className="landing-role-grid">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                className="landing-role-card"
                onClick={() => goToSignup(r.value)}
              >
                <span className="landing-role-label">{r.label}</span>
                <span className="landing-role-desc">{r.desc}</span>
                <span className="landing-role-arrow" aria-hidden="true">&rarr;</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-trust" id="trust">
        <div className="landing-trust-inner">
          <div className="landing-trust-copy">
            <h2 className="landing-section-title landing-section-title--light">
              Verification isn't a badge here &mdash; it's a gate
            </h2>
            <p>
              Agents, lawyers, valuers, surveyors, and banks all carry a license or credential
              number checked before they can act on the platform. Buyers and sellers see
              verification status before they ever talk to someone.
            </p>
          </div>
          <div className="landing-trust-grid">
            <div className="landing-trust-item">
              <span className="landing-trust-num">01</span>
              <p>Credentials submitted at signup, reviewed before verified status is granted.</p>
            </div>
            <div className="landing-trust-item">
              <span className="landing-trust-num">02</span>
              <p>Every listing tracked from draft to sold, with a full review trail.</p>
            </div>
            <div className="landing-trust-item">
              <span className="landing-trust-num">03</span>
              <p>Funds move through escrow, not directly between buyer and seller.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-professionals" id="professionals">
        <div className="landing-professionals-inner">
          <div className="landing-pro-card landing-pro-card--dark">
            <h3>Find a verified agent</h3>
            <p>Every agent is checked against license records before they can list a property.</p>
            <Link className="landing-pro-link" to="/signup">Get started &rarr;</Link>
          </div>
          <div className="landing-pro-card landing-pro-card--light">
            <h3>Legal &amp; survey partners</h3>
            <p>Connect with lawyers, valuers, and surveyors directly through the platform.</p>
            <Link className="landing-pro-link" to="/signup">Get started &rarr;</Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span className="landing-mark landing-mark--footer">Marketplace</span>
          <div className="landing-footer-links">
            <Link to="/signup">Sign up</Link>
            <Link to="/login">Log in</Link>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}