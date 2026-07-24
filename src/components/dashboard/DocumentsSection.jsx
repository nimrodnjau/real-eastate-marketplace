// components/dashboard/DocumentsSection.jsx
import { useState, useEffect, useCallback } from 'react';
import { FileText, Upload, ExternalLink, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const DOCUMENT_TYPE_LABEL = {
  title_deed: 'Title deed',
  sale_agreement: 'Sale agreement',
  id_document: 'ID document',
  survey_map: 'Survey map',
  other: 'Other',
};

const STATUS_META = {
  pending:  { label: 'Pending review', icon: Clock,       className: 'doc-status--pending' },
  verified: { label: 'Verified',       icon: CheckCircle2, className: 'doc-status--verified' },
  rejected: { label: 'Rejected',       icon: XCircle,      className: 'doc-status--rejected' },
};

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 15 * 1024 * 1024;

export default function DocumentsSection({ listings }) {
  const [selectedListingId, setSelectedListingId] = useState(listings?.[0]?.id || '');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [uploadType, setUploadType] = useState('title_deed');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [openingId, setOpeningId] = useState(null);

  const fetchDocuments = useCallback(async () => {
    if (!selectedListingId) { setDocuments([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('documents')
      .select('*')
      .eq('listing_id', selectedListingId)
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setDocuments(data || []);
      setError(null);
    }
    setLoading(false);
  }, [selectedListingId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedListingId) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Only PDF, JPEG, or PNG files are allowed.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError('File too large — max 15MB.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('listingId', selectedListingId);
      formData.append('documentType', uploadType);

      const { data, error: fnError } = await supabase.functions.invoke(
        'upload-listing-document',
        { body: formData }
      );

      if (fnError) throw new Error(fnError.message || 'Upload failed');
      setDocuments((prev) => [data.document, ...prev]);
    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleView(doc) {
    setOpeningId(doc.id);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-document-url', {
        body: { documentId: doc.id },
      });
      if (fnError) throw new Error(fnError.message || 'Could not open document');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not open document.');
    } finally {
      setOpeningId(null);
    }
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="coming-soon">
        <p className="coming-soon-title">No listings yet</p>
        <p className="coming-soon-desc">Add a listing first, then come back here to upload its documents.</p>
      </div>
    );
  }

  return (
    <div className="documents-section">
      <label className="documents-listing-select">
        Listing
        <select value={selectedListingId} onChange={(e) => setSelectedListingId(e.target.value)}>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>{l.title}</option>
          ))}
        </select>
      </label>

      <div className="documents-upload-row">
        <select value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
          {Object.entries(DOCUMENT_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <label className="documents-upload-btn">
          {uploading ? 'Uploading…' : <><Upload size={15} /> Upload document</>}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
            disabled={uploading}
            hidden
          />
        </label>
      </div>
      {uploadError && <p className="dashboard-error">{uploadError}</p>}

      <div className="documents-list">
        {loading ? (
          <p className="agent-picker-empty">Loading documents…</p>
        ) : error ? (
          <p className="dashboard-error">{error}</p>
        ) : documents.length === 0 ? (
          <p className="agent-picker-empty">No documents uploaded for this listing yet.</p>
        ) : (
          documents.map((doc) => {
            const status = STATUS_META[doc.status] || STATUS_META.pending;
            const StatusIcon = status.icon;
            return (
              <div key={doc.id} className="document-row">
                <FileText size={18} className="document-row-icon" />
                <div className="document-row-text">
                  <p className="document-row-name">{doc.file_name}</p>
                  <p className="document-row-meta">
                    {DOCUMENT_TYPE_LABEL[doc.document_type]} · {(doc.size_bytes / 1024 / 1024).toFixed(1)} MB
                  </p>
                  {doc.status === 'rejected' && doc.rejection_reason && (
                    <p className="document-row-rejection">Rejected: {doc.rejection_reason}</p>
                  )}
                </div>
                <span className={`doc-status ${status.className}`}>
                  <StatusIcon size={13} /> {status.label}
                </span>
                <button
                  type="button"
                  className="document-view-btn"
                  onClick={() => handleView(doc)}
                  disabled={openingId === doc.id}
                >
                  <ExternalLink size={14} /> {openingId === doc.id ? 'Opening…' : 'View'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}