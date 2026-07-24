// supabase/functions/upload-listing-document/index.ts
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID")!;
const CF_ACCESS_KEY_ID = Deno.env.get("CF_DOCS_ACCESS_KEY_ID")!;
const CF_SECRET_ACCESS_KEY = Deno.env.get("CF_DOCS_SECRET_ACCESS_KEY")!;
// Separate, private bucket — do NOT reuse CF_R2_BUCKET (listing photos, public).
const CF_R2_DOCUMENTS_BUCKET = Deno.env.get("CF_R2_DOCUMENTS_BUCKET")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const r2 = new AwsClient({
  accessKeyId: CF_ACCESS_KEY_ID,
  secretAccessKey: CF_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 15 * 1024 * 1024; // 15MB — deeds/agreements scan larger than listing photos
const ALLOWED_DOCUMENT_TYPES = ["title_deed", "sale_agreement", "id_document", "survey_map", "other"];

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
  const listingId = form.get("listingId");
  const documentType = form.get("documentType");

  if (!(file instanceof File) || typeof listingId !== "string" || !listingId) {
    return new Response("Missing file or listingId", { status: 400, headers: cors });
  }
  if (typeof documentType !== "string" || !ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
    return new Response("Invalid documentType", { status: 400, headers: cors });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response("Unsupported file type (PDF, JPEG, PNG only)", { status: 400, headers: cors });
  }
  if (file.size > MAX_BYTES) {
    return new Response("File too large (max 15MB)", { status: 400, headers: cors });
  }

  // Ownership check — only the listing's seller can upload documents to it.
  // (RLS on the documents table enforces this again at the DB layer below,
  // this check just avoids wasting an R2 upload if it'll be rejected anyway.)
  const { data: listing, error: listingError } = await supabase
    .schema("marketplace")
    .from("listings")
    .select("id, seller_id")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    return new Response("Listing not found", { status: 404, headers: cors });
  }
  if (listing.seller_id !== userData.user.id) {
    return new Response("Forbidden", { status: 403, headers: cors });
  }

  const ext = file.name.split(".").pop() || "bin";
  // Private bucket — key is never turned into a public URL, only ever
  // accessed via a short-lived signed URL from get-document-url.
  const key = `documents/${listingId}/${crypto.randomUUID()}.${ext}`;
  const putUrl = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${CF_R2_DOCUMENTS_BUCKET}/${key}`;

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

  const { data: docRow, error: insertError } = await supabase
    .schema("marketplace")
    .from("documents")
    .insert({
      listing_id: listingId,
      uploaded_by: userData.user.id,
      document_type: documentType,
      file_name: file.name,
      storage_key: key,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Failed to save document record", insertError);
    return new Response("Uploaded but failed to save record", { status: 500, headers: cors });
  }

  return new Response(JSON.stringify({ document: docRow }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});