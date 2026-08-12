// supabase/functions/upload-provider-document/index.ts
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID")!;
// Reuses the same docs-scoped R2 token + private bucket as upload-listing-document,
// just a different key prefix (provider-documents/ vs documents/). If you'd rather
// isolate provider-drafted documents in their own bucket, swap CF_R2_DOCUMENTS_BUCKET
// below for a new env var (e.g. CF_R2_PROVIDER_DOCS_BUCKET) — flag if so.
const CF_ACCESS_KEY_ID = Deno.env.get("CF_DOCS_ACCESS_KEY_ID")!;
const CF_SECRET_ACCESS_KEY = Deno.env.get("CF_DOCS_SECRET_ACCESS_KEY")!;
const CF_R2_DOCUMENTS_BUCKET = Deno.env.get("CF_R2_DOCUMENTS_BUCKET")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const r2 = new AwsClient({
  accessKeyId: CF_ACCESS_KEY_ID,
  secretAccessKey: CF_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
];
const MAX_BYTES = 25 * 1024 * 1024; // 25MB — matches MAX_ATTACHMENT_MB in DocumentEditorSection.jsx

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
    return new Response("Unsupported file type (PDF, Word, Excel, PNG, JPEG only)", { status: 400, headers: cors });
  }
  if (file.size > MAX_BYTES) {
    return new Response("File too large (max 25MB)", { status: 400, headers: cors });
  }

  // No listing/transaction ownership check here, unlike upload-listing-document —
  // a provider document may not have a saved DB row (or even a chosen client/
  // transaction) yet at the moment a file gets attached to it. The object key
  // is instead self-scoped under the caller's own uid, and that's what
  // get-provider-document-url checks against before it will sign a GET url.
  const ext = file.name.split(".").pop() || "bin";
  const key = `provider-documents/${userData.user.id}/${crypto.randomUUID()}.${ext}`;
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

  // Deliberately no DB insert here (unlike upload-listing-document) — the
  // marketplace.provider_documents row is created/updated client-side on
  // Save draft / Send, same as title/content/doc_type already are. We just
  // hand back what that row will need in order to reference the object.
  return new Response(
    JSON.stringify({
      storageKey: key,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
});