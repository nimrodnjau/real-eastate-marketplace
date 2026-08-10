// components/stages/StageMessagePanel.jsx
//
// Compact, embeddable chat thread used inside every stage window's
// "Messages" toggle. This is deliberately NOT the full MessagesSection
// inbox (sidebar + search + attachments + typing indicators) — that's a
// separate full-page surface. This is a scoped-down thread for "the
// conversation about this stage, with this counterpart," which is what
// "reuse the message section in all the stages" means in practice: same
// visual language and send behavior, embedded rather than a whole inbox.
//
// TODO(db): wire to real data once conversations exist for this
// transaction:
//   1. On mount, call marketplace.get_or_create_conversation(
//        p_transaction_id: transactionId,
//        p_other_user_id: counterpart.id,
//        p_listing_id: listingId
//      ) to get a conversation id — OR, if the schema stays
//      participant_one/participant_two (per MessagesSection.jsx), do the
//      same find-or-create query that startConversationWithUser() does.
//   2. Subscribe to `messages` INSERT/UPDATE via a postgres_changes
//      channel scoped to that conversation_id, same pattern as
//      MessagesSection's per-conversation channel.
//   3. handleSend below should insert into marketplace.messages the same
//      way MessagesSection.handleSend does, instead of pushing to local
//      state.
// Until then this renders mock messages passed in as props so the stage
// windows are reviewable end-to-end.

import { useState } from 'react';
import { Send } from 'lucide-react';
import '../../styles/stage-message-panel.css';

export default function StageMessagePanel({
  counterpart, // { name, role } — who this thread is with
  viewerId,
  mockMessages = [],
}) {
  const [messages, setMessages] = useState(mockMessages);
  const [draft, setDraft] = useState('');

  function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;

    // TODO(db): replace with a real insert into marketplace.messages,
    // as noted above — this only updates local state for now.
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, senderId: viewerId, body, createdAt: new Date().toISOString() },
    ]);
    setDraft('');
  }

  return (
    <div className="stage-message-panel">
      <div className="stage-message-panel-header">
        <p className="stage-message-panel-with">
          Conversation with <strong>{counterpart?.name || 'the other party'}</strong>
          {counterpart?.role && <span className="stage-message-panel-role"> · {counterpart.role}</span>}
        </p>
      </div>

      <div className="stage-message-panel-thread">
        {messages.length === 0 ? (
          <p className="stage-empty">No messages yet in this thread.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === viewerId;
            return (
              <div key={m.id} className={`stage-message-row ${mine ? 'stage-message-row--mine' : ''}`}>
                <div className={`stage-message-bubble ${mine ? 'stage-message-bubble--mine' : ''}`}>
                  <p>{m.body}</p>
                  <span className="stage-message-time">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form className="stage-message-panel-input" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Write a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={!draft.trim()} aria-label="Send">
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}