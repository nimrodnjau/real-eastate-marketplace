import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import RoleSelector from '../components/RoleSelector';
import CountrySelect from '../components/CountrySelect';
import {
  validatePhone,
  validateFullName,
  friendlyAuthError,
  ROLE_EXTRA_FIELDS,
} from '../lib/validation';

// Reached whenever there's a session but no profiles row yet — a Google
// signup, or someone who confirmed their email after a password signup
// (profile creation was deferred until a session existed).
export default function SelectRole() {
  const { session, profile, user, completeProfile, loading } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState(sessionStorage.getItem('pending_signup_country') || 'Kenya');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(sessionStorage.getItem('pending_signup_role') || 'buyer');
  const [roleFields, setRoleFields] = useState({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const extraFields = ROLE_EXTRA_FIELDS[role] || [];

  useEffect(() => {
    if (!loading && profile) navigate('/welcome');
    if (!loading && !session) navigate('/login');
    if (user?.user_metadata?.full_name && !fullName) {
      setFullName(user.user_metadata.full_name);
    }
  }, [loading, profile, session, user, navigate, fullName]);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setRoleFields({});
  };

  const runValidation = () => {
    const errors = {};
    const nameCheck = validateFullName(fullName);
    if (!nameCheck.valid) errors.fullName = nameCheck.message;

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) errors.phone = phoneCheck.message;

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
    const { error } = await completeProfile({ fullName, phone, country, role, roleFields, termsAccepted });
    setSubmitting(false);

    sessionStorage.removeItem('pending_signup_role');
    sessionStorage.removeItem('pending_signup_country');

    if (error) {
      setError(friendlyAuthError(error));
      return;
    }
    navigate('/welcome');
  };

  return (
    <AuthLayout
      eyebrow="Almost there"
      title="Just a few more details."
      description="We need a couple more things to finish setting up your account."
    >
      <h2 className="auth-card-heading">Complete your profile</h2>
      <p className="auth-card-subtext">Confirm how you'll be using the platform.</p>

      <RoleSelector value={role} onChange={handleRoleChange} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="select-role-name">Full name</label>
          <input
            id="select-role-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          {fieldErrors.fullName && <p className="auth-error">{fieldErrors.fullName}</p>}
        </div>

        <CountrySelect
          id="select-role-country"
          label="Country"
          value={country}
          onChange={setCountry}
        />

        <div className="auth-field">
          <label htmlFor="select-role-phone">Phone number</label>
          <input
            id="select-role-phone"
            type="tel"
            placeholder="0712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {fieldErrors.phone && <p className="auth-error">{fieldErrors.phone}</p>}
        </div>

        {extraFields.map((field) => (
          <div className="auth-field" key={field.key}>
            <label htmlFor={`select-role-${field.key}`}>{field.label}</label>
            <input
              id={`select-role-${field.key}`}
              value={roleFields[field.key] || ''}
              onChange={(e) => setRoleFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
            {fieldErrors[field.key] && <p className="auth-error">{fieldErrors[field.key]}</p>}
          </div>
        ))}

        {['lawyer', 'valuer', 'surveyor', 'agent', 'bank'].includes(role) && (
          <p className="auth-card-subtext" style={{ marginTop: -4 }}>
            You can upload your credentials for verification after this, from your dashboard.
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
          {submitting ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </AuthLayout>
  );
}