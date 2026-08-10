import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StampIcon, LogOutIcon } from '../components/dashboard/icons';
import '../styles/welcome.css';

import heroImage1 from '../assets/image.png';
import heroImage2 from '../assets/image1.png';
import heroImage3 from '../assets/image2.png';

const heroImages = [heroImage1, heroImage2, heroImage3];

const GUIDES = {
  selling: {
    eyebrow: 'Seller guide',
    title: 'Guide to selling your property',
    intro:
      'A clear path from preparing your property to receiving funds securely and completing the sale.',
    actionLabel: 'Start a listing',
    actionPath: '/dashboard',
    steps: [
      {
        title: 'Prepare your property',
        text: 'Gather ownership documents, clear photos, property details, and any information a buyer may need.',
      },
      {
        title: 'Create your listing',
        text: 'Add the location, price, property type, features, photos, and a clear description of the property.',
      },
      {
        title: 'Complete verification',
        text: 'Your listing and account may be reviewed to help buyers trust that the property information is genuine.',
      },
      {
        title: 'Respond to enquiries',
        text: 'Reply to interested buyers, arrange viewings, and keep communication safely inside the platform.',
      },
      {
        title: 'Review offers',
        text: 'Compare offers, ask questions, negotiate where needed, and choose the buyer you want to proceed with.',
      },
      {
        title: 'Use escrow for payment',
        text: 'Once an offer is accepted, the transaction can move through secure escrow rather than informal direct payments.',
      },
      {
        title: 'Complete the transfer',
        text: 'Work with the required professionals to complete legal documents, transfer ownership, and close the sale.',
      },
    ],
  },

  buying: {
    eyebrow: 'Buyer guide',
    title: 'Guide to buying property',
    intro:
      'Use the platform to search safely, verify key details, make an offer, and complete your purchase with confidence.',
    actionLabel: 'Browse properties',
    actionPath: '/listings',
    steps: [
      {
        title: 'Search verified listings',
        text: 'Use location, property type, and price filters to find properties that fit what you are looking for.',
      },
      {
        title: 'Review the listing carefully',
        text: 'Check the property details, photos, price, location, and verification information before making contact.',
      },
      {
        title: 'Arrange a viewing',
        text: 'Contact the agent, seller, or landlord through the platform and inspect the property before committing.',
      },
      {
        title: 'Verify documents and details',
        text: 'Use qualified lawyers, valuers, or surveyors to confirm ownership, property boundaries, value, and legal status.',
      },
      {
        title: 'Make an offer',
        text: 'Submit an offer with confidence and keep the discussion, counter-offers, and records in one place.',
      },
      {
        title: 'Secure payment through escrow',
        text: 'Escrow protects the transaction by holding funds securely while agreed conditions are being completed.',
      },
      {
        title: 'Close the transaction',
        text: 'After the legal and financial requirements are met, complete the transfer and receive the final transaction records.',
      },
    ],
  },
};

