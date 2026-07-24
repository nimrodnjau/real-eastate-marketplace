import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/supabaseClient';
import ListingsMap from '../components/ListingsMap';
import {
  Bed, Bath, Car, LandPlot, ShieldCheck, ShieldAlert, ChevronLeft, ChevronRight,
  Phone, Mail, Building2, FileText,
} from 'lucide-react';
import '../styles/listing-detail.css';
import RequestViewingButton from '../components/RequestViewingButton';
import DocumentViewer from '../components/DocumentViewer';

const PROPERTY_TYPE_LABEL = {
  land: 'Land', apartment: 'Apartment', house: 'House', commercial: 'Commercial', other: 'Property',
};

function formatSize(value, unit) {
  if (value == null) return null;
  if (unit === 'acres') {
    const hectares = (value * 0.404686).toFixed(2);
    return { primary: `${value} acres`, secondary: `${hectares} hectares` };
  }
  if (unit === 'sqm') return { primary: `${value} sqm`, secondary: null };
  if (unit === 'sqft') return { primary: `${value} sq ft`, secondary: null };
  return { primary: `${value}`, secondary: null };
}

// TODO: replace with a real call once the signed-URL backend piece is
// built. This should hit a Supabase Edge Function / RPC that (a) checks
// the requesting buyer has an active connection to this listing, then
// (b) mints a short-lived (e.g. 60s) Cloudflare R2 signed URL — never
// a long-lived or public one.
async function getSignedDocumentUrl(doc) {
  console.warn('getSignedDocumentUrl is a stub — wire this up to the real endpoint.', doc);
  return null;
}

