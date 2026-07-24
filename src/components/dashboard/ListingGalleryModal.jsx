// components/dashboard/ListingGalleryModal.jsx
import { useState, useEffect, useCallback } from 'react';

export default function ListingGalleryModal({ listing, onClose }) {
  const images = listing?.images || [];
  const [index, setIndex] = useState(0);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, goPrev, goNext]);

  return (
    <div className="gallery-scrim" onClick={onClose}>
      <div
        className="gallery-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Photos for ${listing?.title || 'listing'}`}
      >
        <div className="gallery-panel-header">
          <div>
            <p className="gallery-eyebrow">Listing photos</p>
            <h3 className="gallery-title">{listing?.title}</h3>
          </div>
          <button className="gallery-close-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M1 1L17 17M17 1L1 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {images.length === 0 ? (
          <div className="gallery-empty">
            <p>No photos uploaded yet.</p>
          </div>
        ) : (
          <>
            <div className="gallery-main">
              {images.length > 1 && (
                <button className="gallery-nav-btn gallery-nav-prev" onClick={goPrev} aria-label="Previous photo">
                  ‹
                </button>
              )}
              <img
                className="gallery-main-image"
                src={images[index].url}
                alt={`${listing?.title || 'Listing'} photo ${index + 1}`}
              />
              {images.length > 1 && (
                <button className="gallery-nav-btn gallery-nav-next" onClick={goNext} aria-label="Next photo">
                  ›
                </button>
              )}
              <span className="gallery-counter">{index + 1} / {images.length}</span>
            </div>

            {images.length > 1 && (
              <div className="gallery-thumbs">
                {images.map((img, i) => (
                  <button
                    key={img.key}
                    className={`gallery-thumb-btn ${i === index ? 'gallery-thumb-btn--active' : ''}`}
                    onClick={() => setIndex(i)}
                    aria-label={`Go to photo ${i + 1}`}
                  >
                    <img src={img.url} alt="" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}