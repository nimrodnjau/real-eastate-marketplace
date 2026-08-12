// Per-role configuration for RoleProfileSection.
//
// roleTable       — the schema table holding this role's extra fields, or null
//                    if the role only ever touches `profiles`.
// roleIdColumn     — FK column on roleTable pointing at profiles.id.
// supportsLocation — whether the location row/picker should render at all.
// locationTable    — 'role' (default) writes location_lat/lng to roleTable,
//                     'profiles' writes it straight to profiles instead.
// extraRows        — extra display rows, read from the flattened `profile` object.
// extraFormFields  — extra editable fields in the edit form.
//                     table: 'role' -> written to roleTable on save
//                     table: 'profiles' -> already covered by the base profiles
//                       update in RoleProfileSection, list here only so the
//                       form knows to render an input for it.

export const roleProfileConfigs = {
  // Confirmed against agent_profiles — this reproduces the exact current
  // AgentProfileSection behavior, so this one's safe as-is.
  agent: {
    roleTable: 'agent_profiles',
    roleIdColumn: 'user_id',
    supportsLocation: true,
    locationTable: 'role',
    extraRows: [
      { label: 'Agency', key: 'agency_name' },
      { label: 'License number', key: 'license_number' },
    ],
    extraFormFields: [
      { key: 'agency_name', label: 'Agency name', table: 'role', type: 'text' },
      { key: 'license_number', label: 'License number', table: 'profiles', type: 'text' },
    ],
  },

  // Confirmed against landlord_profiles (user_id/verification_status only —
  // no location columns yet).
  landlord: {
    roleTable: 'landlord_profiles',
    roleIdColumn: 'user_id',
    supportsLocation: false,
    extraRows: [],
    extraFormFields: [],
  },

  // Confirmed against property_manager_profiles — has company_name but no
  // location columns yet either. Flip supportsLocation once that migration lands.
  property_manager: {
    roleTable: 'property_manager_profiles',
    roleIdColumn: 'user_id',
    supportsLocation: false,
    extraRows: [{ label: 'Company', key: 'company_name' }],
    extraFormFields: [{ key: 'company_name', label: 'Company name', table: 'role', type: 'text' }],
  },

  // TODO: I don't have seller_profiles' columns confirmed — fill in
  // extraRows/extraFormFields once you share the schema. Left table-only
  // (no extra fields) so it doesn't break in the meantime.
  seller: {
    roleTable: 'seller_profiles',
    roleIdColumn: 'user_id',
    supportsLocation: false,
    extraRows: [],
    extraFormFields: [],
  },

  // Lawyer/surveyor/valuer all sit on service_provider_profiles per your
  // schema list, likely differentiated by a `provider_type` or similar column.
  // TODO: confirm exact columns — placeholder shows license_number from
  // `profiles` (already a shared column) as a safe starting point.
  lawyer: {
    roleTable: 'service_provider_profiles',
    roleIdColumn: 'user_id',
    supportsLocation: false,
    extraRows: [{ label: 'License number', key: 'license_number' }],
    extraFormFields: [{ key: 'license_number', label: 'License number', table: 'profiles', type: 'text' }],
  },
  surveyor: {
    roleTable: 'service_provider_profiles',
    roleIdColumn: 'user_id',
    supportsLocation: false,
    extraRows: [{ label: 'License number', key: 'license_number' }],
    extraFormFields: [{ key: 'license_number', label: 'License number', table: 'profiles', type: 'text' }],
  },
  valuer: {
    roleTable: 'service_provider_profiles',
    roleIdColumn: 'user_id',
    supportsLocation: false,
    extraRows: [{ label: 'License number', key: 'license_number' }],
    extraFormFields: [{ key: 'license_number', label: 'License number', table: 'profiles', type: 'text' }],
  },

  // TODO: confirm bank_profiles columns.
  bank: {
    roleTable: 'bank_profiles',
    roleIdColumn: 'user_id',
    supportsLocation: false,
    extraRows: [],
    extraFormFields: [],
  },

  // Buyers have no role-specific table — profiles only.
  buyer: {
    roleTable: null,
    supportsLocation: false,
    extraRows: [],
    extraFormFields: [],
  },
};