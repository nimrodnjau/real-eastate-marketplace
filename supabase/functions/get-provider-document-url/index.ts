// supabase/functions/get-provider-document-url/index.ts
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID")!;
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

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

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

  let body: { storageKey?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: cors });
  }

  if (!body.storageKey) {
    return new Response("Missing storageKey", { status: 400, headers: cors });
  }

  // Ownership check via path prefix rather than a provider_documents-table
  // lookup (contrast with get-document-url, which trusts RLS on a row that's
  // guaranteed to already exist). Here the attachment can be viewed before
  // the document row is ever saved, so there isn't always a documentId to
  // key off. TODO: once clients need to view documents *sent to them*, this
  // won't cover it — that'll need a separate function checking the caller is
  // the recipient on the provider_documents row (or its transaction), not
  // the uid in the path.
  const expectedPrefix = `provider-documents/${userData.user.id}/`;
  if (!body.storageKey.startsWith(expectedPrefix)) {
    return new Response("Forbidden", { status: 403, headers: cors });
  }

  const objectUrl = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${CF_R2_DOCUMENTS_BUCKET}/${body.storageKey}`;

  let signedUrl: string;
  try {
    const signedRequest = await r2.sign(objectUrl, {
      method: "GET",
      aws: { signQuery: true },
      expires: SIGNED_URL_TTL_SECONDS,
    });
    signedUrl = signedRequest.url;
  } catch (err) {
    console.error("Failed to sign URL", err);
    return new Response("Failed to generate view link", { status: 500, headers: cors });
  }

  return new Response(
    JSON.stringify({ url: signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
});