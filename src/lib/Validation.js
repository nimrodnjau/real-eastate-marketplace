// Shared validation used by Signup.jsx and SelectRole.jsx (Google path).
// Kept framework-free so it's easy to unit test independently.

// Accepts 07XXXXXXXX, 01XXXXXXXX, or +2547XXXXXXXX / +2541XXXXXXXX.
const KENYA_PHONE_REGEX = /^(?:\+254|0)(7\d{8}|1\d{8})$/;

export function validatePhone(phone) {
  const trimmed = (phone || '').trim().replace(/\s+/g, '');
  if (!trimmed) return { valid: false, message: 'Phone number is required.' };
  if (!KENYA_PHONE_REGEX.test(trimmed)) {
    return {
      valid: false,
      message: 'Enter a valid Kenyan number, e.g. 0712345678 or +254712345678.',
    };
  }
  return { valid: true, message: '' };
}

// Normalizes to +254XXXXXXXXX so the stored value is consistent regardless
// of how the person typed it.
export function normalizePhone(phone) {
  const trimmed = (phone || '').trim().replace(/\s+/g, '');
  if (trimmed.startsWith('+254')) return trimmed;
  if (trimmed.startsWith('0')) return `+254${trimmed.slice(1)}`;
  return trimmed;
}

export function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password needs at least one lowercase letter.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password needs at least one uppercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password needs at least one number.' };
  }
  return { valid: true, message: '' };
}

export function validateEmail(email) {
  const trimmed = (email || '').trim();
  const basicShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!trimmed) return { valid: false, message: 'Email is required.' };
  if (!basicShape.test(trimmed)) return { valid: false, message: 'Enter a valid email address.' };
  return { valid: true, message: '' };
}

export function validateFullName(name) {
  const trimmed = (name || '').trim();
  if (trimmed.length < 2) return { valid: false, message: 'Enter your full name.' };
  return { valid: true, message: '' };
}

// Supabase's raw error messages aren't user-friendly — map the common ones.
export function friendlyAuthError(error) {
  if (!error) return '';
  const msg = error.message || '';

  if (/already registered|already exists|user_repeated_signup/i.test(msg)) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (/invalid login credentials/i.test(msg)) {
    return 'Incorrect email or password.';
  }
  if (/password.*at least/i.test(msg)) {
    return 'Password is too short — use at least 8 characters.';
  }
  if (/rate limit/i.test(msg)) {
    return 'Too many attempts — wait a moment and try again.';
  }
  if (/network/i.test(msg)) {
    return 'Network error — check your connection and try again.';
  }
  return msg || 'Something went wrong. Please try again.';
}

// Role-specific extra fields required at signup. Used to drive which inputs
// Signup.jsx / SelectRole.jsx render, and to validate before submit.
// Roles not listed here (buyer, seller, landlord, tenant, property_manager)
// need no extra fields at signup — credential uploads for those happen
// later from the dashboard, not at signup, since file storage isn't wired
// into the signup form.
export const ROLE_EXTRA_FIELDS = {
  agent: [{ key: 'agency_name', label: 'Agency name (leave blank if independent)', required: false }],
  lawyer: [{ key: 'license_number', label: 'Law Society practising certificate number', required: true }],
  valuer: [{ key: 'license_number', label: 'Valuers Registration Board number', required: true }],
  surveyor: [{ key: 'license_number', label: 'Surveyors Board registration number', required: true }],
  bank: [{ key: 'institution_name', label: 'Institution name', required: true }],
  property_manager: [{ key: 'company_name', label: 'Company name (if applicable)', required: false }],
};

export const ALL_ROLES = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'agent', label: 'Agent' },
  { value: 'lawyer', label: 'Lawyer' },
  { value: 'valuer', label: 'Valuer' },
  { value: 'surveyor', label: 'Surveyor' },
  { value: 'bank', label: 'Bank' },
  { value: 'landlord', label: 'Landlord' },
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'tenant', label: 'Tenant (looking to rent)' },
];