export default function WelcomePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeImage, setActiveImage] = useState(0);
  const [activeGuide, setActiveGuide] = useState(null);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveImage((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setActiveGuide(null);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const roleQuickActions = {
    buyer: [
      {
        title: 'Browse properties',
        desc: 'Explore active listings by location, price, or type.',
        cta: 'Browse listings',
        to: '/listings',
      },
      {
        title: 'Your saved properties',
        desc: 'Revisit properties you’ve bookmarked and compare them.',
        cta: 'View saved',
        to: '/dashboard',
      },
    ],
    seller: [
      {
        title: 'List a property',
        desc: 'Create a new listing yourself or bring in an agent.',
        cta: 'Start a listing',
        to: '/dashboard',
      },
      {
        title: 'Track your listings',
        desc: 'See views, offers, and status on everything you’ve listed.',
        cta: 'View listings',
        to: '/dashboard',
      },
    ],
    agent: [
      {
        title: 'Your listings',
        desc: 'Manage active listings and pending admin approvals.',
        cta: 'View listings',
        to: '/dashboard',
      },
      {
        title: 'Client activity',
        desc: 'See which buyers are engaging with your listings.',
        cta: 'Open CRM',
        to: '/dashboard',
      },
    ],
  };

  const quickActions = roleQuickActions[profile?.role] || roleQuickActions.buyer;
  const guide = activeGuide ? GUIDES[activeGuide] : null;

  return (
    <div className="welcome-shell">
      <header className="welcome-topnav">
        <div className="welcome-brand">
          <span className="dash-brand-mark">
            <StampIcon />
          </span>
          <span>Marketplace</span>
        </div>

        <button type="button" className="welcome-logout" onClick={handleLogout}>
          <span>Logout</span>
          <LogOutIcon />
        </button>
      </header>

      <section className="welcome-hero">
        <div className="welcome-hero-bg">
          {heroImages.map((src, index) => (
            <div
              key={src}
              className={`welcome-hero-bg-image${
                index === activeImage ? ' is-active' : ''
              }`}
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
        </div>

        <div className="welcome-hero-overlay" />

        <nav className="welcome-hero-nav" aria-label="Platform links">
          <a href="#our-services">Our Services</a>
          <a href="#helpful-information">Helpful Information</a>
          <a href="#for-you">For You</a>
        </nav>

        <div className="welcome-hero-content">
          <h1>Welcome {profile?.full_name}</h1>
        </div>
      </section>

      <section className="welcome-continue" id="for-you">
        <div className="welcome-continue-inner">
          <div className="welcome-continue-cards">
            {quickActions.map((card) => (
              <div key={card.title} className="welcome-card">
                <h3>{card.title}</h3>
                <p>{card.desc}</p>

                <button
                  type="button"
                  className="welcome-card-cta"
                  onClick={() => navigate(card.to)}
                >
                  {card.cta}
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="welcome-dashboard-button"
            onClick={() => navigate('/dashboard')}
          >
            Go to your dashboard
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </section>

      <section className="welcome-services" id="our-services">
        <div className="welcome-services-inner">
          <div className="welcome-services-heading">
            <h2>Everything you need, in one place</h2>

            <p>
              From verified agents and licensed professionals to secure
              escrow-backed transactions — the platform supports you at every
              stage of a property deal.
            </p>
          </div>

          <div className="welcome-services-banners">
            <div className="welcome-banner welcome-banner--dark">
              <h3>Find a verified agent</h3>
              <p>
                Every agent on the platform is checked against gazette records
                before they can list.
              </p>
              <Link to="/agents" className="welcome-banner-link">
                Browse agents &rarr;
              </Link>
            </div>

            <div className="welcome-banner welcome-banner--light">
              <h3>Legal &amp; survey partners</h3>
              <p>
                Connect with lawyers, valuers, and surveyors directly through
                the platform.
              </p>
              <Link to="/professionals" className="welcome-banner-link">
                Find a professional &rarr;
              </Link>
            </div>

            <div className="welcome-banner welcome-banner--dark">
              <h3>Bank &amp; mortgage partners</h3>
              <p>
                Compare partner banks for mortgages, asset finance, and
                escrow-backed payments.
              </p>
              <Link to="/banks" className="welcome-banner-link">
                Browse banks &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="welcome-helpful" id="helpful-information">
        <div className="welcome-helpful-inner">
          <h2>Helpful information</h2>

          <p>
            New to buying, selling, or renting? These guides walk you through
            the process step by step.
          </p>

          <div className="welcome-guides">
            <div className="welcome-guide-card">
              <h3>Guide to selling your property</h3>
              <p>
                From preparing a listing to managing offers and closing the
                sale.
              </p>

              <button
                type="button"
                className="welcome-banner-link welcome-banner-link--dark"
                onClick={() => setActiveGuide('selling')}
                style={{
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Read the guide &rarr;
              </button>
            </div>

            <div className="welcome-guide-card">
              <h3>Guide to buying property</h3>
              <p>
                What to check, how escrow protects your payment, and what
                happens at each step.
              </p>

              <button
                type="button"
                className="welcome-banner-link welcome-banner-link--dark"
                onClick={() => setActiveGuide('buying')}
                style={{
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Read the guide &rarr;
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="welcome-closer">
        <div className="welcome-closer-overlay" />

        <div className="welcome-closer-inner">
          <h2>Our agents &amp; offices</h2>
          <p>
            Verified agents covering Nairobi and beyond, ready to help with
            your next move.
          </p>
          <a href="#" className="welcome-closer-link">
            See agents near you &rarr;
          </a>
        </div>
      </section>
      <footer className="welcome-footer">
  <div className="welcome-footer-inner">
    <div className="welcome-footer-brand">
      <div className="welcome-footer-logo">
        <span className="dash-brand-mark">
          <StampIcon />
        </span>
        <span>Marketplace</span>
      </div>

      <p>
        A safer, simpler way to buy, sell, rent, and manage property with
        verified professionals in one place.
      </p>

      <a href="mailto:support@yourmarketplace.com">
        support@yourmarketplace.com
      </a>
    </div>

    <div className="welcome-footer-column">
      <h3>Marketplace</h3>
      <Link to="/listings">Browse properties</Link>
      <Link to="/agents">Find agents</Link>
      <Link to="/professionals">Professionals</Link>
      <Link to="/banks">Bank partners</Link>
      <Link to="/dashboard">List a property</Link>
    </div>

    <div className="welcome-footer-column">
      <h3>Resources</h3>
      <button type="button" onClick={() => setActiveGuide('buying')}>
        Buying guide
      </button>
      <button type="button" onClick={() => setActiveGuide('selling')}>
        Selling guide
      </button>
      <a href="#helpful-information">Helpful information</a>
      <a href="mailto:support@yourmarketplace.com">Help centre</a>
      <a href="mailto:support@yourmarketplace.com">Contact support</a>
    </div>

    <div className="welcome-footer-column">
      <h3>Company &amp; Legal</h3>
      <Link to="/about">About us</Link>
      <Link to="/partners">Partners</Link>
      <Link to="/terms">Terms and Conditions</Link>
      <Link to="/privacy">Privacy Policy</Link>
      <Link to="/data-consent">Data consent</Link>
    </div>
  </div>

  <div className="welcome-footer-bottom">
    <p>© 2026 Marketplace. All rights reserved.</p>
    <p>Verified professionals · Escrow-backed transactions · Kenya</p>
  </div>
</footer>

      {guide && (
        <div
          role="presentation"
          onClick={() => setActiveGuide(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            overflowY: 'auto',
            padding: '24px',
            backgroundColor: 'rgba(20, 10, 13, 0.74)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'relative',
              width: 'min(100%, 760px)',
              margin: '24px auto',
              borderRadius: '18px',
              padding: 'clamp(24px, 5vw, 48px)',
              backgroundColor: '#ffffff',
              color: '#321018',
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.35)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveGuide(null)}
              aria-label="Close guide"
              style={{
                position: 'absolute',
                top: '16px',
                right: '20px',
                border: 0,
                background: 'transparent',
                color: '#5a1020',
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
                color: '#7b1d35',
                fontSize: '0.78rem',
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {guide.eyebrow}
            </p>

            <h2
              id="guide-title"
              style={{
                margin: '0 0 12px',
                color: '#4b0d1a',
                fontSize: 'clamp(1.65rem, 4vw, 2.35rem)',
              }}
            >
              {guide.title}
            </h2>

            <p
              style={{
                margin: '0 0 28px',
                color: '#684f55',
                lineHeight: 1.65,
              }}
            >
              {guide.intro}
            </p>

            <div
              style={{
                display: 'grid',
                gap: '14px',
              }}
            >
              {guide.steps.map((step, index) => (
                <div
                  key={step.title}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '42px 1fr',
                    gap: '14px',
                    padding: '16px',
                    border: '1px solid #eadde0',
                    borderRadius: '12px',
                    backgroundColor: '#fffafb',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'grid',
                      width: '34px',
                      height: '34px',
                      placeItems: 'center',
                      borderRadius: '50%',
                      backgroundColor: '#5a1020',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <div>
                    <h3
                      style={{
                        margin: '4px 0 6px',
                        color: '#4b0d1a',
                        fontSize: '1rem',
                      }}
                    >
                      {step.title}
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        color: '#684f55',
                        fontSize: '0.92rem',
                        lineHeight: 1.6,
                      }}
                    >
                      {step.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                marginTop: '30px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveGuide(null)}
                style={{
                  padding: '12px 16px',
                  border: '1px solid #5a1020',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: '#5a1020',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                Close guide
              </button>

              

              <button
                type="button"
                onClick={() => navigate(guide.actionPath)}
                style={{
                  padding: '12px 16px',
                  border: '1px solid #5a1020',
                  borderRadius: '8px',
                  backgroundColor: '#5a1020',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {guide.actionLabel} &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}