import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StampIcon, LogOutIcon } from '../components/dashboard/icons';
import '../styles/welcome.css';

// Hero background images — imported so the bundler resolves/hashes them correctly.
import heroImage1 from '../assets/image.png';
import heroImage2 from '../assets/image1.png';
import heroImage3 from '../assets/image2.png';

const heroImages = [heroImage1, heroImage2, heroImage3];

// Shown once right after login, before the role dashboard. Gives a warm
// landing moment, a few quick actions, and a clear path into the real
// dashboard — mirrors the "Your Dashboard" landing page pattern (hero +
// quick actions + marketing + helpful info + closer) rather than dropping
// people straight into the tabbed dashboard.
export default function WelcomePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveImage((prev) => (prev + 1) % heroImages.length);
    }, 5000); // change slide every 5s
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const roleQuickActions = {
  buyer: [
    { title: 'Browse properties', desc: 'Explore active listings by location, price, or type.', cta: 'Browse listings', to: '/listings' },
    { title: 'Your saved properties', desc: 'Revisit properties you\u2019ve bookmarked and compare them.', cta: 'View saved', to: '/dashboard' },
  ],
  seller: [
    { title: 'List a property', desc: 'Create a new listing yourself or bring in an agent.', cta: 'Start a listing', to: '/dashboard' },
    { title: 'Track your listings', desc: 'See views, offers, and status on everything you\u2019ve listed.', cta: 'View listings', to: '/dashboard' },
  ],
  agent: [
    { title: 'Your listings', desc: 'Manage active listings and pending admin approvals.', cta: 'View listings', to: '/dashboard' },
    { title: 'Client activity', desc: 'See which buyers are engaging with your listings.', cta: 'Open CRM', to: '/dashboard' },
  ],
};

  const quickActions = roleQuickActions[profile?.role] || roleQuickActions.buyer;

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
          {heroImages.map((src, i) => (
            <div
              key={src}
              className={`welcome-hero-bg-image${i === activeImage ? ' is-active' : ''}`}
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
                <button type="button" className="welcome-card-cta" onClick={() => navigate(card.to)}>
                  {card.cta}
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="welcome-dashboard-button" onClick={() => navigate('/dashboard')}>
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
              From verified agents and licensed professionals to secure escrow-backed transactions \u2014
              the platform supports you at every stage of a property deal.
            </p>
          </div>
           <div className="welcome-services-banners">
            <div className="welcome-banner welcome-banner--dark">
              <h3>Find a verified agent</h3>
              <p>Every agent on the platform is checked against gazette records before they can list.</p>
              <Link to="/agents" className="welcome-banner-link">Browse agents &rarr;</Link>
            </div>
            <div className="welcome-banner welcome-banner--light">
              <h3>Legal &amp; survey partners</h3>
              <p>Connect with lawyers, valuers, and surveyors directly through the platform.</p>
              <Link to="/professionals" className="welcome-banner-link">Find a professional &rarr;</Link>
            </div>
            <div className="welcome-banner welcome-banner--dark">
              <h3>Bank &amp; mortgage partners</h3>
              <p>Compare partner banks for mortgages, asset finance, and escrow-backed payments.</p>
              <Link to="/banks" className="welcome-banner-link">Browse banks &rarr;</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="welcome-helpful" id="helpful-information">
        <div className="welcome-helpful-inner">
          <h2>Helpful information</h2>
          <p>New to buying, selling, or renting? These guides walk you through the process step by step.</p>
          <div className="welcome-guides">
            <div className="welcome-guide-card">
              <h3>Guide to selling your property</h3>
              <p>From preparing a listing to managing offers and closing the sale.</p>
              <a href="#" className="welcome-banner-link welcome-banner-link--dark">Read the guide &rarr;</a>
            </div>
            <div className="welcome-guide-card">
              <h3>Guide to buying property</h3>
              <p>What to check, how escrow protects your payment, and what happens at each step.</p>
              <a href="#" className="welcome-banner-link welcome-banner-link--dark">Read the guide &rarr;</a>
            </div>
          </div>
        </div>
      </section>

      <section className="welcome-closer">
        <div className="welcome-closer-overlay" />
        <div className="welcome-closer-inner">
          <h2>Our agents &amp; offices</h2>
          <p>Verified agents covering Nairobi and beyond, ready to help with your next move.</p>
          <a href="#" className="welcome-closer-link">See agents near you &rarr;</a>
        </div>
      </section>
    </div>
  );
}