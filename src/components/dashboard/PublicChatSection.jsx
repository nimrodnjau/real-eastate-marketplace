import { useState, useEffect, useRef, useCallback, useMemo, memo, Fragment } from 'react';
import { CornerUpLeft, X, Send, ChevronUp, AtSign } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const MAX_LEN = 1000;
const PAGE_SIZE = 50;

// Matches embedded mention tokens as stored in the DB: @[Full Name](uuid)
const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/g;

// ---------------------------------------------------------------------------
// Module-scoped caches — survive unmount/remount so returning to /community
// doesn't refetch everything from zero.
// ---------------------------------------------------------------------------
let messageCache = null;
const authorCache = new Map();

function cacheAuthorsFromMessages(msgs) {
  for (const m of msgs) {
    if (m.author) authorCache.set(m.user_id, m.author);
    if (m.reply_to?.author && m.reply_to?.user_id) authorCache.set(m.reply_to.user_id, m.reply_to.author);
  }
}

const SELECT_FIELDS = `
  id, content, created_at, user_id, mentioned_user_ids,
  author:profiles!public_chat_messages_user_id_fkey(id, full_name, role),
  reply_to:reply_to_id(
    id, content, user_id,
    author:profiles!public_chat_messages_user_id_fkey(id, full_name)
  )
`;

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

// Turns "hey @[Amina Yusuf](uuid) check this" into styled inline nodes for
// display in a sent message bubble. currentUserId gives mentions-of-you
// extra visual weight.
function renderContentWithMentions(content, currentUserId) {
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  MENTION_TOKEN_RE.lastIndex = 0;
  while ((match = MENTION_TOKEN_RE.exec(content)) !== null) {
    const [full, name, userId] = match;
    if (match.index > lastIndex) parts.push(<Fragment key={key++}>{content.slice(lastIndex, match.index)}</Fragment>);
    parts.push(
      <span key={key++} className={`chat-mention${userId === currentUserId ? ' chat-mention--me' : ''}`}>
        @{name}
      </span>
    );
    lastIndex = match.index + full.length;
  }
  if (lastIndex < content.length) parts.push(<Fragment key={key++}>{content.slice(lastIndex)}</Fragment>);
  return parts;
}

// Strips mention tokens down to plain "@Name" for quoted-reply previews.
function plainTextPreview(content) {
  return content.replace(MENTION_TOKEN_RE, '@$1');
}

// ---------------------------------------------------------------------------
// Converts the composer's CLEAN display text (e.g. "hey @Amina Yusuf check
// this") into the DB-storage format with hidden tokens (e.g.
// "hey @[Amina Yusuf](uuid) check this"), using the list of mentions that
// were actually inserted via the autocomplete dropdown (in insertion order).
//
// Scans left-to-right once; at each "@" tries to match the earliest
// still-unconsumed mention whose name appears there (with a word boundary
// right after it), consumes it, and moves on. Any inserted mention whose
// name text was since deleted/edited by the user simply won't be found and
// is silently dropped — no UUID ever touches what the user sees or edits.
// ---------------------------------------------------------------------------
function buildStoredContent(displayText, insertedMentions) {
  const remaining = [...insertedMentions]; // [{ id, name }], consumed as matched
  let result = '';
  let i = 0;
  const mentionedIds = [];

  while (i < displayText.length) {
    if (displayText[i] === '@') {
      let matchIdx = -1;
      for (let r = 0; r < remaining.length; r++) {
        const name = remaining[r].name;
        if (displayText.startsWith('@' + name, i)) {
          const after = displayText[i + 1 + name.length];
          if (after === undefined || /[^\w]/.test(after)) {
            matchIdx = r;
            break;
          }
        }
      }
      if (matchIdx !== -1) {
        const { id, name } = remaining[matchIdx];
        result += `@[${name}](${id})`;
        mentionedIds.push(id);
        i += 1 + name.length;
        remaining.splice(matchIdx, 1);
        continue;
      }
    }
    result += displayText[i];
    i += 1;
  }

  return { content: result, mentionedUserIds: [...new Set(mentionedIds)] };
}

