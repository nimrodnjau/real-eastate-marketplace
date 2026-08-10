// api/landlordManagementAssignments.js
//
// Portfolio-wide "hand off all my units" requests — separate from the
// per-listing representation requests in api/landlordDashboard.js.
// See add_management_assignments_table.sql for the schema this expects.

import { supabase } from '../lib/supabaseClient';

/**
 * Landlord requests that an agent or property manager take over managing
 * all of their units. The assignee must accept elsewhere (their own
 * dashboard) before anything is actually applied to listings.
 */
export async function requestPortfolioManagement(landlordId, assigneeId, assigneeKind, message = null) {
  if (!landlordId || !assigneeId || !assigneeKind) {
    return { ok: false, error: { message: 'Missing required fields.' } };
  }
  if (assigneeKind !== 'agent' && assigneeKind !== 'manager') {
    return { ok: false, error: { message: 'assigneeKind must be "agent" or "manager".' } };
  }
  if (landlordId === assigneeId) {
    return { ok: false, error: { message: 'You can\u2019t request yourself.' } };
  }

  const { data, error } = await supabase
    .schema('marketplace')
    .from('management_assignments')
    .insert({
      landlord_id: landlordId,
      assignee_id: assigneeId,
      assignee_kind: assigneeKind,
      message,
    })
    .select('*')
    .single();

  if (error) {
    // Unique-pending-index collision — a request to this person is already pending.
    if (error.code === '23505') {
      return { ok: false, error: { message: 'You already have a pending request with this person.' } };
    }
    return { ok: false, error };
  }

  return { ok: true, assignment: data };
}

/** All portfolio requests a landlord has sent, most recent first. */
export async function fetchPortfolioManagementRequests(landlordId) {
  if (!landlordId) return { data: [], error: null };

  const { data, error } = await supabase
    .schema('marketplace')
    .from('management_assignments')
    .select(`
      id, assignee_id, assignee_kind, status, message, requested_at, responded_at,
      assignee:profiles!fk_portfolio_mgmt_assignee_profile(id, full_name, avatar_url, agency_name, company_name)
    `)
    .eq('landlord_id', landlordId)
    .order('requested_at', { ascending: false });

  return { data: data ?? [], error };
}

/** Landlord withdraws a request that hasn't been responded to yet. */
export async function cancelPortfolioManagementRequest(requestId) {
  if (!requestId) return { ok: false, error: { message: 'Missing request id.' } };

  const { error } = await supabase
    .schema('marketplace')
    .from('management_assignments')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending');

  return { ok: !error, error };
}