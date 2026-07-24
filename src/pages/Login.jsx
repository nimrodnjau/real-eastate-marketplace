import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import PasswordField from '../components/PasswordField';

export default function Login() {
  console.log('LOGIN FILE CHECK — VERSION 42');
  const { signInWithEmail, signInWithGoogle, session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Navigate only once context confirms the session is actually set —
  // not immediately after signInWithEmail resolves.
  useEffect(() => {
    console.log('[EFFECT] session is now:', session);
    if (session) {
      console.log('[EFFECT] session exists — navigating to /welcome');
      navigate('/welcome');
    }
  }, [session, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    console.log('[SUBMIT] calling signInWithEmail...');
    const { error } = await signInWithEmail({ email, password });
    console.log('[SUBMIT] signInWithEmail returned, error:', error);
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    console.log('[SUBMIT] no error — waiting for session effect to fire');
    // no navigate() here — the useEffect above handles it once `session`
    // updates in context
  };

  const handleGoogle = async () => {
    setError('');
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Every listing, lease, and closing — in one place."
      description="Sign in to pick up where you left off, whether you're browsing, listing, or managing a sale."
    >
      <h2 className="auth-card-heading">Log in</h2>
      <p className="auth-card-subtext">Enter your details to access your account.</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <PasswordField
          id="login-password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-btn auth-btn--primary" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <div className="auth-divider">or</div>

      <button className="auth-btn auth-btn--secondary" onClick={handleGoogle} type="button">
        Continue with Google
      </button>

      <p className="auth-footer-link">
        No account? <Link className="auth-link" to="/signup">Sign up</Link>
      </p>
    </AuthLayout>
  );
}