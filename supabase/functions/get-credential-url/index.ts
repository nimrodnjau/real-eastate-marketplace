// supabase/functions/get-credential-url/index.ts
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Prefixed with MARKETPLACE_ — this Supabase project already has
// CF_ACCOUNT_ID / CF_ACCESS_KEY_ID / CF_SECRET_ACCESS_KEY secrets set for
// other purposes, so plain CF_* names would collide.
const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID")!;
const CF_ACCESS_KEY_ID = Deno.env.get("MARKETPLACE_CF_ACCESS_KEY_ID")!;
const CF_SECRET_ACCESS_KEY = Deno.env.get("MARKETPLACE_CF_SECRET_ACCESS_KEY")!;
const CF_R2_PRIVATE_BUCKET = Deno.env.get("MARKETPLACE_CF_R2_PRIVATE_BUCKET")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const r2 = new AwsClient({
  accessKeyId: CF_ACCESS_KEY_ID,
  secretAccessKey: CF_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const URL_TTL_SECONDS = 300; // 5 minutes

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

  let body: { credentialId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: cors });
  }

  const { credentialId } = body;
  if (!credentialId) {
    return new Response("Missing credentialId", { status: 400, headers: cors });
  }

  // Fetched through the user-scoped client, so RLS already restricts this
  // to the caller's own rows — the explicit agent_id check below is
  // defense in depth, same pattern as the ownership check on listings.
  const { data: credential, error: fetchError } = await supabase
    .schema("marketplace")
    .from("agent_credentials")
    .select("id, agent_id, storage_path")
    .eq("id", credentialId)
    .single();

  if (fetchError || !credential) {
    return new Response("Credential not found", { status: 404, headers: cors });
  }
  if (credential.agent_id !== userData.user.id) {
    return new Response("Forbidden", { status: 403, headers: cors });
  }

  // Presigned GET: sign with signQuery so the auth lives in the query
  // string, then set X-Amz-Expires before signing to control the TTL
  // (aws4fetch preserves whatever expiry is already on the URL).
  const signUrl = new URL(
    `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${CF_R2_PRIVATE_BUCKET}/${credential.storage_path}`,
  );
  signUrl.searchParams.set("X-Amz-Expires", String(URL_TTL_SECONDS));

  let signedUrl: string;
  try {
    const signedRequest = await r2.sign(signUrl.toString(), {
      method: "GET",
      aws: { signQuery: true },
    });
    signedUrl = signedRequest.url;
  } catch (err) {
    console.error("Failed to sign R2 URL", err);
    return new Response("Could not open document", { status: 502, headers: cors });
  }

  return new Response(JSON.stringify({ url: signedUrl }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});