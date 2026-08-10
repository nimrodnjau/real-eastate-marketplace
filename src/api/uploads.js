// src/api/uploads.js

import { supabase } from '../lib/supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Uploads a profile picture via the `upload-avatar` edge function, which
// handles the R2 PUT server-side and writes the new avatar_url onto
// marketplace.profiles itself (see supabase/functions/upload-avatar/index.ts).
// Returns the new avatar_url on success.
export async function uploadAvatarToR2(file) {
 const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not authenticated — please sign in again.');

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Deliberately NOT setting Content-Type — the browser sets the
      // correct multipart/form-data boundary automatically for FormData.
    },
    body: form,
  });

  if (!res.ok) {
    const message = await res.text().catch(() => 'Upload failed');
    throw new Error(message || `Upload failed (${res.status})`);
  }

  const data = await res.json();
  if (!data?.avatar_url) {
    throw new Error('Upload succeeded but no avatar_url was returned.');
  }

  return data.avatar_url;
}