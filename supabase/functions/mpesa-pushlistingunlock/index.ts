// ═══════════════════════════════════════════════════════════════
// UIP — mpesa-pushlistingunlock Edge Function
// Deploy to: supabase/functions/mpesa-pushlistingunlock/index.ts
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET
//   MPESA_SHORTCODE, MPESA_PASSKEY
//   MPESA_LISTING_CALLBACK_URL  ← separate from deposit/rent callbacks
//   MPESA_ENV, MPESA_TYPE
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Service-role client — used for the actual DB write, same as mpesa-pushdeposit
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MPESA_ENV = Deno.env.get('MPESA_ENV') ?? 'production';
const BASE_URL  = MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

const CONSUMER_KEY    = Deno.env.get('MPESA_CONSUMER_KEY')!;
const CONSUMER_SECRET = Deno.env.get('MPESA_CONSUMER_SECRET')!;
const SHORTCODE       = Deno.env.get('MPESA_SHORTCODE')!;
const PASSKEY         = Deno.env.get('MPESA_PASSKEY')!;
const CALLBACK_URL    = Deno.env.get('MPESA_LISTING_CALLBACK_URL')!;
const MPESA_TYPE      = (Deno.env.get('MPESA_TYPE') ?? 'paybill').toLowerCase();

const TRANSACTION_TYPE = MPESA_TYPE === 'till'
  ? 'CustomerBuyGoodsOnline'
  : 'CustomerPayBillOnline';

// Fixed server-side — never trust an amount from the client here.
// Unlike a deposit, this fee doesn't vary, so there's nothing to accept as input.
const LISTING_UNLOCK_FEE_KES = 10;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey'
};

async function getAccessToken(): Promise<string> {
  const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` }
  });
  if (!res.ok) throw new Error(`Safaricom auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

function getPassword(): { password: string; timestamp: string } {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const password  = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);
  return { password, timestamp };
}

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ── Identify the buyer from their session, not from the request body ──
  // The deposit function doesn't need this (it's writing operator-entered
  // rent data), but here the buyer_id determines what they get unlocked,
  // so it can't be something the client just hands us.
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();

  if (authErr || !user) {
    return new Response(
      JSON.stringify({ error: 'Not authenticated' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }
  const buyerId = user.id;

  let body: any;
  try { body = await req.json(); }
  catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }

  const { listingId, phone } = body;

  if (!listingId || !phone) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: listingId, phone' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }

  try {
    // ── Skip payment entirely if this buyer already unlocked this listing ──
    const { data: existing } = await supabase
      .schema('marketplace')
      .from('listing_unlocks')
      .select('id')
      .eq('listing_id', listingId)
      .eq('buyer_id', buyerId)
      .eq('status', 'completed')
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, alreadyUnlocked: true }),
        { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    const accessToken = await getAccessToken();
    const { password, timestamp } = getPassword();

    const stkPayload = {
      BusinessShortCode: SHORTCODE,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   TRANSACTION_TYPE,
      Amount:             LISTING_UNLOCK_FEE_KES,
      PartyA:             phone,
      PartyB:             SHORTCODE,
      PhoneNumber:        phone,
      CallBackURL:        CALLBACK_URL,
      // AccountReference is capped at 12 chars by Daraja — a listing UUID
      // won't fit, so it's just a label. checkout_request_id is the real
      // join key back to the listing on our side (see insert below).
      AccountReference:  'LISTINGVIEW',
      TransactionDesc:   'Listing detail unlock fee'
    };

    const stkRes = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkPayload)
    });

    const stkData = await stkRes.json();

    if (stkData.ResponseCode !== '0') {
      throw new Error(stkData.errorMessage || stkData.ResponseDescription || 'STK Push failed');
    }

    const checkoutRequestID: string = stkData.CheckoutRequestID;
    const merchantRequestID: string = stkData.MerchantRequestID;

    const { error: insertErr } = await supabase
      .schema('marketplace')
      .from('listing_unlocks')
      .insert({
        listing_id:           listingId,
        buyer_id:             buyerId,
        amount:               LISTING_UNLOCK_FEE_KES,
        payment_provider:     'mpesa_daraja',
        phone_number:         phone,
        merchant_request_id:  merchantRequestID,
        checkout_request_id:  checkoutRequestID,
        status:               'pending'
      });

    if (insertErr) {
      console.error('Failed to save listing_unlock:', insertErr);
    }

    return new Response(
      JSON.stringify({
        success:          true,
        checkoutRequestID,
        customerMessage:  stkData.CustomerMessage ?? 'STK prompt sent to phone'
      }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );

  } catch (err: any) {
    console.error('Listing unlock STK error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }
});