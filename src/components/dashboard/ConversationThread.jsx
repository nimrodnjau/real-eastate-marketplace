// src/components/dashboard/ConversationThread.jsx
//
// Embeddable single-conversation chat pane — a lean extraction of
// MessagesSection.jsx's "messaging-chat-pane" (message list + realtime
// subscription + send box), without the sidebar/conversation-list/search
// UI, so it can drop into a StageWindow's messagesSlot (Stage1Connect and
// friends) instead of navigating to the full /dashboard/messages screen.
//
// Attachments are intentionally left out for now — MessagesSection's
// document-attachment flow can be layered on later the same way it's done
// there, if a stage needs it.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Check, CheckCheck } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { findOrCreateConversation, sendTextMessage, notifyNewMessage } from '../../lib/conversations';
import '../../styles/messaging-attachments.css'; // reuses the same bubble/row classes as MessagesSection

const PAGE_SIZE = 50;
const READ_TICK_COLOR = '#34b7f1';

function formatMessageTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * @param {string} viewerId - current user's id
 * @param {string} viewerName - current user's display name, for push notifications
 * @param {string} otherUserId - the other participant's id
 * @param {string} otherUserName - the other participant's display name, for the header
 * @param {string} [listingId] - scopes the conversation to a specific listing
 * @param {string|null} [conversationId] - pass this once known to skip the find step
 * @param {(conversationId: string) => void} [onConversationReady] - called once we have an id (created or found)
 */
export default function ConversationThread({
  viewerId,
  viewerName,
  otherUserId,
  otherUserName,
  listingId = null,
  conversationId: conversationIdProp = null,
  onConversationReady,
}) {
  const [conversationId, setConversationId] = useState(conversationIdProp);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);

  // Resolve the conversation id if we weren't handed one — mirrors
  // startConversationWithUser, but read/create only, no navigation.
  useEffect(() => {
    let cancelled = false;
    if (conversationIdProp) {
      setConversationId(conversationIdProp);
      return;
    }
    if (!viewerId || !otherUserId) return;

    (async () => {
      try {
        const id = await findOrCreateConversation(supabase, viewerId, otherUserId, listingId);
        if (!cancelled) {
          setConversationId(id);
          onConversationReady?.(id);
        }
      } catch (err) {
        console.error('Failed to resolve conversation:', err);
        if (!cancelled) setError("Couldn't load this conversation.");
      }
    })();

    return () => { cancelled = true; };
  }, [conversationIdProp, viewerId, otherUserId, listingId, onConversationReady]);

  // Load history + subscribe, same pattern as MessagesSection's
  // per-conversation effect (INSERT/UPDATE postgres_changes).
  useEffect(() => {
    if (!conversationId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    async function loadInitial() {
      const { data, error: fetchError } = await supabase
        .schema('marketplace')
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;
      if (fetchError) {
        console.error('Failed to load messages:', fetchError);
        setError("Couldn't load messages.");
      } else {
        setMessages((data || []).slice().reverse());
      }
      setLoading(false);
    }
    loadInitial();

    async function markRead() {
      await supabase
        .schema('marketplace')
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', viewerId)
        .is('read_at', null);
    }
    markRead();

    const channel = supabase
      .channel(`stage-messages-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'marketplace', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          if (payload.new.sender_id !== viewerId) markRead();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'marketplace', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, viewerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setDraft('');
    setError('');

    try {
      let id = conversationId;
      if (!id) {
        id = await findOrCreateConversation(supabase, viewerId, otherUserId, listingId);
        setConversationId(id);
        onConversationReady?.(id);
      }
      await sendTextMessage(supabase, id, viewerId, body);
      notifyNewMessage(supabase, { recipientId: otherUserId, senderName: viewerName, body });
    } catch (err) {
      console.error('Failed to send message:', err);
      setDraft(body);
      setError("Couldn't send that — try again.");
    }
    setSending(false);
  }, [draft, sending, conversationId, viewerId, otherUserId, listingId, viewerName, onConversationReady]);

  return (
    <div className="messaging-shell messaging-shell--embedded">
      <div className="messaging-chat-pane">
        <div className="messaging-chat-header">
          <div>
            <p className="messaging-chat-header-name">{otherUserName || 'Conversation'}</p>
          </div>
        </div>

        <div className="messaging-messages">
          {loading ? (
            <p className="agent-picker-empty">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="agent-picker-empty">No messages yet — say hello.</p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === viewerId;
              return (
                <div key={m.id} className={`messaging-bubble-row ${mine ? 'messaging-bubble-row--mine' : ''}`}>
                  <div className={`messaging-bubble ${mine ? 'messaging-bubble--mine' : ''}`}>
                    <p className="messaging-bubble-text">{m.body}</p>
                    <span className="messaging-bubble-time">
                      {formatMessageTime(m.created_at)}
                      {mine && (m.read_at
                        ? <CheckCheck size={13} color={READ_TICK_COLOR} />
                        : <Check size={13} />)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && <p className="messaging-attach-error">{error}</p>}

        <form className="messaging-input-row" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Type a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" disabled={!draft.trim() || sending} aria-label="Send">
            <Send size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}