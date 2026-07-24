// supabase/functions/upload-agent-credential/index.ts
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Prefixed with MARKETPLACE_ — this Supabase project already has
// CF_ACCOUNT_ID / CF_ACCESS_KEY_ID / CF_SECRET_ACCESS_KEY secrets set for
// other purposes, so plain CF_* names would collide.
const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID")!;
const CF_ACCESS_KEY_ID = Deno.env.get("MARKETPLACE_CF_ACCESS_KEY_ID")!;
const CF_SECRET_ACCESS_KEY = Deno.env.get("MARKETPLACE_CF_SECRET_ACCESS_KEY")!;
// Deliberately a different bucket than the one listing photos use.
// Credentials are ID documents / business permits — this bucket must NOT
// have R2 public access enabled, unlike the photos bucket.
const CF_R2_PRIVATE_BUCKET = Deno.env.get("MARKETPLACE_CF_R2_PRIVATE_BUCKET")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const r2 = new AwsClient({
  accessKeyId: CF_ACCESS_KEY_ID,
  secretAccessKey: CF_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

// Keep in sync with ALLOWED_TYPES / MAX_BYTES in AgentCredentialsSection.jsx
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 15 * 1024 * 1024; // 15MB per credential

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

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
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
  const agentId = form.get("agentId");
  const credentialType = form.get("credentialType");

  if (!(file instanceof File) || typeof agentId !== "string" || !agentId) {
    return new Response("Missing file or agentId", { status: 400, headers: cors });
  }
  if (typeof credentialType !== "string" || !credentialType) {
    return new Response("Missing credentialType", { status: 400, headers: cors });
  }

  // Agents may only upload credentials for themselves — no ownership
  // lookup needed here (unlike listings, which can belong to a seller
  // *or* their agent), since a credential always belongs to the uploader.
  if (agentId !== userData.user.id) {
    return new Response("You can only upload credentials for your own account", {
      status: 403,
      headers: cors,
    });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response("Only PDF, JPEG, or PNG files are allowed", { status: 400, headers: cors });
  }
  if (file.size > MAX_BYTES) {
    return new Response("File too large (max 15MB)", { status: 400, headers: cors });
  }

  const safeName = sanitizeFileName(file.name);
  const key = `agent-credentials/${agentId}/${crypto.randomUUID()}-${safeName}`;
  const putUrl = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${CF_R2_PRIVATE_BUCKET}/${key}`;

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

  // Insert via the user-scoped client so this relies on the same RLS
  // policy shape as the rest of the app (agent_id = auth.uid()), rather
  // than a service-role bypass.
  const { data: credential, error: insertError } = await supabase
    .schema("marketplace")
    .from("agent_credentials")
    .insert({
      agent_id: agentId,
      credential_type: credentialType,
      file_name: file.name,
      storage_path: key,
      content_type: file.type,
      file_size: file.size,
      status: "pending",
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("Failed to save credential reference", insertError);
    return new Response("Uploaded but failed to save reference", { status: 500, headers: cors });
  }

  return new Response(JSON.stringify({ credential }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});