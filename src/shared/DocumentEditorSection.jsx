import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { IconDocument, IconPlus, IconSend } from './Icons';

/*
  DocumentEditorSection
  Draft documents (sale agreements, survey reports, valuation reports, etc.)
  and send them to the client on a transaction. Providers can type content
  directly in the rich text editor and/or attach an uploaded file (PDF, Word,
  Excel, image) — both are optional and independent of each other.

  ATTACHMENT STORAGE: moved off Supabase Storage to Cloudflare R2, via two
  Supabase Edge Functions (still Supabase-hosted, just writing to R2):
    - upload-provider-document   (POST multipart 'file' -> storageKey/fileName/mimeType/sizeBytes)
    - get-provider-document-url  (POST { storageKey } -> signed GET url, 5 min TTL)
  Called with supabase.functions.invoke(), which reuses the current session's
  Authorization header automatically — no manual token plumbing needed.

  NOTE: there's no delete-provider-document function yet. removeAttachment()
  below only clears the DB reference; the R2 object is orphaned until a
  delete endpoint exists. Same "untidy, not harmful" tradeoff as before,
  just without even the best-effort cleanup call.

  Document rows themselves (title/content/doc_type/status/attachment_*)
  still read/write directly against Supabase Postgres (marketplace.documents)
  — only the file bytes moved to R2. ASSUMPTION: table is still
  marketplace.documents, not marketplace.provider_documents (the edge
  function comments reference that name — verify before shipping).

  Uses a small contentEditable-based rich text editor (bold / italic /
  underline / bullet list / headings) rather than pulling in an editor
  dependency you may not have installed.

  Props: userId, roleConfig
*/

const MAX_ATTACHMENT_MB = 25; // matches MAX_BYTES in upload-provider-document

function IconPaperclip({ width = 14, height = 14 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentEditorSection({ userId, roleConfig }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null); // null = list view
  const [saving, setSaving] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadDocuments();
    loadRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, roleConfig.taskKey]);

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
    const { data: engagements, error: engagementsError } = await supabase
      .schema('marketplace')
      .from('transaction_provider_engagements')
      .select('id, transaction_id')
      .eq('provider_id', userId)
      .eq('task_key', roleConfig.taskKey)
      .eq('status', 'accepted');

    if (engagementsError) {
      setError(engagementsError.message);
      setRecipients([]);
      return;
    }

    if (!engagements?.length) {
      setRecipients([]);
      return;
    }

    const transactionIds = [...new Set(engagements.map((e) => e.transaction_id))];
    const { data: transactions, error: transactionsError } = await supabase
      .schema('marketplace')
      .from('transactions')
      .select('id, buyer_id')
      .in('id', transactionIds);

    if (transactionsError) {
      setError(transactionsError.message);
      setRecipients([]);
      return;
    }

    const buyerIdByTransaction = new Map((transactions || []).map((t) => [t.id, t.buyer_id]));

    const buyerIds = [...new Set((transactions || []).map((t) => t.buyer_id).filter(Boolean))];
    const { data: profiles, error: profilesError } = buyerIds.length
      ? await supabase
          .schema('marketplace')
          .from('profiles')
          .select('id, full_name')
          .in('id', buyerIds)
      : { data: [], error: null };

    if (profilesError) {
      setError(profilesError.message);
    }

    const nameById = new Map((profiles || []).map((p) => [p.id, p.full_name]));

    setRecipients(
      engagements.map((e) => ({
        id: e.id,
        transaction_id: e.transaction_id,
        client_name: nameById.get(buyerIdByTransaction.get(e.transaction_id)) || 'Unnamed client',
      }))
    );
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
      attachment_path: null,
      attachment_name: null,
      attachment_size: null,
      attachment_type: null,
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

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so selecting the same file again still fires onChange
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
      setError(`"${file.name}" is larger than ${MAX_ATTACHMENT_MB}MB. Please choose a smaller file.`);
      return;
    }

    setError(null);
    setUploadingAttachment(true);

    const formData = new FormData();
    formData.append('file', file);

    const { data, error: uploadError } = await supabase.functions.invoke('upload-provider-document', {
      body: formData,
    });

    setUploadingAttachment(false);

    if (uploadError) {
      setError(uploadError.message || 'Upload failed');
      return;
    }

    setActiveDoc((d) => ({
      ...d,
      attachment_path: data.storageKey,
      attachment_name: data.fileName,
      attachment_size: data.sizeBytes,
      attachment_type: data.mimeType,
    }));
  }

  async function removeAttachment() {
    if (!activeDoc?.attachment_path) return;

    // No delete-provider-document edge function exists yet — this only
    // clears the DB-facing reference. The R2 object itself is orphaned
    // until a delete endpoint is added (see file header note).
    setActiveDoc((d) => ({
      ...d,
      attachment_path: null,
      attachment_name: null,
      attachment_size: null,
      attachment_type: null,
    }));
  }

  async function openAttachment(storageKey) {
    const { data, error: signError } = await supabase.functions.invoke('get-provider-document-url', {
      body: { storageKey },
    });
    if (signError) {
      setError(signError.message || 'Could not generate view link');
      return;
    }
    window.open(data.url, '_blank', 'noopener,noreferrer');
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
      attachment_path: activeDoc.attachment_path || null,
      attachment_name: activeDoc.attachment_name || null,
      attachment_size: activeDoc.attachment_size || null,
      attachment_type: activeDoc.attachment_type || null,
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

          <div className="pd-field">
            <label>Attachment (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            {activeDoc.attachment_name ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  border: '1px solid var(--pd-border)',
                  borderRadius: 'var(--pd-radius-sm)',
                  padding: '10px 12px',
                }}
              >
                <IconPaperclip width={14} height={14} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {activeDoc.attachment_name}
                  </div>
                  {activeDoc.attachment_size != null && (
                    <div style={{ fontSize: '0.78rem', opacity: 0.65 }}>{formatFileSize(activeDoc.attachment_size)}</div>
                  )}
                </div>
                <button
                  type="button"
                  className="pd-btn pd-btn-ghost pd-btn-sm"
                  onClick={() => openAttachment(activeDoc.attachment_path)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="pd-btn pd-btn-ghost pd-btn-sm"
                  onClick={removeAttachment}
                  disabled={uploadingAttachment}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="pd-btn pd-btn-ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAttachment}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <IconPaperclip width={14} height={14} /> {uploadingAttachment ? 'Uploading…' : 'Upload a file'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button className="pd-btn pd-btn-ghost" onClick={() => saveDocument('draft')} disabled={saving || uploadingAttachment}>
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              className="pd-btn pd-btn-primary"
              onClick={() => saveDocument('sent')}
              disabled={saving || uploadingAttachment || !activeDoc.recipient_name}
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
                  {doc.attachment_name ? ' · has attachment' : ''}
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