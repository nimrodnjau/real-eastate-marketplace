import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon, StampIcon, LogOutIcon, MessageCircleIcon } from './icons';



// `sections` shape: [{ id, icon, title, content }]
// `children` is the Overview tab's content (shown by default, id 'overview').
// `modal` is rendered unconditionally, regardless of which tab is active
// (use it for modals/overlays triggered from any section, e.g. an "Add" form).
// A "Public chat" tab is always appended automatically at the end.
export default function DashboardLayout({
  roleLabel,
  pageTitle,
  pageSubtitle,
  sections = [],
  verificationStatus,
  children,
  modal,
}) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState('overview');

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Everything the sidebar can navigate to, in one list: Overview first,
  // then each caller-provided section, then the built-in Public chat tab.
 const navItems = [
  { id: 'overview', icon: 'home', title: 'Overview' },
  ...sections.map((s) => ({ id: s.id, icon: s.icon, title: s.title })),
  { id: 'public-chat', icon: 'messageCircle', title: 'Public chat', to: '/community' },
];

  const activeSection = sections.find((s) => s.id === activeId);

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <span className="dash-brand-mark">
            <StampIcon />
          </span>
          <span>Marketplace</span>
        </div>

        <nav className="dash-nav" aria-label="Dashboard sections">
          {navItems.map((item) => (
  <button
    key={item.id}
    type="button"
    className={`dash-nav-item${activeId === item.id ? ' active' : ''}`}
    aria-current={activeId === item.id ? 'page' : undefined}
    onClick={() => (item.to ? navigate(item.to) : setActiveId(item.id))}
  >
    <Icon name={item.icon} />
    <span>{item.title}</span>
  </button>
))}
        </nav>

        <div className="dash-sidebar-footer">
          <div className="dash-profile">
            <p className="dash-profile-name">{profile?.full_name}</p>
            <p className="dash-profile-role">{roleLabel}</p>
          </div>
          <button type="button" className="dash-logout" onClick={handleLogout}>
            <LogOutIcon />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <div>
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>
          <div className="dash-topbar-right">
            {verificationStatus && (
              <span className="stamp-badge">
                <StampIcon />
                {verificationStatus}
              </span>
            )}
            <button type="button" className="dash-bell" aria-label="Notifications">
              <Icon name="bell" />
              <span className="dash-bell-dot" />
            </button>
          </div>
        </header>

        <div className="dash-content">
          {activeId === 'overview' && children}

      

          {activeSection && activeId !== 'overview' && activeId !== 'public-chat' && (
            <SectionCardContent section={activeSection} />
          )}
        </div>
      </div>

      {modal}
    </div>
  );
}

// Renders a caller-provided section's content wrapped in the standard
// section-card header (icon, title, description, action button), so each
// page doesn't have to repeat that markup for every section.
function SectionCardContent({ section }) {
  return (
    <section className="section-card">
      <header className="section-card-header">
        <div className="section-card-heading">
          <span className="section-card-icon">
            <Icon name={section.icon} />
          </span>
          <div>
            <h2>{section.title}</h2>
            {section.description && <p>{section.description}</p>}
          </div>
        </div>
        {section.action && (
          <button type="button" className="section-card-action" onClick={section.action.onClick}>
            {section.action.label}
          </button>
        )}
      </header>
      {section.content}
    </section>
  );
}