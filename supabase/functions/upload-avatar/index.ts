// supabase/functions/upload-avatar/index.ts
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID")!;
const CF_ACCESS_KEY_ID = Deno.env.get("CF_ACCESS_PROFILE_KEY_ID")!;
const CF_SECRET_ACCESS_KEY = Deno.env.get("CF_SECRET_PROFILE_ACCESS_KEY_ID")!;
const CF_R2_BUCKET = Deno.env.get("CF_R2_PROFILE_BUCKET")!;
const CF_PUBLIC_CDN_BASE = Deno.env.get("CF_PUBLIC_PROFILE_CDN_BASE")!; // e.g. https://pub-xxxx.r2.dev

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const r2 = new AwsClient({
  accessKeyId: CF_ACCESS_KEY_ID,
  secretAccessKey: CF_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024; // 4MB — avatars don't need the 8MB listing-photo allowance

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://your-marketplace-domain.com",
];

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response("Invalid form data", { status: 400, headers: cors });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return new Response("Missing file", { status: 400, headers: cors });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response("Unsupported file type", { status: 400, headers: cors });
  }
  if (file.size > MAX_BYTES) {
    return new Response("File too large (max 4MB)", { status: 400, headers: cors });
  }

  // No separate ownership check needed — a user can only ever upload their
  // own avatar, keyed off their own auth'd user id, never someone else's.
  const userId = userData.user.id;
  const ext = file.type.split("/")[1];
  // Deterministic key (not a random UUID like listing photos) so re-uploads
  // overwrite the previous avatar in R2 rather than accumulating orphans.
  const key = `avatars/${userId}.${ext}`;
  const putUrl = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${CF_R2_BUCKET}/${key}`;

  let putRes: Response;
  try {
    putRes = await r2.fetch(putUrl, {
      method: "PUT",
      body: new Uint8Array(await file.arrayBuffer()),
      headers: { "Content-Type": file.type },
    });
  } catch (err) {
    console.error("R2 request threw", err);
    return new Response("Upload failed", { status: 502, headers: cors });
  }

  if (!putRes.ok) {
    console.error("R2 upload failed", await putRes.text());
    return new Response("Upload failed", { status: 502, headers: cors });
  }

  // Cache-bust: CDN/browser caches may still hold the old file at this key,
  // so append a version query param the <img> tag will actually refetch.
  const avatarUrl = `${CF_PUBLIC_CDN_BASE}/${key}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .schema("marketplace")
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to save avatar reference to profile", updateError);
    return new Response("Uploaded but failed to save reference", { status: 500, headers: cors });
  }

  return new Response(
    JSON.stringify({ avatar_url: avatarUrl }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
});