export default function ListingDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [listing, setListing] = useState(null);
  // Whichever party is the verified point of contact for this listing —
  // the agent if one is attached (agent's own listing, or a seller's
  // request they approved), otherwise the seller who listed it directly.
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);

  // Verification documents (title deed, etc.) — only fetched/shown for
  // verified (agent-attached) listings.
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  // The document currently open in the in-app viewer, plus its signed
  // URL once fetched. null when the viewer is closed.
  const [viewerDoc, setViewerDoc] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [startingPurchase, setStartingPurchase] = useState(false);

  useEffect(() => {
    async function fetchListing() {
      setLoading(true);
      setDocumentsLoading(true);

      const { data, error } = await db
        .schema('marketplace')
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        setError(error.message);
        setLoading(false);
        setDocumentsLoading(false);
        return;
      }

      setListing(data);
      setActivePhoto(0);

      // Agent takes precedence — a listing with an agent_id is the verified
      // one, whether that's the agent's own listing or an approved seller
      // request, so the agent is who buyers should be routed to.
      const contactId = data?.agent_id || data?.seller_id;

      if (contactId) {
        // NOTE: this was previously missing `.schema('marketplace')` and
        // was silently querying the wrong schema (public.profiles instead
        // of marketplace.profiles) — fixed here.
        const { data: contactProfile } = await db
          .schema('marketplace')
          .from('profiles')
          .select('id, full_name, phone, email, agency_name, avatar_url')
          .eq('id', contactId)
          .single();
        setContact(contactProfile || null);
      } else {
        setContact(null);
      }

      setLoading(false);

      // Documents are only surfaced for verified listings — an
      // agent-attached listing is what "verified" means elsewhere on
      // this page (see isUnverified below).
      const verified = !!data?.agent_id;
      if (verified) {
        const { data: docs, error: docsError } = await db
          .schema('marketplace')
          .from('documents')
          .select('id, file_name, storage_key, mime_type, document_type, status, created_at')
          .eq('listing_id', id)
          .eq('status', 'verified')
          .order('created_at', { ascending: true });

        if (docsError) {
          console.error('Failed to load documents:', docsError);
          setDocuments([]);
        } else {
          setDocuments(docs || []);
        }
      } else {
        setDocuments([]);
      }
      setDocumentsLoading(false);
    }

    fetchListing();
  }, [id]);

  function handleInquiry() {
    const contactId = listing.agent_id || listing.seller_id;
    if (!profile) {
      navigate('/login', { state: { redirectTo: `/listings/${id}` } });
      return;
    }
    navigate('/dashboard/buyer', { state: { startConversationWith: contactId } });
  }

  async function openDocument(doc) {
    if (!profile) {
      navigate('/login', { state: { redirectTo: `/listings/${id}` } });
      return;
    }
    setViewerLoading(true);
    const signedUrl = await getSignedDocumentUrl(doc);
    setViewerLoading(false);

    if (!signedUrl) {
      // Stub returns null until the backend piece exists — swap this
      // for real error handling (e.g. "link expired, try again") once
      // getSignedDocumentUrl is live.
      console.warn('No signed URL returned for document', doc.id);
      return;
    }
    setViewerDoc({ ...doc, signedUrl });
  }

  async function handleStartPurchase() {
    if (!profile) {
      navigate('/login', { state: { redirectTo: `/listings/${id}` } });
      return;
    }

    setStartingPurchase(true);

    // Resume an existing transaction rather than creating a duplicate —
    // the `unique (listing_id, buyer_id)` constraint would reject a
    // second insert anyway, but checking first avoids relying on that
    // as the only guard and gives a cleaner path back in.
    const { data: existing, error: existingError } = await db
      .schema('marketplace')
      .from('transactions')
      .select('id')
      .eq('listing_id', id)
      .eq('buyer_id', profile.id)
      .maybeSingle();

    if (existingError) {
      console.error('Failed to check for an existing transaction:', existingError);
      setStartingPurchase(false);
      return;
    }

    if (existing) {
      setStartingPurchase(false);
      navigate(`/purchases/${existing.id}`);
      return;
    }

    const { data: created, error: createError } = await db
      .schema('marketplace')
      .from('transactions')
      .insert({
        listing_id: id,
        buyer_id: profile.id,
        agent_id: listing.agent_id || null,
        seller_id: listing.seller_id || null,
      })
      .select('id')
      .single();

    setStartingPurchase(false);

    if (createError) {
      console.error('Failed to start purchase:', createError);
      return;
    }
    navigate(`/purchases/${created.id}`);
  }

  if (loading) return <div className="listing-detail-state">Loading listing…</div>;
  if (error) return <div className="listing-detail-state listing-detail-error">Couldn't load listing: {error}</div>;
  if (!listing) return <div className="listing-detail-state">Listing not found.</div>;

  const images = listing.images || [];
  const isLand = listing.property_type === 'land';
  const size = isLand ? formatSize(listing.size_value, listing.size_unit) : null;
  const isUnverified = listing.status === 'active' && !listing.agent_id;
  const isAgentListing = !!listing.agent_id;
  const isOwnListing = profile?.id && (profile.id === listing.agent_id || profile.id === listing.seller_id);

  function nextPhoto() {
    setActivePhoto((i) => (i + 1) % images.length);
  }
  function prevPhoto() {
    setActivePhoto((i) => (i - 1 + images.length) % images.length);
  }

  return (
    <div className="listing-detail-page">
      <button type="button" className="listing-detail-back" onClick={() => navigate(-1)}>
        &larr; Back to listings
      </button>

      {/* Gallery */}
      <div className="listing-detail-gallery">
        <div className="listing-detail-gallery-main">
          {images.length > 0 ? (
            <>
              <img src={images[activePhoto]?.url} alt={listing.title} />
              {images.length > 1 && (
                <>
                  <button type="button" className="gallery-arrow gallery-arrow-prev" onClick={prevPhoto} aria-label="Previous photo">
                    <ChevronLeft size={22} />
                  </button>
                  <button type="button" className="gallery-arrow gallery-arrow-next" onClick={nextPhoto} aria-label="Next photo">
                    <ChevronRight size={22} />
                  </button>
                  <span className="gallery-counter">{activePhoto + 1} / {images.length}</span>
                </>
              )}
            </>
          ) : (
            <div className="listing-detail-gallery-placeholder">No photos yet</div>
          )}
        </div>
        {images.length > 1 && (
          <div className="listing-detail-gallery-thumbs">
            {images.map((img, i) => (
              <button
                key={img.key || i}
                type="button"
                className={`listing-detail-thumb${i === activePhoto ? ' active' : ''}`}
                onClick={() => setActivePhoto(i)}
              >
                <img src={img.url} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Title / price bar */}
      <div className="listing-detail-topbar">
        <div className="listing-detail-topbar-info">
          <p className="listing-detail-type">{PROPERTY_TYPE_LABEL[listing.property_type] || listing.property_type}</p>
          <h1 className="listing-detail-title">{listing.title}</h1>
          {listing.address && <p className="listing-detail-address">{listing.address}</p>}

          <div className="listing-detail-facts">
            {isLand ? (
              size && (
                <span className="listing-detail-fact">
                  <LandPlot size={16} />
                  {size.primary}
                  {size.secondary && <span className="listing-detail-fact-sub">{size.secondary}</span>}
                </span>
              )
            ) : (
              <>
                {listing.bedrooms != null && <span className="listing-detail-fact"><Bed size={16} />{listing.bedrooms} beds</span>}
                {listing.bathrooms != null && <span className="listing-detail-fact"><Bath size={16} />{listing.bathrooms} baths</span>}
                {listing.parking != null && <span className="listing-detail-fact"><Car size={16} />{listing.parking} parking</span>}
              </>
            )}
          </div>
        </div>

        <div className="listing-detail-topbar-cta">
          <p className="listing-detail-price-label">Asking Price</p>
          <p className="listing-detail-price">KES {Number(listing.price).toLocaleString()}</p>
          <button type="button" className="listing-detail-inquiry-btn" onClick={handleInquiry}>
            Send inquiry
          </button>
        </div>
      </div>

      {isUnverified && (
        <div className="listing-detail-notice">
          <ShieldAlert size={18} />
          <span>
            This property was listed directly by the seller and has not yet been verified by a certified agent on the platform. Exercise caution and verify details independently before proceeding.
          </span>
        </div>
      )}

      <div className="listing-detail-body">
        <div className="listing-detail-main">
          {listing.description && (
            <div className="listing-detail-description">
              <h2>About this property</h2>
              <p>{listing.description}</p>
            </div>
          )}

          <div className="listing-detail-features">
            <h2>Features</h2>
            <div className="listing-detail-features-grid">
              {isLand ? (
                size && (
                  <div className="listing-detail-feature-box">
                    <span className="listing-detail-feature-value">{size.primary}</span>
                    <span className="listing-detail-feature-label">Land size</span>
                  </div>
                )
              ) : (
                <>
                  {listing.bedrooms != null && (
                    <div className="listing-detail-feature-box">
                      <span className="listing-detail-feature-value">{listing.bedrooms}</span>
                      <span className="listing-detail-feature-label">Bedrooms</span>
                    </div>
                  )}
                  {listing.bathrooms != null && (
                    <div className="listing-detail-feature-box">
                      <span className="listing-detail-feature-value">{listing.bathrooms}</span>
                      <span className="listing-detail-feature-label">Bathrooms</span>
                    </div>
                  )}
                  {listing.parking != null && (
                    <div className="listing-detail-feature-box">
                      <span className="listing-detail-feature-value">{listing.parking}</span>
                      <span className="listing-detail-feature-label">Parking</span>
                    </div>
                  )}
                </>
              )}
              <div className="listing-detail-feature-box">
                <span className="listing-detail-feature-value">{isUnverified ? 'Unverified' : 'Verified'}</span>
                <span className="listing-detail-feature-label">Listing status</span>
              </div>
            </div>
          </div>

          {!isUnverified && (
            <div className="listing-detail-documents">
              <h2>Verification documents</h2>
              {documentsLoading ? (
                <p className="listing-detail-documents-status">Loading documents…</p>
              ) : (
                <ul className="listing-detail-documents-list">
                  {documents.length === 0 ? (
                    <li className="listing-detail-document-row">
                      <span className="listing-detail-document-name">
                        <FileText size={16} /> No documents posted
                      </span>
                      <button
                        type="button"
                        className="listing-detail-document-view-btn"
                        disabled
                      >
                        View
                      </button>
                    </li>
                  ) : (
                    documents.map((doc) => (
                      <li key={doc.id} className="listing-detail-document-row">
                        <span className="listing-detail-document-name">
                          <FileText size={16} /> {doc.file_name}
                        </span>
                        <button
                          type="button"
                          className="listing-detail-document-view-btn"
                          onClick={() => openDocument(doc)}
                          disabled={viewerLoading}
                        >
                          {viewerLoading ? 'Opening…' : 'View'}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
              <p className="listing-detail-documents-hint">
                Documents open in-platform for verification purposes and cannot be downloaded.
              </p>
            </div>
          )}

          {listing.location_lat && listing.location_lng && (
            <div className="listing-detail-map">
              <h2>Location</h2>
              <div className="listing-detail-map-frame">
                <ListingsMap properties={[listing]} />
              </div>
            </div>
          )}
        </div>

        <aside className="listing-detail-sidebar">
          <div className="listing-detail-contact-card">
            <p className="listing-detail-contact-label">
              {isAgentListing ? 'Listed by agent' : 'Listed by'}
            </p>

            <div className="listing-detail-contact-identity">
              {contact?.avatar_url && (
                <img className="listing-detail-contact-avatar" src={contact.avatar_url} alt={contact.full_name} />
              )}
              <div>
                <p className="listing-detail-contact-name">
                  {contact?.full_name || (isUnverified ? 'Property owner' : 'Agent')}
                </p>
                {isAgentListing && contact?.agency_name && (
                  <p className="listing-detail-contact-agency">
                    <Building2 size={13} /> {contact.agency_name}
                  </p>
                )}
              </div>
            </div>

            {isUnverified ? (
              <span className="listing-detail-verify-badge listing-detail-verify-badge--unverified">
                <ShieldAlert size={14} /> Unverified listing
              </span>
            ) : (
              <span className="listing-detail-verify-badge listing-detail-verify-badge--verified">
                <ShieldCheck size={14} /> Verified
              </span>
            )}

            {(contact?.phone || contact?.email) && (
              <div className="listing-detail-contact-methods">
                {contact?.phone && (
                  <a href={`tel:${contact.phone}`} className="listing-detail-contact-row">
                    <Phone size={14} /> {contact.phone}
                  </a>
                )}
                {contact?.email && (
                  <a href={`mailto:${contact.email}`} className="listing-detail-contact-row">
                    <Mail size={14} /> {contact.email}
                  </a>
                )}
              </div>
            )}

            <button type="button" className="listing-detail-inquiry-btn listing-detail-inquiry-btn--sidebar" onClick={handleInquiry}>
              Send inquiry
            </button>

            {!isOwnListing && (
              <div className="listing-detail-viewing-request">
                <RequestViewingButton listingId={listing.id} />
              </div>
            )}

            {!isOwnListing && !isUnverified && (
              <button
                type="button"
                className="listing-detail-start-purchase-btn"
                onClick={handleStartPurchase}
                disabled={startingPurchase}
              >
                {startingPurchase ? 'Starting…' : 'Start purchase'}
              </button>
            )}
          </div>
        </aside>
      </div>

      {viewerDoc && (
        <DocumentViewer
          fileUrl={viewerDoc.signedUrl}
          fileType={viewerDoc.mime_type?.includes('pdf') ? 'pdf' : 'image'}
          fileName={viewerDoc.file_name}
          verified
          watermarkText={
            profile
              ? `${profile.full_name || profile.email} • ${new Date().toLocaleString()}`
              : undefined
          }
          onClose={() => setViewerDoc(null)}
        />
      )}
    </div>
  );
}