import { supabase } from '../lib/supabaseClient'; // adjust to wherever your client actually lives

// Form inputs always send '' for an empty numeric field, but numeric/bigint
// columns reject '' outright (22P02: invalid input syntax for type bigint).
// Anything in this list gets '' -> null before it touches Supabase.
const NUMERIC_FIELDS = [
  'price', 'bedrooms', 'bathrooms', 'parking',
  'size_value', 'floor_count', 'deposit_amount',
];

function sanitizeListingValues(values) {
  const cleaned = { ...values };
  for (const field of NUMERIC_FIELDS) {
    if (cleaned[field] === '' || cleaned[field] === undefined) {
      cleaned[field] = null;
    }
  }
  return cleaned;
}

// All listing rows live under the `marketplace` schema (see ListingFormModal's
// image-removal query for the same pattern). A landlord's own units are
// whatever rows have `seller_id` = the landlord's user id — see the note in
// LandlordDashboard.jsx if that ever changes to a dedicated FK.

export async function fetchLandlordListings(landlordId) {
  const { data, error } = await supabase
    .schema('marketplace')
    .from('listings')
    .select('*')
    .eq('seller_id', landlordId)
    .order('created_at', { ascending: false });

  return { data, error };
}

// Creates a new listing owned by the landlord. Returns { ok, listing, error }
// so the modal can move into its "add photos" step on success.
export async function createLandlordListing(values, landlordId) {
  const payload = { ...sanitizeListingValues(values), seller_id: landlordId, status: 'draft' };

  const { data, error } = await supabase
    .schema('marketplace')
    .from('listings')
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error };
  return { ok: true, listing: data };
}

// Updates an existing listing. If it was previously `active`, moving it back
// to `pending_review` mirrors ListingFormModal's "will return to review" hint.
export async function updateLandlordListing(listingId, values, { wasActive } = {}) {
  const payload = sanitizeListingValues(values);
  if (wasActive) payload.status = 'pending_review';

  const { data, error } = await supabase
    .schema('marketplace')
    .from('listings')
    .update(payload)
    .eq('id', listingId)
    .select()
    .single();

  if (error) return { ok: false, error };
  return { ok: true, listing: data };
}

// "List it myself" from the landlord dashboard cards — moves a draft/rejected
// listing straight to pending_review, no agent involved. Distinct from the
// agent path, which goes through ListingRepresentationPicker instead and
// presumably lands on pending_agent_review on the backend/edge-function side.
export async function submitLandlordListing(listingId) {
  const { data, error } = await supabase
    .schema('marketplace')
    .from('listings')
    .update({ status: 'pending_review' })
    .eq('id', listingId)
    .select()
    .single();

  if (error) return { ok: false, error };
  return { ok: true, listing: data };
}

// --- "Near you" network: agents + property managers -----------------------

// Haversine distance in km between two lat/lng points.
function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius, km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Filters a set of rows (each with location_lat/location_lng) down to those
// within radiusKm of (lat, lng), attaching a distanceKm field, sorted nearest
// first. Rows are expected to already be non-null on location by this point.
function withinRadius(rows, lat, lng, radiusKm) {
  return rows
    .map((r) => ({ ...r, distanceKm: distanceKm(lat, lng, r.location_lat, r.location_lng) }))
    .filter((r) => r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

// Fetches verified agents and verified property managers within radiusKm of
// (lat, lng), which is expected to come from the landlord's device location
// (see useLandlordManagersSection.jsx). Returns both lists pre-sorted by
// distance, plus a single error if either query failed.
//
// ASSUMPTION: agent_profiles has a `verification_status` column using the
// same 'verified' value as property_manager_profiles.verification_status.
// Confirm this in the Table Editor — if agents use a different column
// (e.g. a boolean `is_verified`), adjust the .eq(...) below accordingly.
//
// NOTE: property_manager_profiles needs location_lat / location_lng columns
// added before this will return any managers — see migration snippet
// alongside this file.
export async function fetchNearbyAgentsAndManagers(lat, lng, radiusKm = 80) {
  const [agentsRes, managersRes] = await Promise.all([
    supabase
      .schema('marketplace')
      .from('agent_profiles')
      .select('user_id, agency_name, location_lat, location_lng')
      .eq('verification_status', 'verified')
      .not('location_lat', 'is', null)
      .not('location_lng', 'is', null),
    supabase
      .schema('marketplace')
      .from('property_manager_profiles')
      .select('user_id, company_name, location_lat, location_lng')
      .eq('verification_status', 'verified')
      .not('location_lat', 'is', null)
      .not('location_lng', 'is', null),
  ]);

  if (agentsRes.error) return { agents: [], managers: [], error: agentsRes.error };
  if (managersRes.error) return { agents: [], managers: [], error: managersRes.error };

  return {
    agents: withinRadius(agentsRes.data ?? [], lat, lng, radiusKm),
    managers: withinRadius(managersRes.data ?? [], lat, lng, radiusKm),
    error: null,
  };
}

// --- Full profile for the "near you" modal ---------------------------------

const PROFILE_TABLES = {
  agent: 'agent_profiles',
  manager: 'property_manager_profiles',
};

// Fetches the fuller record for the profile modal opened from a nearby
// agent/manager card (see useLandlordNearbySections.jsx). Merges the base
// `profiles` row with the role-specific row (agent_profiles or
// property_manager_profiles) into one object, so the modal gets identity
// fields (name, avatar, etc.) alongside agency_name/company_name and the
// location_lat/location_lng it needs for the Leaflet pin.
//
// ASSUMPTION: profiles.id === <role table>.user_id, matching the pattern
// the rest of this schema follows. If profiles keys off something else,
// swap the .eq('id', ...) below.
export async function fetchProfileDetail(kind, userId) {
  const table = PROFILE_TABLES[kind];
  if (!table) {
    return { profile: null, error: new Error(`Unknown profile kind: ${kind}`) };
  }

  const [baseRes, roleRes] = await Promise.all([
    supabase.schema('marketplace').from('profiles').select('*').eq('id', userId).single(),
    supabase.schema('marketplace').from(table).select('*').eq('user_id', userId).single(),
  ]);

  if (baseRes.error) return { profile: null, error: baseRes.error };
  if (roleRes.error) return { profile: null, error: roleRes.error };

  // Role row spread last so agency_name/company_name etc. win over anything
  // with the same name on the base profile.
  return { profile: { ...baseRes.data, ...roleRes.data }, error: null };
}