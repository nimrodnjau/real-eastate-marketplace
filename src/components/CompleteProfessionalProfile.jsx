// components/CompleteProfessionalProfile.jsx
//
// Gate + form for professional-role users (lawyer, valuer, surveyor) who
// don't yet have a marketplace.service_provider_profiles row. Reads/writes
// the same table EngageProfessionalsModule reads from, so once a row lands
// here (verification_status starts at 'pending', the column default) it's
// immediately visible to that module's directory query as soon as an admin
// flips it to 'verified'.
//
// INTEGRATION NOTES — things this file can't know without seeing your
// AuthContext / storage setup:
// 1. `userId` / `role` come in as props rather than pulled from context
//    directly, so this drops in regardless of your AuthContext's exact
//    shape. Mount it wherever the logged-in profile is available, e.g.
//    <CompleteProfessionalProfile userId={profile.id} role={profile.role} />
// 2. Certification upload assumes a Supabase Storage bucket named
//    'provider-credentials' already exists, and treats it as PUBLIC via
//    getPublicUrl() below. If these documents should stay private, swap
//    that for a signed URL (createSignedUrl) instead — same call you'll
//    need to make for the listing-document viewer.
// 3. No location fields — skipped to keep the form minimal. Add
//    location_lat/location_lng inputs the same way as license_number
//    below if you want them collected here too.

import { useEffect, useState } from 'react';
import { ShieldCheck, UploadCloud } from 'lucide-react';
import { db } from '../lib/supabaseClient';
import '../styles/complete-professional-profile.css';

const PROVIDER_ROLES = ['lawyer', 'valuer', 'surveyor'];
const CREDENTIALS_BUCKET = 'provider-credentials';

export default function CompleteProfessionalProfile({ userId, role }) {
  const isProfessional = PROVIDER_ROLES.includes(role);

  const [checking, setChecking] = useState(true);
  const [existingProfile, setExistingProfile] = useState(null);

  const [licenseNumber, setLicenseNumber] = useState('');
  const [bio, setBio] = useState('');
  const [credentialFile, setCredentialFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Does a service_provider_profiles row already exist for this user?
  useEffect(() => {
    if (!isProfessional || !userId) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);

    db.schema('marketplace')
      .from('service_provider_profiles')
      .select('user_id, verification_status')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        else setExistingProfile(data);
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, isProfessional]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!licenseNumber.trim() || !credentialFile || submitting) return;

    setSubmitting(true);
    setError(null);

    // 1. Upload the certification file.
    const filePath = `${userId}/${Date.now()}-${credentialFile.name}`;
    const { error: uploadError } = await db.storage
      .from(CREDENTIALS_BUCKET)
      .upload(filePath, credentialFile);

    if (uploadError) {
      setError(uploadError.message);
      setSubmitting(false);
      return;
    }

    const { data: urlData } = db.storage.from(CREDENTIALS_BUCKET).getPublicUrl(filePath);

    // 2. Create the service_provider_profiles row. provider_type reuses
    // `role` directly since the two enums share the same label strings
    // for lawyer/valuer/surveyor. verification_status is left unset so
    // it falls back to the column default ('pending').
    const { error: insertError } = await db
      .schema('marketplace')
      .from('service_provider_profiles')
      .insert({
        user_id: userId,
        provider_type: role,
        license_number: licenseNumber.trim(),
        bio: bio.trim() || null,
        credential_url: urlData?.publicUrl,
      });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setExistingProfile({ user_id: userId, verification_status: 'pending' });
  }

  if (!isProfessional) return null;
  if (checking) return <p className="complete-profile-state">Loading…</p>;

  if (existingProfile) {
    return (
      <div className="complete-profile-status">
        <ShieldCheck size={16} />
        {existingProfile.verification_status === 'verified'
          ? 'Your professional profile is verified.'
          : 'Your professional profile is submitted and pending verification.'}
      </div>
    );
  }

  return (
    <form className="complete-profile-form" onSubmit={handleSubmit}>
      <h2 className="complete-profile-title">Complete your professional profile</h2>
      <p className="complete-profile-subtitle">
        Buyers can't find or engage you until this is submitted and verified.
      </p>

      {error && <p className="complete-profile-error">{error}</p>}

      <label className="complete-profile-field">
        License number
        <input
          type="text"
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
          required
        />
      </label>

      <label className="complete-profile-field">
        Bio (optional)
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
      </label>

      <label className="complete-profile-field complete-profile-upload">
        <UploadCloud size={16} />
        {credentialFile ? credentialFile.name : 'Upload certification'}
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setCredentialFile(e.target.files?.[0] || null)}
          required
        />
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit for verification'}
      </button>
    </form>
  );
}