import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import RoleSelector from '../components/RoleSelector';
import PasswordField from '../components/PasswordField';
import CountrySelect from '../components/CountrySelect';
import {
  validateEmail,
  validatePhone,
  validatePassword,
  validateFullName,
  friendlyAuthError,
  ROLE_EXTRA_FIELDS,
} from '../lib/validation';

export default function Signup() {
  const { signUpWithEmail, signInWithGoogle, resendConfirmationEmail } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('Kenya');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('buyer');
  const [roleFields, setRoleFields] = useState({});
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  const extraFields = ROLE_EXTRA_FIELDS[role] || [];

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setRoleFields({});
  };

  const runValidation = () => {
    const errors = {};

    const nameCheck = validateFullName(fullName);
    if (!nameCheck.valid) errors.fullName = nameCheck.message;

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) errors.email = emailCheck.message;

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) errors.phone = phoneCheck.message;

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) errors.password = passwordCheck.message;

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    for (const field of extraFields) {
      if (field.required && !roleFields[field.key]?.trim()) {
        errors[field.key] = `${field.label} is required.`;
      }
    }

    if (!termsAccepted) {
      errors.terms = 'You must accept the Terms of Service to continue.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!runValidation()) return;

    setSubmitting(true);
    const { data, error } = await signUpWithEmail({
      email,
      password,
      fullName,
      phone,
      country,
      role,
      roleFields,
      termsAccepted,
    });
    setSubmitting(false);

    if (error) {
      setError(friendlyAuthError(error));
      return;
    }
    if (!data?.session) {
      setConfirmEmailSent(true);
      return;
    }
    navigate('/welcome');
  };

  // Role is chosen once, before either signup method — stashed for Google
  // since we don't know the user's choice again until after the redirect.
  // Role-specific fields (license number etc.) are collected on
  // /select-role after the redirect instead, since Google can't carry them.
  const handleGoogle = async () => {
    setError('');
    sessionStorage.setItem('pending_signup_role', role);
    sessionStorage.setItem('pending_signup_country', country);
    const { error } = await signInWithGoogle();
    if (error) setError(friendlyAuthError(error));
  };

  if (confirmEmailSent) {
    return (
      <AuthLayout
        eyebrow="Almost there"
        title="One inbox away from getting started."
        description="Confirm your email to activate your account and start browsing, listing, or managing sales."
      >
        <ConfirmEmailPanel email={email} resendConfirmationEmail={resendConfirmationEmail} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Get started"
      title="A marketplace built for every side of the transaction."
      description="Buyers, sellers, agents, lawyers, valuers, and surveyors — one account, one platform."
    >
      <h2 className="auth-card-heading">Sign up</h2>
      <p className="auth-card-subtext">Tell us how you'll be using the platform.</p>

      <RoleSelector value={role} onChange={handleRoleChange} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="signup-name">Full name</label>
          <input
            id="signup-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          {fieldErrors.fullName && <p className="auth-error">{fieldErrors.fullName}</p>}
        </div>

        <CountrySelect
          id="signup-country"
          label="Country"
          value={country}
          onChange={setCountry}
        />

        <div className="auth-field">
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fieldErrors.email && <p className="auth-error">{fieldErrors.email}</p>}
        </div>

        <div className="auth-field">
          <label htmlFor="signup-phone">Phone number</label>
          <input
            id="signup-phone"
            type="tel"
            placeholder="0712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {fieldErrors.phone && <p className="auth-error">{fieldErrors.phone}</p>}
        </div>

        <PasswordField
          id="signup-password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          hint="At least 8 characters, with upper/lowercase and a number"
          error={fieldErrors.password}
        />
        <PasswordField
          id="signup-confirm-password"
          label="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
        />

        {extraFields.map((field) => (
          <div className="auth-field" key={field.key}>
            <label htmlFor={`signup-${field.key}`}>{field.label}</label>
            <input
              id={`signup-${field.key}`}
              value={roleFields[field.key] || ''}
              onChange={(e) => setRoleFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
            {fieldErrors[field.key] && <p className="auth-error">{fieldErrors[field.key]}</p>}
          </div>
        ))}

        {['lawyer', 'valuer', 'surveyor', 'agent', 'bank'].includes(role) && (
          <p className="auth-card-subtext" style={{ marginTop: -4 }}>
            You can upload your credentials for verification after signing up, from your dashboard.
          </p>
        )}

        <label className="auth-field" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> and{' '}
            <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
          </span>
        </label>
        {fieldErrors.terms && <p className="auth-error">{fieldErrors.terms}</p>}

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-btn auth-btn--primary" type="submit" disabled={submitting}>
          {submitting ? 'Signing up…' : 'Sign up'}
        </button>
      </form>

      <div className="auth-divider">or</div>

      <button className="auth-btn auth-btn--secondary" onClick={handleGoogle} type="button">
        Continue with Google as {role}
      </button>

      <p className="auth-footer-link">
        Already have an account? <Link className="auth-link" to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}

// The "check your email" state, with a resend button (60s cooldown so
// people can't spam it) — separated out to keep the main component tidy.
function ConfirmEmailPanel({ email, resendConfirmationEmail }) {
  const [state, setState] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const handleResend = async () => {
    setState('sending');
    setError('');
    const { error } = await resendConfirmationEmail(email);
    if (error) {
      setError(friendlyAuthError(error));
      setState('idle');
      return;
    }
    setState('sent');
    setCooldown(60);
    const interval = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setState('idle');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  return (
    <>
      <h2 className="auth-card-heading">Check your email</h2>
      <p className="auth-card-subtext">
        We sent a confirmation link to <strong>{email}</strong>. Confirm it to finish signing up.
      </p>
      <p className="auth-card-subtext" style={{ fontSize: 13 }}>
        Don't see it? Check your spam folder — it can take a couple of minutes to arrive.
      </p>

      <button
        className="auth-btn auth-btn--secondary"
        type="button"
        onClick={handleResend}
        disabled={state === 'sending' || cooldown > 0}
      >
        {cooldown > 0 ? `Resend available in ${cooldown}s` : state === 'sending' ? 'Sending…' : 'Resend email'}
      </button>
      {state === 'sent' && cooldown > 0 && (
        <p className="auth-card-subtext" style={{ color: 'green', fontSize: 13 }}>
          Confirmation email resent.
        </p>
      )}
      {error && <p className="auth-error">{error}</p>}

      <p className="auth-footer-link">
        <Link className="auth-link" to="/login">Back to login</Link>
      </p>
    </>
  );
}