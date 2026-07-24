// components/dashboard/ProfessionalsSection.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Send, X, Scale, Ruler, Landmark, ClipboardCheck, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

// Add roles here as the platform onboards more professional types —
// everything else (filters, icons, labels) reads from this one map.
const ROLE_META = {
  valuer:   { label: 'Valuers',   icon: ClipboardCheck },
  lawyer:   { label: 'Lawyers',   icon: Scale },
  surveyor: { label: 'Surveyors', icon: Ruler },
  bank:     { label: 'Banks',     icon: Landmark },
};
const PROFESSIONAL_ROLES = Object.keys(ROLE_META);

function formatMessageTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ProfessionalsSection() {
  const { profile } = useAuth();

  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [query, setQuery] = useState('');

  // ---- Inline chat panel ----
  const [activeChat, setActiveChat] = useState(null); // { conversationId, otherUser }
  const [openingChatFor, setOpeningChatFor] = useState(null); // professional id currently being opened
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);

  const fetchProfessionals = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('profiles')
      .select('id, full_name, avatar_url, role, agency_name, phone, email')
      .in('role', PROFESSIONAL_ROLES)
      .order('full_name');

    if (error) {
      setError(error.message);
    } else {
      setProfessionals(data || []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfessionals(); }, [fetchProfessionals]);

  const filtered = professionals.filter((p) => {
    if (roleFilter !== 'all' && p.role !== roleFilter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.agency_name?.toLowerCase().includes(q)
    );
  });

  const roleCounts = professionals.reduce((acc, p) => {
    acc[p.role] = (acc[p.role] || 0) + 1;
    return acc;
  }, {});

  // Same find-or-create shape as MessagesSection's startConversation, so
  // any chat opened here is a normal conversation there too — same
  // participant_one/two ordering convention (lower id first).
  async function openChat(person) {
    if (!profile?.id) return;
    setOpeningChatFor(person.id);

    const [a, b] = [profile.id, person.id].sort();
    const { data: existing } = await supabase
      .schema('marketplace')
      .from('conversations')
      .select('id')
      .eq('participant_one', a)
      .eq('participant_two', b)
      .maybeSingle();

    let conversationId = existing?.id;

    if (!conversationId) {
      const { data: created, error } = await supabase
        .schema('marketplace')
        .from('conversations')
        .insert({ participant_one: a, participant_two: b })
        .select('id')
        .single();
      if (error) {
        console.error('Failed to start conversation:', error);
        setOpeningChatFor(null);
        return;
      }
      conversationId = created.id;
    }

    setOpeningChatFor(null);
    setActiveChat({ conversationId, otherUser: person });
  }

  function closeChat() {
    setActiveChat(null);
    setMessages([]);
    setDraft('');
  }

  useEffect(() => {
    if (!activeChat?.conversationId) return;

    setMessagesLoading(true);
    supabase
      .schema('marketplace')
      .from('messages')
      .select('*')
      .eq('conversation_id', activeChat.conversationId)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data, error }) => {
        if (!error) setMessages(data || []);
        setMessagesLoading(false);
      });

    const channel = supabase
      .channel(`professional-chat-${activeChat.conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'marketplace',
          table: 'messages',
          filter: `conversation_id=eq.${activeChat.conversationId}`,
        },
        (payload) => setMessages((prev) => [...prev, payload.new]),
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [activeChat?.conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !activeChat?.conversationId || sending) return;

    setSending(true);
    setDraft('');
    const { error } = await supabase
      .schema('marketplace')
      .from('messages')
      .insert({ conversation_id: activeChat.conversationId, sender_id: profile.id, body });
    setSending(false);

    if (error) {
      console.error('Failed to send message:', error);
      setDraft(body);
    }
  }

  return (
    <div className="professionals-section">
      <div className="professionals-toolbar">
        <div className="professionals-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search by name or company…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="professionals-role-filters">
        <button
          type="button"
          className={`professionals-role-chip ${roleFilter === 'all' ? 'professionals-role-chip--active' : ''}`}
          onClick={() => setRoleFilter('all')}
        >
          <Users size={14} /> All
        </button>
        {PROFESSIONAL_ROLES.map((role) => {
          const meta = ROLE_META[role];
          const RoleIcon = meta.icon;
          return (
            <button
              type="button"
              key={role}
              className={`professionals-role-chip ${roleFilter === role ? 'professionals-role-chip--active' : ''}`}
              onClick={() => setRoleFilter(role)}
            >
              <RoleIcon size={14} /> {meta.label}
              {roleCounts[role] ? <span className="professionals-role-count">{roleCounts[role]}</span> : null}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="agent-picker-empty">Loading professionals…</p>
      ) : error ? (
        <p className="dashboard-error">Couldn't load professionals: {error}</p>
      ) : filtered.length === 0 ? (
        <p className="dashboard-empty">No professionals match that search.</p>
      ) : (
        <div className="professionals-grid">
          {filtered.map((p) => {
            const meta = ROLE_META[p.role] || {};
            const RoleIcon = meta.icon || Users;
            return (
              <div key={p.id} className="professional-card">
                <img
                  className="professional-avatar"
                  src={p.avatar_url || 'https://placehold.co/48x48?text=%20'}
                  alt=""
                />
                <div className="professional-card-body">
                  <p className="professional-name">{p.full_name || 'Unnamed'}</p>
                  <p className="professional-meta">
                    <RoleIcon size={12} /> {meta.label ? meta.label.replace(/s$/, '') : p.role}
                    {p.agency_name ? ` · ${p.agency_name}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="professional-message-btn"
                  onClick={() => openChat(p)}
                  disabled={openingChatFor === p.id}
                >
                  {openingChatFor === p.id ? 'Opening…' : 'Message'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {activeChat && (
        <div className="prof-chat-overlay" onClick={closeChat}>
          <div className="prof-chat-panel" onClick={(e) => e.stopPropagation()}>
            <div className="prof-chat-header">
              <img
                className="professional-avatar"
                src={activeChat.otherUser?.avatar_url || 'https://placehold.co/48x48?text=%20'}
                alt=""
              />
              <div className="prof-chat-header-text">
                <p className="professional-name">{activeChat.otherUser?.full_name || 'User'}</p>
                <p className="professional-meta">
                  {ROLE_META[activeChat.otherUser?.role]?.label?.replace(/s$/, '') || activeChat.otherUser?.role}
                </p>
              </div>
              <button type="button" className="prof-chat-close-btn" onClick={closeChat} aria-label="Close chat">
                <X size={18} />
              </button>
            </div>

            <div className="prof-chat-messages">
              {messagesLoading ? (
                <p className="agent-picker-empty">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="agent-picker-empty">No messages yet — say hello.</p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === profile.id;
                  return (
                    <div key={m.id} className={`prof-chat-bubble-row ${mine ? 'prof-chat-bubble-row--mine' : ''}`}>
                      <div className={`prof-chat-bubble ${mine ? 'prof-chat-bubble--mine' : ''}`}>
                        <p className="prof-chat-bubble-text">{m.body}</p>
                        <span className="prof-chat-bubble-time">{formatMessageTime(m.created_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="prof-chat-input-row" onSubmit={handleSend}>
              <input
                type="text"
                placeholder="Type a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Send">
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}