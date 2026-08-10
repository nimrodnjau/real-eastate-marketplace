import { useEffect, useRef, useState } from 'react';
import { FileText, Upload, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseclient';
import StageWindow from './StageWindow';
import StageMessagePanel from './StageMessagePanel';
import '../../styles/stage3-documents.css';

const UPLOAD_ENDPOINT = '/api/documents/upload';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const REQUIRED_DOCS = [
  { type: 'title_deed', label: 'Title Deed' },
  { type: 'land_rates_clearance', label: 'Land Rates Clearance Certificate' },
  { type: 'search_certificate', label: 'Official Land Search' },
  { type: 'seller_id', label: 'Seller Identification' },
];

const EMPTY_DOC = {
  status: 'missing',
  file_name: null,
  rejection_reason: null,
};

export default function Stage3Documents({
  listing,
  sellerId,
  viewerId,
  viewerIsStaff = false,
  onAdvanceStage,
}) {
  const listingId = listing?.id;
  const isSeller = viewerId === sellerId;
  const fileInputRef = useRef(null);

  const [docs, setDocs] = useState([]);
  const [pendingDocType, setPendingDocType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const allVerified =
    docs.length === REQUIRED_DOCS.length &&
    docs.every((doc) => doc.status === 'verified');

  async function loadDocuments() {
    if (!listingId) {
      setError('This listing could not be found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: queryError } = await supabase
      .schema('marketplace')
      .from('documents')
      .select('*')
      .eq('listing_id', listingId);

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const docsByType = new Map(
      (data ?? []).map((document) => [document.document_type, document])
    );

    setDocs(
      REQUIRED_DOCS.map((required) => ({
        ...required,
        ...(docsByType.get(required.type) ?? EMPTY_DOC),
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
  }, [listingId]);

  useEffect(() => {
    if (!listingId) return undefined;

    const channel = supabase
      .channel(`listing-documents-${listingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'marketplace',
          table: 'documents',
          filter: `listing_id=eq.${listingId}`,
        },
        loadDocuments
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listingId]);

  useEffect(() => {
    if (allVerified) {
      onAdvanceStage?.();
    }
  }, [allVerified, onAdvanceStage]);

  function triggerUpload(documentType) {
    setError('');
    setPendingDocType(documentType);
    fileInputRef.current?.click();
  }

  async function handleFileChosen(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !pendingDocType || !listingId) return;

    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Only PDF, PNG, JPG, and JPEG files are allowed.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('The maximum document size is 10 MB.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('listingId', listingId);
      formData.append('documentType', pendingDocType);

      const uploadResponse = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error ?? 'Document upload failed.');
      }

      const { error: databaseError } = await supabase
        .schema('marketplace')
        .from('documents')
        .upsert(
          {
            listing_id: listingId,
            uploaded_by: viewerId,
            document_type: pendingDocType,
            file_name: file.name,
            storage_key: uploadResult.storageKey,
            mime_type: file.type,
            size_bytes: file.size,
            status: 'pending',
            verified_by: null,
            verified_at: null,
            rejection_reason: null,
            provider_id: listing?.provider_id ?? null,
          },
          { onConflict: 'listing_id,document_type' }
        );

      if (databaseError) throw databaseError;

      await loadDocuments();
      setPendingDocType(null);
    } catch (uploadError) {
      setError(uploadError.message ?? 'Unable to upload this document.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(document, status) {
    let notes = null;

    if (status === 'rejected') {
      notes = window.prompt(`Why is "${document.label}" being rejected?`);

      if (notes === null) return;

      if (!notes.trim()) {
        setError('A rejection reason is required.');
        return;
      }
    }

    setBusy(true);
    setError('');

    try {
      const { error: verifyError } = await supabase.rpc('verify_document', {
        p_document_id: document.id,
        p_status: status,
        p_notes: notes,
      });

      if (verifyError) throw verifyError;

      await loadDocuments();
    } catch (verifyError) {
      setError(verifyError.message ?? 'Could not update document status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StageWindow
      stageNumber={3}
      title="Documents"
      subtitle="The seller submits the property's legal documents. Our team verifies each one before funds move to escrow."
      isComplete={allVerified}
      clearedTitle="All documents verified"
      clearedSubtitle="Moving to Payment."
      messagesSlot={
        <StageMessagePanel
          counterpart={{ name: 'Verification team', role: 'staff' }}
          viewerId={viewerId}
          mockMessages={[]}
        />
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleFileChosen}
      />

      {error && <p className="stage-empty">{error}</p>}

      {loading ? (
        <p className="stage-empty">Loading documents…</p>
      ) : (
        <ul className="stage3-doc-list">
          {docs.map((document) => (
            <li key={document.type} className="stage3-doc-row">
              <div className="stage3-doc-icon">
                <FileText size={16} />
              </div>

              <div className="stage3-doc-main">
                <p className="stage3-doc-label">{document.label}</p>

                {document.file_name && (
                  <p className="stage3-doc-filename">
                    {document.file_name}
                  </p>
                )}

                {document.status === 'rejected' &&
                  document.rejection_reason && (
                    <p className="stage3-doc-notes">
                      {document.rejection_reason}
                    </p>
                  )}
              </div>

              <span
                className={`stage-pill ${
                  document.status === 'verified'
                    ? 'stage-pill--verified'
                    : document.status === 'rejected'
                    ? 'stage-pill--alert'
                    : document.status === 'pending'
                    ? 'stage-pill--active'
                    : 'stage-pill--pending'
                }`}
              >
                {document.status === 'missing'
                  ? 'not submitted'
                  : document.status}
              </span>

              <div className="stage3-doc-actions">
                {isSeller &&
                  ['missing', 'rejected'].includes(document.status) && (
                    <button
                      type="button"
                      className="stage-btn stage-btn--ghost"
                      disabled={busy}
                      onClick={() => triggerUpload(document.type)}
                    >
                      <Upload size={13} />
                      {document.status === 'rejected'
                        ? 'Re-upload'
                        : 'Upload'}
                    </button>
                  )}

                {viewerIsStaff && document.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      className="stage3-icon-btn stage3-icon-btn--verify"
                      disabled={busy}
                      onClick={() => handleVerify(document, 'verified')}
                      aria-label={`Verify ${document.label}`}
                    >
                      <Check size={14} />
                    </button>

                    <button
                      type="button"
                      className="stage3-icon-btn stage3-icon-btn--reject"
                      disabled={busy}
                      onClick={() => handleVerify(document, 'rejected')}
                      aria-label={`Reject ${document.label}`}
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !isSeller && !viewerIsStaff && (
        <p className="stage-empty">
          Waiting on the seller to submit documents and our team to verify
          them.
        </p>
      )}
    </StageWindow>
  );
}