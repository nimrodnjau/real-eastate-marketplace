import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseclient'; // ADJUST to your actual client path
import { IconDocument, IconPlus, IconSend } from './Icons';

/*
  DocumentEditorSection
  Draft documents (sale agreements, survey reports, valuation reports, etc.)
  and send them to the client on a transaction.

  Uses a small contentEditable-based rich text editor (bold / italic /
  underline / bullet list / headings) rather than pulling in an editor
  dependency you may not have installed. Swap the toolbar + `.pd-editor` div
  for TipTap/Slate/etc. later if you'd rather standardize on one.

  ASSUMPTIONS TO VERIFY:
  - `documents` table columns: id, provider_id, transaction_id, recipient_name,
    title, doc_type, content (text/html), status ('draft' | 'sent'),
    created_at, sent_at.
  - Recipients are pulled from accepted rows in provider_engagement_requests
    (see IncomingRequestsSection) — if you track "who is my current client"
    differently, only `loadRecipients()` below needs to change.
  - Sending currently just flips status to 'sent' and stamps sent_at. If you
    want the client to actually get notified in-app, that's where you'd also
    insert into `messages`/`conversations` — left out here since I don't have
    that table's exact shape, but the hook point is marked below.

  Props: userId, roleConfig
*/
export default function DocumentEditorSection({ userId, roleConfig }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null); // null = list view
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    loadDocuments();
    loadRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function loadDocuments() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .schema('marketplace')
      .from('documents')
      .select('*')
      .eq('provider_id', userId)
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setDocuments(data || []);
    setLoading(false);
  }

  async function loadRecipients() {
    const { data } = await supabase
      .schema('marketplace')
      .from('provider_engagement_requests')
      .select('id, client_name, transaction_id')
      .eq('provider_id', userId)
      .eq('status', 'accepted');
    setRecipients(data || []);
  }

  function startNewDocument() {
    setActiveDoc({
      id: null,
      title: '',
      doc_type: roleConfig.documentTypes[0]?.key || 'other',
      recipient_name: '',
      transaction_id: null,
      content: '',
      status: 'draft',
    });
  }

  function openDocument(doc) {
    setActiveDoc({ ...doc });
  }

  useEffect(() => {
    if (activeDoc && editorRef.current) {
      editorRef.current.innerHTML = activeDoc.content || '';
    }
  }, [activeDoc?.id]);

  function exec(command, value = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  async function saveDocument(nextStatus) {
    if (!activeDoc.title.trim()) {
      setError('Give the document a title before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    const content = editorRef.current?.innerHTML || '';
    const payload = {
      provider_id: userId,
      title: activeDoc.title,
      doc_type: activeDoc.doc_type,
      recipient_name: activeDoc.recipient_name || null,
      transaction_id: activeDoc.transaction_id || null,
      content,
      status: nextStatus,
      ...(nextStatus === 'sent' ? { sent_at: new Date().toISOString() } : {}),
    };

    const query = activeDoc.id
      ? supabase.schema('marketplace').from('documents').update(payload).eq('id', activeDoc.id).select().single()
      : supabase.schema('marketplace').from('documents').insert(payload).select().single();

    const { data, error: err } = await query;
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Hook point: if you want the client notified in-app when a document is
    // sent, insert into your messages/conversations table here using
    // data.transaction_id / activeDoc.recipient_name.
    setActiveDoc(null);
    loadDocuments();
  }

  if (activeDoc) {
    return (
      <div>
        {error && <div className="pd-error">{error}</div>}
        <div className="pd-card">
          <div className="pd-card-head">
            <div style={{ flex: 1 }}>
              <input
                className="pd-input"
                style={{ fontFamily: 'var(--pd-font-display)', fontSize: '1.05rem', fontWeight: 600, border: 'none', padding: '4px 0' }}
                placeholder="Document title"
                value={activeDoc.title}
                onChange={(e) => setActiveDoc((d) => ({ ...d, title: e.target.value }))}
              />
            </div>
            <button className="pd-btn pd-btn-ghost" onClick={() => setActiveDoc(null)} disabled={saving}>
              Back to documents
            </button>
          </div>

          <div className="pd-grid-2">
            <div className="pd-field">
              <label>Document type</label>
              <select
                className="pd-select"
                value={activeDoc.doc_type}
                onChange={(e) => setActiveDoc((d) => ({ ...d, doc_type: e.target.value }))}
              >
                {roleConfig.documentTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pd-field">
              <label>Client</label>
              <select
                className="pd-select"
                value={activeDoc.recipient_name || ''}
                onChange={(e) => {
                  const match = recipients.find((r) => r.client_name === e.target.value);
                  setActiveDoc((d) => ({
                    ...d,
                    recipient_name: e.target.value,
                    transaction_id: match?.transaction_id || null,
                  }));
                }}
              >
                <option value="">Select a client…</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.client_name}>
                    {r.client_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pd-field">
            <label>Content</label>
            <div style={{ border: '1px solid var(--pd-border)', borderRadius: 'var(--pd-radius-sm)', overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  padding: '6px 8px',
                  borderBottom: '1px solid var(--pd-border)',
                  background: 'var(--pd-maroon-tint)',
                }}
              >
                {[
                  ['Bold', () => exec('bold'), 'B'],
                  ['Italic', () => exec('italic'), 'I'],
                  ['Underline', () => exec('underline'), 'U'],
                  ['Heading', () => exec('formatBlock', 'H3'), 'H'],
                  ['Bullet list', () => exec('insertUnorderedList'), '•'],
                  ['Numbered list', () => exec('insertOrderedList'), '1.'],
                ].map(([label, fn, glyph]) => (
                  <button
                    key={label}
                    type="button"
                    title={label}
                    onClick={fn}
                    className="pd-btn pd-btn-ghost pd-btn-sm"
                    style={{ minWidth: 28, justifyContent: 'center' }}
                  >
                    {glyph}
                  </button>
                ))}
              </div>
              <div
                ref={editorRef}
                contentEditable
                className="pd-mono"
                style={{
                  minHeight: 260,
                  padding: '14px 16px',
                  fontFamily: 'var(--pd-font-body)',
                  fontSize: '0.92rem',
                  lineHeight: 1.6,
                  outline: 'none',
                }}
                suppressContentEditableWarning
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button className="pd-btn pd-btn-ghost" onClick={() => saveDocument('draft')} disabled={saving}>
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              className="pd-btn pd-btn-primary"
              onClick={() => saveDocument('sent')}
              disabled={saving || !activeDoc.recipient_name}
              title={!activeDoc.recipient_name ? 'Select a client first' : ''}
            >
              <IconSend width={14} height={14} /> Send to client
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="pd-card-head" style={{ marginBottom: 6 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--pd-font-display)', fontSize: '1.15rem', fontWeight: 600 }}>Documents</h2>
          <div className="pd-card-sub">Draft and send documents for the transactions you're on.</div>
        </div>
        <button className="pd-btn pd-btn-primary" onClick={startNewDocument}>
          <IconPlus width={15} height={15} /> New document
        </button>
      </div>

      {error && <div className="pd-error">{error}</div>}

      <div className="pd-card">
        {loading ? (
          <div className="pd-loading">Loading documents…</div>
        ) : documents.length === 0 ? (
          <div className="pd-empty">
            <strong>No documents yet</strong>
            Draft your first one with "New document" above.
          </div>
        ) : (
          documents.map((doc) => (
            <div className="pd-list-row" key={doc.id} style={{ cursor: 'pointer' }} onClick={() => openDocument(doc)}>
              <div className="pd-list-main">
                <span className="pd-list-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconDocument width={14} height={14} /> {doc.title}
                </span>
                <span className="pd-list-meta">
                  {roleConfig.documentTypes.find((t) => t.key === doc.doc_type)?.label || doc.doc_type}
                  {doc.recipient_name ? ` — for ${doc.recipient_name}` : ''}
                </span>
              </div>
              <span className={`pd-badge ${doc.status === 'sent' ? 'success' : 'neutral'}`}>{doc.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}