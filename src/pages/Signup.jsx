import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import { ROLES } from '../components/RoleSelector';
import PasswordField from '../components/PasswordField';
import CountrySelect from '../components/CountrySelect';
import {
  validateEmail,
  validatePhone,
  validatePassword,
  validateFullName,
  ROLE_EXTRA_FIELDS,
} from '../lib/validation';

const DEFAULT_ROLE = 'buyer';
const TERMS_VERSION = '2026-08-03';
const MAX_NAME_LENGTH = 120;
const MAX_PHONE_LENGTH = 30;
const MAX_EXTRA_FIELD_LENGTH = 180;

export default function Signup() {
  const { signUpWithEmail, signInWithGoogle, resendConfirmationEmail } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('Kenya');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState(DEFAULT_ROLE);
  const [roleFields, setRoleFields] = useState({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  const allowedRoleValues = new Set(ROLES.map((item) => item.value));
  const safeRole = allowedRoleValues.has(role) ? role : DEFAULT_ROLE;
  const extraFields = ROLE_EXTRA_FIELDS[safeRole] || [];
  const selectedRole = ROLES.find((item) => item.value === safeRole) || ROLES[0];

  useEffect(() => {
    const closeDropdown = (event) => {
      if (event.key === 'Escape') {
        setRoleDropdownOpen(false);
      }
    };

    window.addEventListener('keydown', closeDropdown);

    return () => {
      window.removeEventListener('keydown', closeDropdown);
    };
  }, []);

  const handleRoleChange = (newRole) => {
    if (!allowedRoleValues.has(newRole)) return;

    setRole(newRole);
    setRoleFields({});
    setRoleDropdownOpen(false);
    setFieldErrors((currentErrors) => {
      const { roleFields: ignored, ...remainingErrors } = currentErrors;
      return remainingErrors;
    });
  };

  const buildSignupPayload = () => {
    const cleanedRoleFields = {};

    for (const field of extraFields) {
      const value = roleFields[field.key];

      if (typeof value === 'string') {
        cleanedRoleFields[field.key] = value.trim().slice(0, MAX_EXTRA_FIELD_LENGTH);
      }
    }

    return {
      fullName: fullName.trim().slice(0, MAX_NAME_LENGTH),
      country: typeof country === 'string' ? country.trim().slice(0, 100) : '',
      email: email.trim().toLowerCase(),
      phone: phone.trim().slice(0, MAX_PHONE_LENGTH),
      password,
      role: safeRole,
      roleFields: cleanedRoleFields,
      termsAccepted,
      termsVersion: TERMS_VERSION,
    };
  };

  const runValidation = (payload) => {
    const errors = {};

    const nameCheck = validateFullName(payload.fullName);
    if (!nameCheck.valid) errors.fullName = nameCheck.message;

    const emailCheck = validateEmail(payload.email);
    if (!emailCheck.valid) errors.email = emailCheck.message;

    const phoneCheck = validatePhone(payload.phone);
    if (!phoneCheck.valid) errors.phone = phoneCheck.message;

    const passwordCheck = validatePassword(payload.password);
    if (!passwordCheck.valid) errors.password = passwordCheck.message;

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    for (const field of extraFields) {
      if (field.required && !payload.roleFields[field.key]) {
        errors[field.key] = `${field.label} is required.`;
      }
    }

    if (!termsAccepted) {
      errors.terms = 'You must accept the Terms of Service to continue.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const payload = buildSignupPayload();

    if (!runValidation(payload)) return;

    setSubmitting(true);

    try {
      const { data, error: signupError } = await signUpWithEmail(payload);

      if (signupError) {
        // Do not expose raw database, SMTP, or authentication errors.
        setError(
          'We could not create your account right now. Please check your details and try again.'
        );
        return;
      }

      if (!data?.session) {
        setConfirmEmailSent(true);
        return;
      }

      navigate('/welcome', { replace: true });
    } catch {
      setError('Something went wrong. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);

    // These values are only a temporary UI preference. Your database and RLS
    // policies must validate roles and never grant elevated permissions from them.
    sessionStorage.setItem('pending_signup_role', safeRole);
    sessionStorage.setItem(
      'pending_signup_country',
      typeof country === 'string' ? country.trim().slice(0, 100) : ''
    );

    try {
      const { error: googleError } = await signInWithGoogle();

      if (googleError) {
        setError('Google sign-up is unavailable right now. Please try again.');
      }
    } catch {
      setError('Google sign-up is unavailable right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmEmailSent) {
    return (
      <AuthLayout
        eyebrow="Almost there"
        title="One inbox away from getting started."
        description="Confirm your email to activate your account and start browsing, listing, or managing sales."
      >
        <ConfirmEmailPanel
          email={email.trim().toLowerCase()}
          resendConfirmationEmail={resendConfirmationEmail}
        />
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

      <p className="auth-card-subtext">
        Tell us how you&apos;ll be using the platform.
      </p>

      <div style={{ position: 'relative', marginBottom: '22px' }}>
        <label
          htmlFor="role-selector-button"
          style={{
            display: 'block',
            marginBottom: '8px',
            color: '#4b0d1a',
            fontSize: '0.88rem',
            fontWeight: 700,
          }}
        >
          Choose your role
        </label>

        <button
          id="role-selector-button"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={roleDropdownOpen}
          onClick={() => setRoleDropdownOpen((open) => !open)}
          disabled={submitting}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            padding: '14px 16px',
            border: '1.5px solid #5a1020',
            borderRadius: '10px',
            background: '#ffffff',
            color: '#4b0d1a',
            cursor: submitting ? 'not-allowed' : 'pointer',
            font: 'inherit',
            textAlign: 'left',
            boxShadow: roleDropdownOpen
              ? '0 0 0 3px rgba(90, 16, 32, 0.13)'
              : 'none',
          }}
        >
          <span>
            <strong style={{ display: 'block', fontSize: '0.95rem' }}>
              {selectedRole?.label || 'Select a role'}
            </strong>

            {selectedRole?.desc && (
              <span
                style={{
                  display: 'block',
                  marginTop: '3px',
                  color: '#7c5961',
                  fontSize: '0.78rem',
                }}
              >
                {selectedRole.desc}
              </span>
            )}
          </span>

          <span
            aria-hidden="true"
            style={{
              color: '#5a1020',
              fontSize: '1.2rem',
              transform: roleDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 160ms ease',
            }}
          >
            ▾
          </span>
        </button>

        {roleDropdownOpen && (
          <div
            role="listbox"
            aria-label="Choose your role"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              zIndex: 100,
              width: '100%',
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '7px',
              border: '1px solid #6b1b2b',
              borderRadius: '10px',
              background: '#ffffff',
              boxShadow: '0 15px 35px rgba(75, 13, 26, 0.22)',
            }}
          >
            {ROLES.map((item) => {
              const isSelected = item.value === safeRole;

              return (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleRoleChange(item.value)}
                  style={{
                    width: '100%',
                    display: 'block',
                    padding: '11px 12px',
                    border: 0,
                    borderRadius: '7px',
                    background: isSelected ? '#5a1020' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#4b0d1a',
                    cursor: 'pointer',
                    font: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <strong style={{ display: 'block', fontSize: '0.9rem' }}>
                    {item.label}
                  </strong>

                  {item.desc && (
                    <span
                      style={{
                        display: 'block',
                        marginTop: '3px',
                        color: isSelected
                          ? 'rgba(255,255,255,0.78)'
                          : '#7c5961',
                        fontSize: '0.76rem',
                        lineHeight: 1.35,
                      }}
                    >
                      {item.desc}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="signup-name">Full name</label>

          <input
            id="signup-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            maxLength={MAX_NAME_LENGTH}
            required
            aria-invalid={Boolean(fieldErrors.fullName)}
          />

          {fieldErrors.fullName && (
            <p className="auth-error" role="alert">
              {fieldErrors.fullName}
            </p>
          )}
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
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck="false"
            inputMode="email"
            maxLength={254}
            required
            aria-invalid={Boolean(fieldErrors.email)}
          />

          {fieldErrors.email && (
            <p className="auth-error" role="alert">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className="auth-field">
          <label htmlFor="signup-phone">Phone number</label>

          <input
            id="signup-phone"
            type="tel"
            placeholder="0712345678"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            inputMode="tel"
            maxLength={MAX_PHONE_LENGTH}
            required
            aria-invalid={Boolean(fieldErrors.phone)}
          />

          {fieldErrors.phone && (
            <p className="auth-error" role="alert">
              {fieldErrors.phone}
            </p>
          )}
        </div>

        <PasswordField
          id="signup-password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          hint="At least 8 characters, with upper/lowercase and a number"
          error={fieldErrors.password}
        />

        <PasswordField
          id="signup-confirm-password"
          label="Confirm password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
        />

        {extraFields.map((field) => (
          <div className="auth-field" key={field.key}>
            <label htmlFor={`signup-${field.key}`}>{field.label}</label>

            <input
              id={`signup-${field.key}`}
              value={roleFields[field.key] || ''}
              maxLength={MAX_EXTRA_FIELD_LENGTH}
              onChange={(event) =>
                setRoleFields((previous) => ({
                  ...previous,
                  [field.key]: event.target.value,
                }))
              }
              aria-invalid={Boolean(fieldErrors[field.key])}
            />

            {fieldErrors[field.key] && (
              <p className="auth-error" role="alert">
                {fieldErrors[field.key]}
              </p>
            )}
          </div>
        ))}

        {['lawyer', 'valuer', 'surveyor', 'agent', 'bank'].includes(safeRole) && (
          <p className="auth-card-subtext" style={{ marginTop: -4 }}>
            You can upload your credentials for verification after signing up,
            from your dashboard.
          </p>
        )}

        <label
          className="auth-field"
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            style={{ marginTop: 3 }}
          />

          <span>
            I agree to the{' '}
            <a href="/terms" target="_blank" rel="noreferrer">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" rel="noreferrer">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {fieldErrors.terms && (
          <p className="auth-error" role="alert">
            {fieldErrors.terms}
          </p>
        )}

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="auth-btn auth-btn--primary"
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Signing up…' : 'Sign up'}
        </button>
      </form>

      <div className="auth-divider">or</div>

      <button
        className="auth-btn auth-btn--secondary"
        onClick={handleGoogle}
        type="button"
        disabled={submitting}
      >
        Continue with Google as {selectedRole?.label || safeRole}
      </button>

      <p className="auth-footer-link">
        Already have an account?{' '}
        <Link className="auth-link" to="/login">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}

function ConfirmEmailPanel({ email, resendConfirmationEmail }) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;

    const timer = window.setInterval(() => {
      setCooldown((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (state === 'sending' || cooldown > 0) return;

    setState('sending');
    setError('');

    try {
      const { error: resendError } = await resendConfirmationEmail(email);

      if (resendError) {
        setError('We could not resend the confirmation email. Please try again later.');
        setState('idle');
        return;
      }

      setState('sent');
      setCooldown(60);
    } catch {
      setError('We could not resend the confirmation email. Please try again later.');
      setState('idle');
    }
  };

  return (
    <>
      <h2 className="auth-card-heading">Check your email</h2>

      <p className="auth-card-subtext">
        We sent a confirmation link to <strong>{email}</strong>. Confirm it to
        finish signing up.
      </p>

      <p className="auth-card-subtext" style={{ fontSize: 13 }}>
        Don&apos;t see it? Check your spam folder — it can take a couple of
        minutes to arrive.
      </p>

      <button
        className="auth-btn auth-btn--secondary"
        type="button"
        onClick={handleResend}
        disabled={state === 'sending' || cooldown > 0}
      >
        {cooldown > 0
          ? `Resend available in ${cooldown}s`
          : state === 'sending'
            ? 'Sending…'
            : 'Resend email'}
      </button>

      {state === 'sent' && cooldown > 0 && (
        <p className="auth-card-subtext" style={{ color: 'green', fontSize: 13 }}>
          Confirmation email resent.
        </p>
      )}

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <p className="auth-footer-link">
        <Link className="auth-link" to="/login">
          Back to login
        </Link>
      </p>
    </>
  );
}