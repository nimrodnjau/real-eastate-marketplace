// supabase/functions/get-attachment-url/index.ts
//
// Given a message_id, returns a short-lived presigned URL for its sale
// document attachment. RLS on the user-scoped client is the real access
// check — if the caller isn't a participant in that message's conversation,
// the select returns nothing and we 404, regardless of what message_id
// they passed in. Same credential/CORS conventions as
// upload-message-attachment and upload-listing-document.

import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID")!;
const CF_ACCESS_KEY_ID = Deno.env.get("CF_SALE_DOCS_ACCESS_KEY_ID")!;
const CF_SECRET_ACCESS_KEY = Deno.env.get("CF_SALE_DOCS_SECRET_ACCESS_KEY")!;
const CF_R2_SALE_DOCUMENTS_BUCKET = Deno.env.get("CF_R2_SALE_DOCUMENTS_BUCKET")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const URL_EXPIRY_SECONDS = 300; // 5 minutes

const r2 = new AwsClient({
  accessKeyId: CF_ACCESS_KEY_ID,
  secretAccessKey: CF_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://your-marketplace-domain.com",
];

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing authorization" }, 401, cors);

  const messageId = new URL(req.url).searchParams.get("message_id");
  if (!messageId) return json({ error: "Missing message_id" }, 400, cors);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401, cors);

  const { data: message, error: messageError } = await supabase
    .schema("marketplace")
    .from("messages")
    .select("attachment_storage_path")
    .eq("id", messageId)
    .single();

  if (messageError || !message?.attachment_storage_path) {
    return json({ error: "Attachment not found" }, 404, cors);
  }

  const objectUrl = new URL(
    `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${CF_R2_SALE_DOCUMENTS_BUCKET}/${message.attachment_storage_path}`
  );
  // aws4fetch presigns by signing whatever query string is already on the
  // URL — X-Amz-Expires has to be set before calling sign(), not after.
  objectUrl.searchParams.set("X-Amz-Expires", String(URL_EXPIRY_SECONDS));

  let signedRequest: Request;
  try {
    signedRequest = await r2.sign(objectUrl.toString(), {
      method: "GET",
      aws: { signQuery: true },
    });
  } catch (err) {
    console.error("Failed to sign R2 URL", err);
    return json({ error: "Failed to generate link" }, 502, cors);
  }

  return json({ url: signedRequest.url }, 200, cors);
});