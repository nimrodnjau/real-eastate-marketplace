
// src/lib/conversations.js
//
// Shared conversation helpers — extracted from MessagesSection.jsx's
// startConversationWithUser/handleSend so Stage1Connect (and anywhere else
// that needs to start or post into a conversation) can reuse the exact
// same find-or-create + insert logic instead of re-implementing it.

/**
 * Finds an existing conversation between two users (optionally scoped to a
 * listing), or creates one. Mirrors startConversationWithUser's dedupe
 * logic, including the 23505/409 race-condition fallback.
 *
 * @returns {Promise<string>} conversationId
 */
export async function findOrCreateConversation(supabase, userIdA, userIdB, listingId = null) {
  if (!userIdA || !userIdB || userIdA === userIdB) {
    throw new Error('findOrCreateConversation requires two distinct user ids');
  }

  const [a, b] = [userIdA, userIdB].sort();

  let query = supabase
    .schema('marketplace')
    .from('conversations')
    .select('id, participant_one, participant_two')
    .eq('participant_one', a)
    .eq('participant_two', b);

  if (listingId) query = query.eq('listing_id', listingId);

  const { data: existing, error: findError } = await query.maybeSingle();
  if (findError && findError.code !== 'PGRST116') throw findError;
  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await supabase
    .schema('marketplace')
    .from('conversations')
    .insert({ participant_one: a, participant_two: b, listing_id: listingId || null })
    .select('id')
    .single();

  if (!createError) return created.id;

  // Race: someone else created the same (a, b[, listing]) row between our
  // check and our insert. Re-fetch instead of failing.
  if (createError.code === '23505' || createError.status === 409) {
    const { data: retry } = await supabase
      .schema('marketplace')
      .from('conversations')
      .select('id')
      .eq('participant_one', a)
      .eq('participant_two', b)
      .maybeSingle();
    if (retry?.id) return retry.id;
  }

  throw createError;
}

/** Reads a conversation id without creating one. Returns null if none exists. */
export async function findConversation(supabase, userIdA, userIdB, listingId = null) {
  const [a, b] = [userIdA, userIdB].sort();
  let query = supabase
    .schema('marketplace')
    .from('conversations')
    .select('id')
    .eq('participant_one', a)
    .eq('participant_two', b);
  if (listingId) query = query.eq('listing_id', listingId);
  const { data, error } = await query.maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.id || null;
}

/** Inserts a plain text message. Mirrors MessagesSection's handleSend insert. */
export async function sendTextMessage(supabase, conversationId, senderId, body) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('sendTextMessage requires a non-empty body');

  const { data, error } = await supabase
    .schema('marketplace')
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/** Whether senderId has posted at least one message in this conversation. */
export async function hasSentMessage(supabase, conversationId, senderId) {
  if (!conversationId) return false;
  const { data, error } = await supabase
    .schema('marketplace')
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('sender_id', senderId)
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

/**
 * Fire-and-forget push notification, matching the one MessagesSection sends
 * after a successful insert. Never throws — a push failure shouldn't block
 * the send flow.
 */
export function notifyNewMessage(supabase, { recipientId, senderName, body }) {
  supabase.functions
    .invoke('send-push', {
      body: {
        user_id: recipientId,
        title: senderName ? `New message from ${senderName}` : 'New message',
        body,
        url: '/dashboard/messages',
      },
    })
    .catch((err) => console.error('Push notification failed:', err));
}