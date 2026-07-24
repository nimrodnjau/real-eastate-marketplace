import { ROLES } from '../components/RoleSelector';

// Only "property_manager" has an underscore — turn it into a URL-friendly
// hyphen for the route, and back again when reading the route param.
export const roleToSlug = (role) => role.replace(/_/g, '-');
export const slugToRole = (slug) => slug.replace(/-/g, '_');

// Single source of truth for building dashboard routes + nav, derived from
// the same ROLES array used on the signup / select-role screens.
export const DASHBOARD_ROLES = ROLES.map((r) => ({
  role: r.value,
  slug: roleToSlug(r.value),
  label: r.label,
}));