// ---------------------------------------------------------------------------
const ChatBubble = memo(function ChatBubble({ message, isOwn, currentUserId, onReply }) {
  return (
    <div className={`chat-bubble-row ${isOwn ? 'chat-bubble-row--own' : ''}`}>
      <div className={`chat-bubble ${isOwn ? 'chat-bubble--own' : ''}`}>
        {!isOwn && (
          <p className="chat-bubble-author">
            {message.author?.full_name || 'Unknown user'}
            {message.author?.role && <span className="chat-bubble-role"> · {message.author.role}</span>}
          </p>
        )}
        {message.reply_to && (
          <div className="chat-bubble-quote">
            <p className="chat-bubble-quote-author">{message.reply_to.author?.full_name || 'Unknown user'}</p>
            <p className="chat-bubble-quote-text">{plainTextPreview(message.reply_to.content)}</p>
          </div>
        )}
        <p className="chat-bubble-text">{renderContentWithMentions(message.content, currentUserId)}</p>
        <div className="chat-bubble-footer">
          <span className="chat-bubble-time">{timeLabel(message.created_at)}</span>
          <button type="button" className="chat-bubble-reply-btn" onClick={() => onReply(message)}>
            <CornerUpLeft size={12} /> Reply
          </button>
        </div>
      </div>
    </div>
  );
}, (prev, next) => prev.message === next.message && prev.isOwn === next.isOwn);

