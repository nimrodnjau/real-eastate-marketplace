import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import PasswordField from '../components/PasswordField';

export default function Login() {
  const { signInWithEmail, signInWithGoogle, session } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect only after AuthContext confirms a valid session exists.
  useEffect(() => {
    if (session) {
      navigate('/welcome', { replace: true });
    }
  }, [session, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError('Enter your email address and password to continue.');
      return;
    }

    setSubmitting(true);

    try {
      const { error: signInError } = await signInWithEmail({
        email: cleanEmail,
        password,
      });

      if (signInError) {
        // Keep this generic: do not reveal whether an account exists.
        setError(
          'Unable to sign in with those details. Please check your email and password.'
        );
      }
    } catch {
      setError('Something went wrong. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);

    try {
      const { error: googleError } = await signInWithGoogle();

      if (googleError) {
        setError('Google sign-in is unavailable right now. Please try again.');
      }
    } catch {
      setError('Google sign-in is unavailable right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Every listing, lease, and closing — in one place."
      description="Sign in to pick up where you left off, whether you're browsing, listing, or managing a sale."
    >
      <h2 className="auth-card-heading">Log in</h2>

      <p className="auth-card-subtext">
        Enter your details to access your account.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="login-email">Email</label>

          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck="false"
            inputMode="email"
            maxLength={254}
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'login-error' : undefined}
          />
        </div>

        <PasswordField
          id="login-password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
        />

        {error && (
          <p id="login-error" className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="auth-btn auth-btn--primary"
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <div className="auth-divider">or</div>

      <button
        className="auth-btn auth-btn--secondary"
        onClick={handleGoogle}
        type="button"
        disabled={submitting}
      >
        Continue with Google
      </button>

      <p className="auth-footer-link">
        No account?{' '}
        <Link className="auth-link" to="/signup">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}