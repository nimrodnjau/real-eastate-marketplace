// Supabase queries for connecting a listing to an agent or property manager.
//
// ASSUMPTIONS — adjust if your project differs:
// 1. Supabase client lives at '../lib/supabaseClient' exporting `supabase`.
// 2. The marketplace schema isn't the client's default, so calls use
//    .schema('marketplace') explicitly. Drop that if your client is already
//    schema-scoped.
// 3. agent_profiles / property_manager_profiles each have `user_id` as their
//    primary key AND the FK to marketplace.profiles.id — there is no
//    `profile_id` column on either table. `profile_id` in the data returned
//    from here is just an alias we add for the picker component, not a real
//    column anywhere.
// 4. bio / rating / license_number all live on marketplace.profiles, not on
//    agent_profiles or property_manager_profiles (property_manager_profiles
//    doesn't have its own versions of these at all).
import { supabase } from '../lib/supabaseClient';

const REQUEST_TABLES = {
  agent: 'listing_agent_requests',
  manager: 'listing_manager_requests',
};

const PARTY_COLUMN = {
  agent: 'agent_id',
  manager: 'manager_id',
};

const PROFILE_TABLES = {
  agent: 'agent_profiles',
  manager: 'property_manager_profiles',
};

// Verified agents or property managers a landlord can request.
// Placeholder ordering by rating — swap for proximity/search once that's wired up.
export async function fetchRepresentatives(role) {
  const { data, error } = await supabase
    .schema('marketplace')
    .from(PROFILE_TABLES[role])
    .select(`
      user_id,
      verification_status,
      profiles:user_id ( full_name, avatar_url, bio, rating_avg, license_number )
    `)
    .eq('verification_status', 'verified')
    .order('rating_avg', { ascending: false, foreignTable: 'profiles' });

  if (error) throw error;

  // Flatten to the shape ListingRepresentationPicker already expects, so
  // that component doesn't need to change. `id` and `profile_id` are the
  // same value here — user_id IS the profiles.id via the FK.
  return (data || []).map((row) => ({
    id: row.user_id,
    profile_id: row.user_id,
    bio: row.profiles?.bio ?? null,
    rating: row.profiles?.rating_avg ?? null,
    license_number: row.profiles?.license_number ?? null,
    profiles: {
      full_name: row.profiles?.full_name ?? null,
      avatar_url: row.profiles?.avatar_url ?? null,
    },
  }));
}

// Send a representation request for a specific listing.
// profileId here is marketplace.profiles.id, which is the same value as
// agent_profiles.user_id / property_manager_profiles.user_id (see the
// flattening in fetchRepresentatives above).
export async function requestRepresentation(listingId, profileId, role) {
  const { data, error } = await supabase
    .schema('marketplace')
    .from(REQUEST_TABLES[role])
    .insert({ listing_id: listingId, [PARTY_COLUMN[role]]: profileId })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique (listing_id, agent_id/manager_id) constraint hit.
      throw new Error('You already have a request with this contact for this listing.');
    }
    throw error;
  }
  return data;
}

// Existing requests for a listing, so the picker can show "Requested" /
// "Accepted" instead of letting the landlord send a duplicate.
export async function fetchListingRequests(listingId) {
  const [agentRes, managerRes] = await Promise.all([
    supabase.schema('marketplace').from('listing_agent_requests').select('*').eq('listing_id', listingId),
    supabase.schema('marketplace').from('listing_manager_requests').select('*').eq('listing_id', listingId),
  ]);

  if (agentRes.error) throw agentRes.error;
  if (managerRes.error) throw managerRes.error;

  return { agent: agentRes.data, manager: managerRes.data };
}