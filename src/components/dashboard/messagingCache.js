// components/dashboard/messagingCache.js
// Module-level (not component state) so it survives switching dashboard
// tabs and remounting MessagesSection — cleared only on a full page reload.
// If you want it to survive reloads too, swap the Maps below for
// sessionStorage/localStorage reads+writes with JSON.stringify.

const conversationsCache = new Map(); // userId -> conversations array
const messagesCache = new Map();      // conversationId -> { messages, hasMoreOlder }

export function getCachedConversations(userId) {
  return conversationsCache.get(userId) || null;
}

export function setCachedConversations(userId, conversations) {
  conversationsCache.set(userId, conversations);
}

export function getCachedMessages(conversationId) {
  return messagesCache.get(conversationId) || null;
}

export function setCachedMessages(conversationId, messages, hasMoreOlder) {
  messagesCache.set(conversationId, { messages, hasMoreOlder });
}