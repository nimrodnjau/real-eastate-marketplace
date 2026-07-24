// supabase/functions/upload-listing-image/index.ts
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID")!;
const CF_ACCESS_KEY_ID = Deno.env.get("CF_ACCESS_KEY_ID")!;
const CF_SECRET_ACCESS_KEY = Deno.env.get("CF_SECRET_ACCESS_KEY")!;
const CF_R2_BUCKET = Deno.env.get("CF_R2_BUCKET")!;
const CF_PUBLIC_CDN_BASE = Deno.env.get("CF_PUBLIC_CDN_BASE")!; // e.g. https://pub-xxxx.r2.dev

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const r2 = new AwsClient({
  accessKeyId: CF_ACCESS_KEY_ID,
  secretAccessKey: CF_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024; // 8MB per photo
const MAX_IMAGES_PER_LISTING = 6; // matches listings_images_max6 DB constraint

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
  const folderId = form.get("folderId"); // this is the listing's id

  if (!(file instanceof File) || typeof folderId !== "string" || !folderId) {
    return new Response("Missing file or folderId", { status: 400, headers: cors });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response("Unsupported file type", { status: 400, headers: cors });
  }
  if (file.size > MAX_BYTES) {
    return new Response("File too large (max 8MB)", { status: 400, headers: cors });
  }

  // --- Ownership + capacity check ---
  // NOTE: column is `seller_id`, not `owner_id` — matches marketplace.listings schema.
  // Also allow the listing's assigned agent to upload — agents can create
  // and manage their own listings, not just sellers. (If/when the schema
  // moves to a role-agnostic `created_by` column, this should become
  // `listing.created_by === userData.user.id` instead of the two-column check.)
  const { data: listing, error: listingError } = await supabase
    .schema("marketplace")
    .from("listings")
    .select("id, seller_id, agent_id, images")
    .eq("id", folderId)
    .single();

  if (listingError || !listing) {
    return new Response("Listing not found", { status: 404, headers: cors });
  }

  const isOwner = listing.seller_id === userData.user.id || listing.agent_id === userData.user.id;
  if (!isOwner) {
    return new Response("Forbidden", { status: 403, headers: cors });
  }

  const currentImages = Array.isArray(listing.images) ? listing.images : [];
  if (currentImages.length >= MAX_IMAGES_PER_LISTING) {
    return new Response(`Maximum ${MAX_IMAGES_PER_LISTING} photos per listing`, { status: 400, headers: cors });
  }

  const ext = file.type.split("/")[1];
  const key = `listings/${folderId}/${crypto.randomUUID()}.${ext}`;
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

  const newImage = { url: `${CF_PUBLIC_CDN_BASE}/${key}`, key };

  // Append the new image to the listing's images array server-side,
  // so the DB stays consistent even if the client never confirms.
  const { error: updateError } = await supabase
    .schema("marketplace")
    .from("listings")
    .update({ images: [...currentImages, newImage] })
    .eq("id", folderId);

  if (updateError) {
    console.error("Failed to save image reference to listing", updateError);
    return new Response("Uploaded but failed to save reference", { status: 500, headers: cors });
  }

  return new Response(
    JSON.stringify({ image: newImage, images: [...currentImages, newImage] }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
});