export default function PublicChatSection() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState(() => messageCache || []);
  const [loading, setLoading] = useState(messageCache === null);
  const [loadError, setLoadError] = useState(null);
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mentionToast, setMentionToast] = useState(null);

  // ---- Mention autocomplete state ----
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  // Every mention inserted via the dropdown this draft, in insertion order.
  // The composer text itself stays clean ("@Full Name") — this list is what
  // lets buildStoredContent() recover the hidden user ids at send time.
  const [insertedMentions, setInsertedMentions] = useState([]); // [{ id, name }]

  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    messageCache = messages;
    cacheAuthorsFromMessages(messages);
  }, [messages]);

  async function fetchAuthor(userId) {
    if (authorCache.has(userId)) return authorCache.get(userId);
    const { data } = await supabase
      .schema('marketplace')
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .maybeSingle();
    if (data) authorCache.set(userId, data);
    return data || null;
  }

  const enrichFromCacheOrFetch = useCallback(async (row) => {
    let replyTo = null;
    if (row.reply_to_id) {
      const { data: quoted } = await supabase
        .schema('marketplace')
        .from('public_chat_messages')
        .select('id, content, user_id')
        .eq('id', row.reply_to_id)
        .maybeSingle();
      if (quoted) {
        const quotedAuthor = await fetchAuthor(quoted.user_id);
        replyTo = { ...quoted, author: quotedAuthor };
      }
    }
    const author = await fetchAuthor(row.user_id);
    return { ...row, author, reply_to: replyTo };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .schema('marketplace')
        .from('public_chat_messages')
        .select(SELECT_FIELDS)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
      } else {
        const ordered = [...(data || [])].reverse();
        setMessages(ordered);
        setHasMore((data || []).length === PAGE_SIZE);
        setLoadError(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const loadOlder = useCallback(async () => {
    if (!messages.length || loadingMore) return;
    setLoadingMore(true);
    const oldest = messages[0].created_at;
    const { data, error } = await supabase
      .schema('marketplace')
      .from('public_chat_messages')
      .select(SELECT_FIELDS)
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data) {
      const older = [...data].reverse();
      const el = listRef.current;
      const prevHeight = el?.scrollHeight || 0;
      setMessages((prev) => [...older, ...prev]);
      setHasMore(data.length === PAGE_SIZE);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
    setLoadingMore(false);
  }, [messages, loadingMore]);

  // Realtime subscription — also fires the mention toast when relevant.
  useEffect(() => {
    const channel = supabase
      .channel('public-chat-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'marketplace', table: 'public_chat_messages' },
        async (payload) => {
          const row = payload.new;
          try {
            const enriched = await enrichFromCacheOrFetch(row);
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, enriched]));

            const iWasMentioned =
              profile?.id &&
              enriched.user_id !== profile.id &&
              Array.isArray(enriched.mentioned_user_ids) &&
              enriched.mentioned_user_ids.includes(profile.id);

            if (iWasMentioned) {
              clearTimeout(toastTimerRef.current);
              setMentionToast({
                authorName: enriched.author?.full_name || 'Someone',
                preview: plainTextPreview(enriched.content).slice(0, 120),
                messageId: enriched.id,
              });
              toastTimerRef.current = setTimeout(() => setMentionToast(null), 6000);
            }
          } catch {
            setMessages((prev) =>
              prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, author: null, reply_to: null }]
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'marketplace', table: 'public_chat_messages' },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); clearTimeout(toastTimerRef.current); };
  }, [enrichFromCacheOrFetch, profile?.id]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // ---- Mention autocomplete logic ----

  // Detects an in-progress "@query" at the cursor. Only triggers on a
  // single word right after @ (no spaces) so it doesn't re-open while
  // typing normal sentences after an already-inserted "@Full Name".
  const updateMentionState = useCallback((value, cursorPos) => {
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z][\w]{0,30})$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionActiveIndex(0);
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  }, []);

  useEffect(() => {
    if (mentionQuery === null) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const term = mentionQuery.trim();
      const { data } = await supabase
        .schema('marketplace')
        .from('profiles')
        .select('id, full_name, role')
        .ilike('full_name', `%${term}%`)
        .neq('id', profile?.id || '')
        .limit(6);
      if (!cancelled) setMentionResults(data || []);
    }, 180);
    return () => { cancelled = true; clearTimeout(t); };
  }, [mentionQuery, profile?.id]);

  // Inserts clean "@Full Name " text into the composer (never a raw token —
  // the id lives only in insertedMentions, resolved at send time).
  const insertMention = useCallback((person) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursorPos = el.selectionStart;
    const value = draft;
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z][\w]{0,30})$/);
    if (!match) return;

    const startOfAt = match.index + (match[0].startsWith(' ') ? 1 : 0);
    const displayToken = `@${person.full_name} `;
    const newValue = value.slice(0, startOfAt) + displayToken + value.slice(cursorPos);

    setDraft(newValue.slice(0, MAX_LEN));
    setInsertedMentions((prev) => [...prev, { id: person.id, name: person.full_name }]);
    setMentionQuery(null);
    setMentionResults([]);

    requestAnimationFrame(() => {
      const newCursor = startOfAt + displayToken.length;
      el.focus();
      el.setSelectionRange(newCursor, newCursor);
    });
  }, [draft]);

  const handleDraftChange = (e) => {
    const value = e.target.value.slice(0, MAX_LEN);
    setDraft(value);
    updateMentionState(value, e.target.selectionStart);
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionActiveIndex((i) => (i + 1) % mentionResults.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionActiveIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionResults[mentionActiveIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        setMentionResults([]);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !profile?.id || sending) return;

    // Convert clean display text -> stored text with hidden mention tokens.
    const { content: storedContent, mentionedUserIds } = buildStoredContent(trimmed, insertedMentions);

    setSending(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('public_chat_messages')
      .insert({
        user_id: profile.id,
        content: storedContent,
        reply_to_id: replyingTo?.id || null,
        mentioned_user_ids: mentionedUserIds,
      })
      .select(SELECT_FIELDS)
      .single();

    setSending(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    isNearBottomRef.current = true;
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    setDraft('');
    setReplyingTo(null);
    setInsertedMentions([]);
  }, [draft, profile?.id, replyingTo, sending, insertedMentions]);

  const handleReply = useCallback((m) => {
    setReplyingTo({ id: m.id, content: plainTextPreview(m.content), author: m.author });
  }, []);

  const renderedMessages = useMemo(
    () => messages.map((m) => (
      <ChatBubble key={m.id} message={m} isOwn={m.user_id === profile?.id} currentUserId={profile?.id} onReply={handleReply} />
    )),
    [messages, profile?.id, handleReply]
  );

  return (
    <div className="public-chat">
      {mentionToast && (
        <button type="button" className="public-chat-mention-toast" onClick={() => setMentionToast(null)}>
          <AtSign size={14} />
          <span>
            <strong>{mentionToast.authorName}</strong> mentioned you: “{mentionToast.preview}”
          </span>
        </button>
      )}

      <div className="public-chat-list" ref={listRef} onScroll={handleScroll}>
        {loading ? (
          <p className="agent-picker-empty">Loading conversation…</p>
        ) : loadError ? (
          <p className="dashboard-error">{loadError}</p>
        ) : messages.length === 0 ? (
          <p className="agent-picker-empty">No messages yet — be the first to say something.</p>
        ) : (
          <>
            {hasMore && (
              <button type="button" className="public-chat-load-more" onClick={loadOlder} disabled={loadingMore}>
                <ChevronUp size={13} /> {loadingMore ? 'Loading…' : 'Load earlier messages'}
              </button>
            )}
            {renderedMessages}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="public-chat-composer" onSubmit={handleSend}>
        {replyingTo && (
          <div className="public-chat-replying-banner">
            <div>
              <p className="public-chat-replying-author">Replying to {replyingTo.author?.full_name || 'Unknown user'}</p>
              <p className="public-chat-replying-text">{replyingTo.content}</p>
            </div>
            <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="public-chat-input-row public-chat-input-row--relative">
          {mentionQuery !== null && mentionResults.length > 0 && (
            <div className="mention-dropdown">
              {mentionResults.map((person, i) => (
                <button
                  type="button"
                  key={person.id}
                  className={`mention-dropdown-item${i === mentionActiveIndex ? ' mention-dropdown-item--active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(person); }}
                  onMouseEnter={() => setMentionActiveIndex(i)}
                >
                  <span className="mention-dropdown-name">{person.full_name}</span>
                  {person.role && <span className="mention-dropdown-role">{person.role}</span>}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
            placeholder="Share your thoughts on real estate… use @ to mention someone"
            rows={1}
            maxLength={MAX_LEN}
          />
          <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message">
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}