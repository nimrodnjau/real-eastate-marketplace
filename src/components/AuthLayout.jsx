import '../styles/auth.css';

// Shared split-screen shell for Login / Signup / SelectRole.
// Left panel carries the brand + editorial copy; right panel renders
// whatever form content the page passes as children.
export default function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-panel--brand">
        <div className="auth-mark">Marketplace</div>
        <div className="auth-brand-copy">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
        </div>
        <p className="auth-footnote">Verified agents · Escrow-backed · Licensed professionals</p>
      </div>

      <div className="auth-panel--form">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}