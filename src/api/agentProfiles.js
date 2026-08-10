// Supabase queries backing the "view profile" panel opened from a rep card
// in ListingRepresentationPicker.
//
// ASSUMPTIONS:
// 1. Supabase client at '../lib/supabaseClient' exporting `supabase`.
// 2. .schema('marketplace') used explicitly, same as listingRequests.js.
// 3. MANAGING_STATUS below is a guess at the "currently representing" status
//    literal on listing_agent_requests / listing_manager_requests — adjust
//    if your actual enum uses something else (e.g. 'active').
// 4. property_manager_profiles has no location_lat/location_lng today (only
//    agent_profiles does) — location_lat/lng will be null for managers until
//    that column exists, and callers should handle that gracefully.
import { supabase } from '../lib/supabaseClient';

const PROFILE_TABLES = {
  agent: 'agent_profiles',
  manager: 'property_manager_profiles',
};

const REQUEST_TABLES = {
  agent: 'listing_agent_requests',
  manager: 'listing_manager_requests',
};

const PARTY_COLUMN = {
  agent: 'agent_id',
  manager: 'manager_id',
};

const MANAGING_STATUS = 'accepted'; // <-- confirm this matches your real status enum

// Full profile detail: shared `profiles` columns (contact info, bio, overall
// rating) plus whatever the role-specific table adds (agency_name/
// company_name, location for agents).
export async function fetchRepresentativeProfile(userId, role) {
  const roleTable = PROFILE_TABLES[role];

  const [{ data: profile, error: profileError }, { data: roleRow, error: roleError }] = await Promise.all([
    supabase
      .schema('marketplace')
      .from('profiles')
      .select('id, full_name, avatar_url, bio, phone, email, rating_avg, rating_count, license_number')
      .eq('id', userId)
      .single(),
    supabase
      .schema('marketplace')
      .from(roleTable)
      .select('*')
      .eq('user_id', userId)
      .single(),
  ]);

  if (profileError) throw profileError;
  if (roleError) throw roleError;

  return {
    ...profile,
    agency_name: roleRow.agency_name ?? null,     // agents only
    company_name: roleRow.company_name ?? null,   // managers only
    location_lat: roleRow.location_lat ?? null,   // agents only, for now
    location_lng: roleRow.location_lng ?? null,
    verification_status: roleRow.verification_status,
  };
}

// Only agents have a reviews table today (marketplace.agent_reviews) —
// there's no manager equivalent, so callers should skip this for
// role === 'manager' rather than call it.
export async function fetchAgentReviews(agentId) {
  const { data, error } = await supabase
    .schema('marketplace')
    .from('agent_reviews')
    .select('id, rating, comment, created_at, buyer:buyer_id ( full_name, avatar_url )')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// How many listings this agent/manager is currently representing.
export async function fetchManagedPropertiesCount(userId, role) {
  const { count, error } = await supabase
    .schema('marketplace')
    .from(REQUEST_TABLES[role])
    .select('listing_id', { count: 'exact', head: true })
    .eq(PARTY_COLUMN[role], userId)
    .eq('status', MANAGING_STATUS);

  if (error) throw error;
  return count ?? 0;
}
// ASSUMPTIONS — adjust if your project differs:
// - Confirm the exact name of the parallel property-manager requests table
//   (assumed `listing_manager_requests` with `manager_id` + `status` here —
//   this is the table from the "add a parallel table" decision, but I don't
//   have its final name) and the exact "accepted" status value.
// - select('*') on purpose: I only have confirmed columns for
//   agent_id/seller_id/status/reviewed_by/reviewed_at/rejection_reason/
//   agent_decision_note/view_count on listings — not title/price — so the
//   panel reads those defensively rather than assuming exact names.
const ACCEPTED_STATUS = 'accepted';

export async function fetchRepresentativeListings(userId, role) {
  if (role === 'agent') {
    const { data, error } = await supabase
      .schema('marketplace')
      .from('listings')
      .select('*')
      .eq('agent_id', userId);
    if (error) throw error;
    return data ?? [];
  }

  // Property manager — listings has no manager column, so go through the
  // parallel requests table instead.
  const { data: requests, error: reqError } = await supabase
    .schema('marketplace')
    .from('listing_manager_requests')
    .select('listing_id')
    .eq('manager_id', userId)
    .eq('status', ACCEPTED_STATUS);
  if (reqError) throw reqError;
  if (!requests?.length) return [];

  const { data, error } = await supabase
    .schema('marketplace')
    .from('listings')
    .select('*')
    .in('id', requests.map((r) => r.listing_id));
  if (error) throw error;
  return data ?? [];
}