export const ROLES = [
  { value: 'buyer', label: 'Buyer', desc: 'Browse listings and make offers.' },
  { value: 'seller', label: 'Seller', desc: 'List a property and manage the sale.' },
  { value: 'agent', label: 'Agent', desc: 'Manage listings, clients, and commissions.' },
  { value: 'lawyer', label: 'Lawyer', desc: 'Draft and review legal documents.' },
  { value: 'valuer', label: 'Valuer', desc: 'Provide property valuations.' },
  { value: 'surveyor', label: 'Surveyor', desc: 'Provide land and property surveys.' },
  { value: 'bank', label: 'Bank', desc: 'Post mortgage and financing plans.' },
  { value: 'landlord', label: 'Landlord', desc: 'List and lease properties.' },
  { value: 'property_manager', label: 'Property manager', desc: 'Manage leased properties for landlords.' },
  { value: 'tenant', label: 'Tenant', desc: 'Browse and rent available properties.' },
];

export default function RoleSelector({ value, onChange }) {
  return (
    <div className="role-grid" role="radiogroup" aria-label="I am a...">
      {ROLES.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          className={`role-card${value === r.value ? ' role-card--selected' : ''}`}
          onClick={() => onChange(r.value)}
        >
          <p className="role-card-label">{r.label}</p>
          <p className="role-card-desc">{r.desc}</p>
        </button>
      ))}
    </div>
  );
}