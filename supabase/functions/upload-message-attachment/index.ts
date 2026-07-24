// supabase/functions/upload-message-attachment/index.ts
//
// Uploads a document (contract / valuation certificate / survey report /
// other) sent between a professional and an agent in a chat, to the
// private "sale documents" R2 bucket, then inserts the corresponding
// `messages` row. Mirrors the conventions of upload-listing-document:
// aws4fetch for R2, an explicit ALLOWED_ORIGINS allowlist for CORS, and a
// user-scoped Supabase client throughout (no service role) so RLS is what
// actually enforces who can insert what — same as a normal text send.

import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared across features — same Cloudflare account as upload-listing-document.
const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID")!;
// Separate token + bucket, scoped only to sale documents sent via chat —
// distinct from CF_DOCS_ACCESS_KEY_ID/CF_R2_DOCUMENTS_BUCKET (listing docs)
// and from the public listing-photos bucket.
const CF_ACCESS_KEY_ID = Deno.env.get("CF_SALE_DOCS_ACCESS_KEY_ID")!;
const CF_SECRET_ACCESS_KEY = Deno.env.get("CF_SALE_DOCS_SECRET_ACCESS_KEY")!;
const CF_R2_SALE_DOCUMENTS_BUCKET = Deno.env.get("CF_R2_SALE_DOCUMENTS_BUCKET")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const r2 = new AwsClient({
  accessKeyId: CF_ACCESS_KEY_ID,
  secretAccessKey: CF_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const ALLOWED_DOCUMENT_TYPES = ["contract", "valuation_certificate", "survey_report", "other"];
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_BYTES = 25 * 1024 * 1024; // 25MB

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

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, cors);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "Unauthorized" }, 401, cors);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Invalid form data" }, 400, cors);
  }

  const file = form.get("file");
  const conversationId = form.get("conversation_id");
  const documentType = form.get("document_type") ?? "other";
  const listingId = form.get("listing_id") || null;

  if (!(file instanceof File) || typeof conversationId !== "string" || !conversationId) {
    return json({ error: "Missing file or conversation_id" }, 400, cors);
  }
  if (typeof documentType !== "string" || !ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
    return json({ error: "Invalid document_type" }, 400, cors);
  }
  if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
    return json({ error: "Unsupported file type" }, 400, cors);
  }
  if (file.size > MAX_BYTES) {
    return json({ error: "File too large (25MB max)" }, 400, cors);
  }

  // Ownership/participancy check — only someone actually in this
  // conversation can attach a document to it. (RLS on messages enforces
  // this again at the DB layer below; this just avoids burning an R2
  // upload on a request that would be rejected anyway.)
  const { data: convo, error: convoError } = await supabase
    .schema("marketplace")
    .from("conversations")
    .select("id, participant_one, participant_two")
    .eq("id", conversationId)
    .single();

  if (convoError || !convo) {
    return json({ error: "Conversation not found" }, 404, cors);
  }
  if (convo.participant_one !== userData.user.id && convo.participant_two !== userData.user.id) {
    return json({ error: "Forbidden" }, 403, cors);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Private bucket — key is never turned into a public URL, only ever
  // accessed via a short-lived signed URL from get-attachment-url.
  const key = `${conversationId}/${crypto.randomUUID()}-${safeName}`;
  const putUrl = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${CF_R2_SALE_DOCUMENTS_BUCKET}/${key}`;

  let putRes: Response;
  try {
    putRes = await r2.fetch(putUrl, {
      method: "PUT",
      body: new Uint8Array(await file.arrayBuffer()),
      headers: { "Content-Type": file.type },
    });
  } catch (err) {
    console.error("R2 request threw", err);
    return json({ error: "Upload failed" }, 502, cors);
  }

  if (!putRes.ok) {
    console.error("R2 upload failed", await putRes.text());
    return json({ error: "Upload failed" }, 502, cors);
  }

  // User-scoped insert (not service role) — same client the normal
  // text-message send already uses, so it behaves identically: same RLS
  // policy, same triggers updating conversations.last_message, same
  // realtime INSERT event the chat is already listening for.
  //
  // NOTE: `body` is NOT NULL on marketplace.messages, so an attachment-only
  // message (no caption) is sent as an empty string rather than null —
  // otherwise this insert fails with a 23502 not-null violation.
  const { data: message, error: insertError } = await supabase
    .schema("marketplace")
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: userData.user.id,
      body: "",
      attachment_storage_path: key,
      attachment_file_name: file.name,
      attachment_content_type: file.type,
      attachment_file_size: file.size,
      attachment_document_type: documentType,
      attachment_listing_id: listingId,
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("Failed to save message record", insertError);
    return json({ error: "Uploaded but failed to save message" }, 500, cors);
  }

  return json(message, 200, cors);
});