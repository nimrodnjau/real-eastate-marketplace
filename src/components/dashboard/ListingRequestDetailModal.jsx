// components/dashboard/ListingRequestDetailModal.jsx
import { useState, useEffect, useCallback } from 'react';
import { X, FileText, MapPin, Phone, Mail, Map as MapIcon, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { DOCUMENT_TYPE_LABEL, STATUS_META } from '../../lib/documentTypes';
import '../../styles/listing-request-detail.css';

const money = (v) =>
  v == null ? '—' : `KES ${Number(v).toLocaleString('en-KE')}`;

export default function ListingRequestDetailModal({ request, seller, onClose, onApprove, onReject, busy }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [mapOpen, setMapOpen] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  const images = Array.isArray(request.images) ? request.images : [];
  const hasLocation = request.location_lat != null && request.location_lng != null;
  const mapUrl = hasLocation
    ? `https://www.google.com/maps?q=${request.location_lat},${request.location_lng}`
    : null;
  const mapEmbedUrl = hasLocation
    ? `https://maps.google.com/maps?q=${request.location_lat},${request.location_lng}&z=15&output=embed`
    : null;

  const fetchDocuments = useCallback(async () => {
    setDocsLoading(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('documents')
      .select('*')
      .eq('listing_id', request.id)
      .order('created_at', { ascending: false });

    if (error) {
      setDocsError(error.message);
    } else {
      setDocuments(data || []);
      setDocsError(null);
    }
    setDocsLoading(false);
  }, [request.id]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

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
      setDocsError(err.message || 'Could not open document.');
    } finally {
      setOpeningId(null);
    }
  }

  function submitDecline() {
    onReject(request.id, reason.trim() || null);
    setDeclining(false);
    setReason('');
  }

  const noDocsYet = !docsLoading && documents.length === 0;

  return (
    <div className="listing-request-detail-overlay" onClick={onClose}>
      <div className="listing-request-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="listing-request-detail-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {images.length > 0 && (
          <div className="listing-request-detail-gallery">
            {images.map((img, i) => (
              <img key={img.url || i} src={img.url} alt={`${request.title} ${i + 1}`} />
            ))}
          </div>
        )}

        <h2 className="listing-request-detail-title">{request.title}</h2>
        <p className="listing-request-detail-meta">
          {request.property_type} · {money(request.price)}
        </p>

        {request.address && (
          <p className="listing-request-detail-address">
            <MapPin size={14} /> {request.address}
          </p>
        )}

        {hasLocation && (
          <div className="listing-request-detail-map-block">
            <button
              type="button"
              className="listing-request-map-toggle"
              onClick={() => setMapOpen((v) => !v)}
              aria-expanded={mapOpen}
            >
              <MapIcon size={15} />
              {mapOpen ? 'Hide map' : 'View location on map'}
            </button>

            {mapOpen && (
              <div className="listing-request-map-panel">
                <iframe
                  title={`${request.title} location`}
                  src={mapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="listing-request-detail-map-link"
                >
                  Open in Google Maps
                </a>
              </div>
            )}
          </div>
        )}

        {request.description && (
          <p className="listing-request-detail-description">{request.description}</p>
        )}

        <div className="listing-request-detail-section">
          <span className="listing-request-label">Submitted by</span>
          {seller ? (
            <div className="listing-request-seller-card">
              <p className="listing-request-seller-name">{seller.full_name}</p>
              <div className="listing-request-seller-contacts">
                {seller.phone && (
                  <a href={`tel:${seller.phone}`} className="listing-request-detail-phone">
                    <Phone size={14} /> {seller.phone}
                  </a>
                )}
                {seller.email && (
                  <a href={`mailto:${seller.email}`} className="listing-request-detail-email">
                    <Mail size={14} /> {seller.email}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="dashboard-empty">Loading…</p>
          )}
        </div>

        <div className="listing-request-detail-section">
          <span className="listing-request-label">Verification documents</span>

          {docsLoading ? (
            <p className="dashboard-empty">Loading documents…</p>
          ) : docsError ? (
            <p className="dashboard-error">{docsError}</p>
          ) : documents.length === 0 ? (
            <p className="dashboard-empty">No documents attached yet.</p>
          ) : (
            <ul className="listing-request-doc-list">
              {documents.map((doc) => {
                const status = STATUS_META[doc.status] || STATUS_META.pending;
                const StatusIcon = status.icon;
                return (
                  <li key={doc.id}>
                    <div className="document-row">
                      <FileText size={18} className="document-row-icon" />
                      <div className="document-row-text">
                        <p className="document-row-name">{doc.file_name}</p>
                        <p className="document-row-meta">
                          {DOCUMENT_TYPE_LABEL[doc.document_type] || doc.document_type}
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
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {declining ? (
          <div className="listing-request-decline-box">
            <label htmlFor="decline-reason">Reason for the seller (optional)</label>
            <textarea
              id="decline-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={busy}
            />
            <div className="listing-request-actions">
              <button type="button" className="listing-request-btn listing-request-btn-ghost" onClick={() => setDeclining(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="listing-request-btn listing-request-btn-decline" onClick={submitDecline} disabled={busy}>
                {busy ? 'Declining…' : 'Confirm decline'}
              </button>
            </div>
          </div>
        ) : (
          <div className="listing-request-actions">
            <button type="button" className="listing-request-btn listing-request-btn-ghost" onClick={() => setDeclining(true)} disabled={busy}>
              Decline
            </button>
            <button
              type="button"
              className="listing-request-btn listing-request-btn-approve"
              onClick={() => onApprove(request.id)}
              disabled={busy || docsLoading || noDocsYet}
              title={noDocsYet ? 'No documents to verify yet' : undefined}
            >
              {busy ? 'Approving…' : 'Approve & list'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}