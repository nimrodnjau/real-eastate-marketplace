import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROLES } from '../components/RoleSelector';
import '../styles/landing.css';

const HERO_IMAGES = [
  '/src/assets/image.png',
  '/src/assets/image2.png',
  '/src/assets/image1.png',
];

const HERO_INTERVAL_MS = 6000;

const PROPERTY_TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'rentals', label: 'Rentals' },
  { value: 'apartment', label: 'Apartments' },
  { value: 'house', label: 'Houses' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Offices' },
];

const FILTER_DESCRIPTIONS = {
  all: 'Browse every verified property currently available on the marketplace.',
  rentals: 'Explore homes, apartments, and spaces available to rent.',
  apartment: 'View verified apartments available on the marketplace.',
  house: 'Browse houses available for sale or rent.',
  land: 'Find plots and land opportunities for your next investment.',
  commercial: 'Explore offices and commercial spaces for your business.',
};

const ROLE_PURPOSES = {
  buyer:
    'Browse verified properties, make offers, track documents, and complete payments securely through escrow.',
  seller:
    'List and manage properties, receive verified offers, and follow the sale from marketing to closing.',
  agent:
    'Market client properties, manage enquiries and offers, and coordinate transactions with verified professionals.',
  landlord:
    'Advertise rental properties, manage tenants, receive rent records, and work with property managers.',
  tenant:
    'Find suitable rental homes, contact verified landlords or agents, and manage tenancy details in one place.',
  lawyer:
    'Review legal documents, guide clients through transfers, and help ensure each transaction closes correctly.',
  valuer:
    'Provide property valuations that help buyers, sellers, banks, and agents make informed decisions.',
  surveyor:
    'Inspect land and property boundaries, prepare reports, and support safe property transactions.',
  bank:
    'Review finance requests, support verified transactions, and coordinate mortgage or lending requirements.',
  property_manager:
    'Manage properties for owners, oversee tenants, maintenance, rent, and occupancy.',
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [heroIndex, setHeroIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyType, setPropertyType] = useState('all');
  const [selectedRole, setSelectedRole] = useState(null);
  const [hoveredFilter, setHoveredFilter] = useState(null);

  useEffect(() => {
    if (HERO_IMAGES.length < 2) return undefined;

    const intervalId = setInterval(() => {
      setHeroIndex((index) => (index + 1) % HERO_IMAGES.length);
    }, HERO_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedRole(null);
        setHoveredFilter(null);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const goToSignup = (role) => {
    navigate(role ? `/signup?role=${role}` : '/signup');
  };

  const getListingsPath = (type = propertyType) => {
    const params = new URLSearchParams();

    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    }

    if (type !== 'all') {
      params.set('type', type);
    }

    const queryString = params.toString();
    return `/listings${queryString ? `?${queryString}` : ''}`;
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    navigate(getListingsPath());
  };

  const getRolePurpose = (role) => {
    return (
      ROLE_PURPOSES[role.value] ||
      role.desc ||
      `${role.label} has a dedicated role in helping property transactions run safely and smoothly.`
    );
  };

  return (
    <div className="landing-shell">
      <header className="landing-topbar">
        <div className="landing-topbar-inner">
          <span className="landing-mark">Marketplace</span>

          <nav className="landing-topnav" aria-label="Primary">
            <a href="#roles">Who it&apos;s for</a>
            <a href="#trust">Verification</a>
            <a href="#professionals">Professionals</a>
          </nav>

          <div className="landing-topbar-actions">
            <Link className="landing-btn landing-btn--ghost" to="/login">
              Log in
            </Link>
            <Link className="landing-btn landing-btn--solid" to="/signup">
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-photos" aria-hidden="true">
          {HERO_IMAGES.map((src, index) => (
            <div
              key={src}
              className="landing-hero-photo"
              style={{
                backgroundImage: `url(${src})`,
                opacity: index === heroIndex ? 1 : 0,
              }}
            />
          ))}
        </div>

        <div className="landing-hero-overlay" aria-hidden="true" />

        <div className="landing-hero-inner">
          <p className="landing-eyebrow">
            Every side of the transaction, one platform
          </p>

          <h1 className="landing-hero-title">
            Buy, sell, let, and close &mdash; with everyone you need already
            on the platform.
          </h1>

          <p className="landing-hero-sub">
            Buyers, sellers, agents, lawyers, valuers, surveyors, banks,
            landlords, property managers, and tenants, working from one
            verified record of the deal.
          </p>

          <form className="landing-hero-search" onSubmit={handleSearchSubmit}>
            <fieldset
              className="landing-search-types"
              style={{ position: 'relative', zIndex: 20 }}
            >
              <legend className="sr-only">Filter by property type</legend>

              {PROPERTY_TYPE_FILTERS.map((option) => {
                const isDropdownOpen = hoveredFilter === option.value;

                return (
                  <div
                    key={option.value}
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                    }}
                    onMouseEnter={() => setHoveredFilter(option.value)}
                    onMouseLeave={() => setHoveredFilter(null)}
                    onFocus={() => setHoveredFilter(option.value)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setHoveredFilter(null);
                      }
                    }}
                  >
                    <label
                      className={`landing-search-type${
                        propertyType === option.value
                          ? ' landing-search-type--active'
                          : ''
                      }`}
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

                    {isDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 12px)',
                          left: '50%',
                          zIndex: 100,
                          width: '250px',
                          padding: '16px',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          borderRadius: '14px',
                          backgroundColor: 'rgba(17, 31, 43, 0.98)',
                          color: '#ffffff',
                          boxShadow: '0 18px 40px rgba(0, 0, 0, 0.3)',
                          transform: 'translateX(-50%)',
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            marginBottom: '7px',
                            fontWeight: 700,
                          }}
                        >
                          {option.label} listings
                        </span>

                        <p
                          style={{
                            margin: '0 0 14px',
                            color: 'rgba(255, 255, 255, 0.78)',
                            fontSize: '0.86rem',
                            lineHeight: 1.45,
                          }}
                        >
                          {FILTER_DESCRIPTIONS[option.value]}
                        </p>

                        <Link
                          to={getListingsPath(option.value)}
                          onClick={() => {
                            setPropertyType(option.value);
                            setHoveredFilter(null);
                          }}
                          style={{
                            display: 'block',
                            padding: '11px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#ffffff',
                            color: '#17212b',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            textAlign: 'center',
                            textDecoration: 'none',
                          }}
                        >
                          View {option.label.toLowerCase()} listings &rarr;
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </fieldset>

            <div className="landing-search-bar">
              <input
                type="text"
                className="landing-search-input"
                placeholder="Search by town, city, or address..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Search listings"
              />

              <button type="submit" className="landing-search-submit">
                Search listings
              </button>
            </div>
          </form>

          <p className="landing-hero-footnote">
            Verified agents &middot; Escrow-backed &middot; Licensed
            professionals
          </p>
        </div>
      </section>

      <section className="landing-roles" id="roles">
        <div className="landing-roles-inner">
          <h2 className="landing-section-title">
            Built around ten kinds of people, not one
          </h2>

          <p className="landing-section-sub">
            Click a role to understand its purpose on the platform.
          </p>

          <div className="landing-role-grid">
            {ROLES.map((role) => (
              <button
                key={role.value}
                type="button"
                className="landing-role-card"
                onClick={() => setSelectedRole(role)}
                aria-haspopup="dialog"
              >
                <span className="landing-role-label">{role.label}</span>
                <span className="landing-role-desc">{role.desc}</span>
                <span className="landing-role-arrow" aria-hidden="true">
                  &rarr;
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-trust" id="trust">
        <div className="landing-trust-inner">
          <div className="landing-trust-copy">
            <h2 className="landing-section-title landing-section-title--light">
              Verification isn&apos;t a badge here &mdash; it&apos;s a gate
            </h2>
            <p>
              Agents, lawyers, valuers, surveyors, and banks carry credentials
              checked before they can act on the platform.
            </p>
          </div>

          <div className="landing-trust-grid">
            <div className="landing-trust-item">
              <span className="landing-trust-num">01</span>
              <p>Credentials are submitted and reviewed before verification.</p>
            </div>
            <div className="landing-trust-item">
              <span className="landing-trust-num">02</span>
              <p>Every listing has a complete review trail.</p>
            </div>
            <div className="landing-trust-item">
              <span className="landing-trust-num">03</span>
              <p>Funds move through escrow, not directly between parties.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-professionals" id="professionals">
        <div className="landing-professionals-inner">
          <div className="landing-pro-card landing-pro-card--dark">
            <h3>Find a verified agent</h3>
            <p>Every agent is checked before they can list a property.</p>
            <Link className="landing-pro-link" to="/signup">
              Get started &rarr;
            </Link>
          </div>

          <div className="landing-pro-card landing-pro-card--light">
            <h3>Legal &amp; survey partners</h3>
            <p>Connect with lawyers, valuers, and surveyors directly.</p>
            <Link className="landing-pro-link" to="/signup">
              Get started &rarr;
            </Link>
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

      {selectedRole && (
        <div
          role="presentation"
          onClick={() => setSelectedRole(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-modal-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'relative',
              width: 'min(100%, 540px)',
              borderRadius: '18px',
              padding: '32px',
              backgroundColor: '#ffffff',
              color: '#17212b',
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.35)',
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedRole(null)}
              aria-label="Close role details"
              style={{
                position: 'absolute',
                top: '10px',
                right: '16px',
                border: 0,
                background: 'transparent',
                color: '#17212b',
                cursor: 'pointer',
                fontSize: '32px',
                lineHeight: 1,
              }}
            >
              &times;
            </button>

            <p
              style={{
                margin: '0 0 8px',
                color: '#527067',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              PLATFORM ROLE
            </p>

            <h2 id="role-modal-title" style={{ margin: '0 0 16px' }}>
              {selectedRole.label}
            </h2>

            <p style={{ margin: 0, lineHeight: 1.65 }}>
              {getRolePurpose(selectedRole)}
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                marginTop: '28px',
              }}
            >
              <button
                type="button"
                className="landing-btn landing-btn--ghost"
                onClick={() => setSelectedRole(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="landing-btn landing-btn--solid"
                onClick={() => goToSignup(selectedRole.value)}
              >
                Sign up as {selectedRole.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}