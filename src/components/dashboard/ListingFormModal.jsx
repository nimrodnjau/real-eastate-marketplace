// components/dashboard/ListingFormModal.jsx
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient'; // adjust to your actual client path
import LocationPicker from './LocationPicker';
import '../../styles/location-picker.css';

const EMPTY = {
  title: '', description: '', property_type: 'land', price: '', address: '',
  bedrooms: '', bathrooms: '', parking: '', size_value: '', size_unit: 'acres',
  location_lat: null, location_lng: null,
};
const MAX_IMAGES = 6;

const STATUS_LABEL = {
  draft:           'Draft',
  pending_review:  'Pending verification',
  active:          'Live',
  under_offer:     'Under offer',
  sold:            'Sold',
  rejected:        'Rejected',
};

// Kept in sync with SellerDashboard.LOCKED_STATUSES.
const LOCKED_STATUSES = ['under_offer', 'sold'];

// Free, no-API-key geocoder. Fine for the low volume of listing saves here —
// swap for Google Geocoding (or cache results) if this ever needs to scale up.
async function geocodeAddress(address) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`
  );
  if (!res.ok) throw new Error('Geocoding request failed');
  const data = await res.json();
  if (!data?.[0]) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export default function ListingFormModal({ listing, propertyTypes, error, onSave, onClose }) {
  const [values, setValues] = useState(listing ? {
    title: listing.title || '',
    description: listing.description || '',
    property_type: listing.property_type || 'land',
    price: listing.price || '',
    address: listing.address || '',
    bedrooms: listing.bedrooms ?? '',
    bathrooms: listing.bathrooms ?? '',
    parking: listing.parking ?? '',
    size_value: listing.size_value ?? '',
    size_unit: listing.size_unit || 'acres',
    location_lat: listing.location_lat ?? null,
    location_lng: listing.location_lng ?? null,
  } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState(null);

  // Once we have a listing id (either passed in for edit, or returned
  // after the first save when creating), photo upload becomes available.
  const [activeListing, setActiveListing] = useState(listing || null);
  const [images, setImages] = useState(listing?.images || []);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  const isLocked = activeListing && LOCKED_STATUSES.includes(activeListing.status);
  const willReturnToReview = activeListing && activeListing.status === 'active';
  const canUploadPhotos = !!activeListing?.id;

  const set = (field, val) => setValues((v) => ({ ...v, [field]: val }));

  function setLocation(lat, lng) {
    setValues((v) => ({ ...v, location_lat: lat, location_lng: lng }));
    setGeocodeError(null);
  }

  async function handleLocate() {
    if (!values.address.trim()) {
      setGeocodeError('Enter an address first.');
      return;
    }
    setGeocoding(true);
    setGeocodeError(null);
    try {
      const result = await geocodeAddress(values.address);
      if (!result) {
        setGeocodeError("Couldn't find that address — drop the pin manually instead.");
      } else {
        setLocation(result.lat, result.lng);
      }
    } catch (err) {
      console.error(err);
      setGeocodeError('Lookup failed — drop the pin manually instead.');
    } finally {
      setGeocoding(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (isLocked) return;
    if (!values.title.trim() || !values.price) return;
    setSaving(true);
    const result = await onSave(values);
    setSaving(false);

    // On successful create, the parent returns the new row (with id) —
    // switch into "photos" mode instead of closing.
    if (result?.ok && result.listing && !activeListing) {
      setActiveListing(result.listing);
      setImages(result.listing.images || []);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file || !activeListing?.id) return;

    if (images.length >= MAX_IMAGES) {
      setPhotoError(`Maximum ${MAX_IMAGES} photos per listing.`);
      return;
    }

    setUploading(true);
    setPhotoError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderId', activeListing.id);

      const { data, error: fnError } = await supabase.functions.invoke(
        'upload-listing-image',
        { body: formData }
      );

      if (fnError) throw new Error(fnError.message || 'Upload failed');
      setImages(data.images);
    } catch (err) {
      console.error(err);
      setPhotoError(err.message || 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  // Removes the image from this listing's array locally + in the DB.
  // Note: this does NOT delete the file from R2 itself — that needs a
  // separate delete edge function if you want to avoid orphaned files.
  async function handleRemoveImage(key) {
    if (!activeListing?.id) return;
    const updated = images.filter((img) => img.key !== key);
    const { error: updateError } = await supabase
      .schema('marketplace')
      .from('listings')
      .update({ images: updated })
      .eq('id', activeListing.id);

    if (updateError) {
      setPhotoError(updateError.message);
      return;
    }
    setImages(updated);
  }

  const isCreatingAndSaved = !listing && activeListing; // just-created, now in photo step

  return (
    <div className="dashboard-modal-overlay" onClick={onClose}>
      <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          {isCreatingAndSaved ? 'Add photos' : listing ? 'Edit listing' : 'Add listing'}
        </h3>

        {activeListing && (
          <p className="dashboard-modal-status">
            Status: <strong>{STATUS_LABEL[activeListing.status] || activeListing.status}</strong>
          </p>
        )}

        {isLocked && (
          <p className="dashboard-modal-warning">
            This listing is {STATUS_LABEL[activeListing.status].toLowerCase()} and can't be edited.
          </p>
        )}

        {!isLocked && willReturnToReview && !isCreatingAndSaved && (
          <p className="dashboard-modal-hint">
            Saving changes will send this listing back for verification before it's live again.
          </p>
        )}

        {error && <p className="dashboard-modal-error">{error}</p>}

        {/* Text fields — hidden once a newly-created listing moves into the photo step */}
        {!isCreatingAndSaved && (
          <form onSubmit={submit}>
            <fieldset disabled={isLocked || saving} className="dashboard-modal-fields">
              <label>Title
                <input value={values.title} onChange={(e) => set('title', e.target.value)} required />
              </label>
              <label>Property type
                <select value={values.property_type} onChange={(e) => set('property_type', e.target.value)}>
                  {propertyTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>Price (KES)
                <input type="number" min="0" value={values.price} onChange={(e) => set('price', e.target.value)} required />
              </label>

              <label>Address
                <div className="location-address-row">
                  <input value={values.address} onChange={(e) => set('address', e.target.value)} />
                  <button
                    type="button"
                    className="location-locate-btn"
                    onClick={handleLocate}
                    disabled={geocoding || !values.address.trim()}
                  >
                    {geocoding ? 'Locating…' : 'Locate'}
                  </button>
                </div>
              </label>

              <div className="location-picker-field">
                <div className="location-picker-label-row">
                  <span>Pin location</span>
                  <span className="location-picker-hint">Click the map or drag the pin to adjust</span>
                </div>
                {geocodeError && <p className="dashboard-modal-error">{geocodeError}</p>}
                <LocationPicker
                  lat={values.location_lat}
                  lng={values.location_lng}
                  onChange={setLocation}
                />
                {values.location_lat == null && (
                  <p className="location-picker-empty">
                    No pin set yet — use "Locate" or click the map.
                  </p>
                )}
              </div>

              {values.property_type === 'land' ? (
                <>
                  <label>Size
                    <input
                      type="number" min="0" step="0.01"
                      value={values.size_value}
                      onChange={(e) => set('size_value', e.target.value)}
                    />
                  </label>
                  <label>Size unit
                    <select value={values.size_unit} onChange={(e) => set('size_unit', e.target.value)}>
                      <option value="acres">Acres</option>
                      <option value="sqm">Square meters</option>
                      <option value="sqft">Square feet</option>
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label>Bedrooms
                    <input type="number" min="0" value={values.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
                  </label>
                  <label>Bathrooms
                    <input type="number" min="0" value={values.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
                  </label>
                  <label>Parking spaces
                    <input type="number" min="0" value={values.parking} onChange={(e) => set('parking', e.target.value)} />
                  </label>
                </>
              )}
              <label>Description
                <textarea rows={4} value={values.description} onChange={(e) => set('description', e.target.value)} />
              </label>
            </fieldset>
            <div className="dashboard-modal-actions">
              <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
              {!isLocked && (
                <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              )}
            </div>
          </form>
        )}

        {/* Photos section — visible once the listing has an id (edit mode,
            or right after the first save when creating) */}
        {canUploadPhotos && !isLocked && (
          <div className="dashboard-modal-photos">
            <p className="dashboard-modal-photos-label">
              Photos ({images.length}/{MAX_IMAGES})
            </p>

            {photoError && <p className="dashboard-modal-error">{photoError}</p>}

            <div className="photo-grid">
              {images.map((img) => (
                <div key={img.key} className="photo-thumb">
                  <img src={img.url} alt="" />
                  <button
                    type="button"
                    className="photo-remove-btn"
                    onClick={() => handleRemoveImage(img.key)}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}

              {images.length < MAX_IMAGES && (
                <label className="photo-add-tile">
                  {uploading ? 'Uploading…' : '+ Add photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    disabled={uploading}
                    hidden
                  />
                </label>
              )}
            </div>

            {isCreatingAndSaved && (
              <div className="dashboard-modal-actions">
                <button type="button" onClick={onClose}>Done</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}