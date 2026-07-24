import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ShieldCheck, ChevronLeft, ChevronRight, ZoomOut, ZoomIn, X } from 'lucide-react';
import '../styles/documentViewer.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * DocumentViewer
 *
 * Renders a verified-listing document (PDF or image) in-app only.
 * No download link, no "open in new tab", no raw <img src> or
 * <embed>/<iframe> pointing at the file — everything is painted
 * onto a <canvas>, which makes "Save As" / drag-out much harder
 * (not impossible — nothing in a browser can be, see note below).
 *
 * Screenshots cannot be blocked by any web app. What this component
 * does instead: (1) removes the download affordance entirely,
 * (2) uses a short-lived signed `fileUrl` so the link itself is
 * useless once expired, (3) stamps a visible, tiled watermark with
 * the viewer's identity + timestamp onto every page so any leaked
 * screenshot is traceable back to who took it. That's the real
 * deterrent — treat it as a deterrent, not a lock.
 *
 * Props:
 *   fileUrl      - short-lived signed URL to the PDF or image (required)
 *   fileType     - 'pdf' | 'image'
 *   fileName     - display name, e.g. "Title Deed"
 *   verified     - bool, shows a verified badge in the header
 *   watermarkText- e.g. `${buyerName} • ${buyerEmail} • ${timestamp}`
 *   onClose      - close handler
 */
export default function DocumentViewer({
  fileUrl,
  fileType = 'pdf',
  fileName = 'Document',
  verified = false,
  watermarkText,
  onClose,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const pdfDocRef = useRef(null);

  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabHidden, setTabHidden] = useState(false);

  // Best-effort: blur the canvas while the tab is hidden/backgrounded.
  // Doesn't stop screenshots, but discourages casual screen-recording
  // apps that rely on the tab staying focused/visible.
  useEffect(() => {
    const handler = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Load the PDF document once we have a URL.
  useEffect(() => {
    if (fileType !== 'pdf' || !fileUrl) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    pdfjsLib
      .getDocument(fileUrl)
      .promise.then((doc) => {
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setPageNum(1);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load document:', err);
        setError('This document could not be loaded. The link may have expired — close and reopen it.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      pdfDocRef.current?.destroy?.();
    };
  }, [fileUrl, fileType]);

  // Render the current page to canvas whenever page/scale changes.
  const renderPage = useCallback(async () => {
    const doc = pdfDocRef.current;
    if (!doc || !canvasRef.current) return;

    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) {
      console.error('Failed to render page:', err);
      setError('This page could not be rendered.');
    }
  }, [pageNum, scale]);

  useEffect(() => {
    if (fileType === 'pdf') renderPage();
  }, [fileType, renderPage]);

  // Draw images onto canvas too, rather than an <img src="...">,
  // so there's no element a browser context menu can offer to save.
  useEffect(() => {
    if (fileType !== 'image' || !fileUrl || !canvasRef.current) return;
    setLoading(true);
    setError(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      setLoading(false);
    };
    img.onerror = () => {
      setError('This document could not be loaded. The link may have expired — close and reopen it.');
      setLoading(false);
    };
    img.src = fileUrl;
  }, [fileUrl, fileType]);

  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));

  return (
    <div
      className="doc-viewer-overlay"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="doc-viewer-modal" ref={containerRef}>
        <header className="doc-viewer-header">
          <div className="doc-viewer-title">
            <span>{fileName}</span>
            {verified && (
              <span className="doc-viewer-verified-badge">
                <ShieldCheck size={14} /> Verified
              </span>
            )}
          </div>

          <div className="doc-viewer-controls">
            {fileType === 'pdf' && numPages > 1 && (
              <>
                <button
                  type="button"
                  disabled={pageNum <= 1}
                  onClick={() => setPageNum((p) => p - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="doc-viewer-page-count">
                  {pageNum} / {numPages}
                </span>
                <button
                  type="button"
                  disabled={pageNum >= numPages}
                  onClick={() => setPageNum((p) => p + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            <button type="button" onClick={zoomOut} aria-label="Zoom out">
              <ZoomOut size={16} />
            </button>
            <button type="button" onClick={zoomIn} aria-label="Zoom in">
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              className="doc-viewer-close"
              onClick={onClose}
              aria-label="Close document"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="doc-viewer-body">
          {loading && <div className="doc-viewer-status">Loading document…</div>}
          {error && <div className="doc-viewer-status doc-viewer-error">{error}</div>}

          {!error && (
            <div
              className={`doc-viewer-canvas-wrap ${tabHidden ? 'doc-viewer-blurred' : ''}`}
              onCopy={(e) => e.preventDefault()}
            >
              <canvas ref={canvasRef} className="doc-viewer-canvas" />
              {watermarkText && (
                <div className="doc-viewer-watermark" aria-hidden="true">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span key={i}>{watermarkText}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="doc-viewer-footer">
          <p>
            This document is provided for verification purposes only and may not be
            downloaded or redistributed. Access is logged.
          </p>
        </footer>
      </div>
    </div>
  );
}