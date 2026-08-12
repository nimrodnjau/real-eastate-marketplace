// ═══════════════════════════════════════════════════════════════
// UIP — mpesa-callbacklistingunlock Edge Function
// Deploy to: supabase/functions/mpesa-callbacklistingunlock/index.ts
//
// Set this as the CallbackURL in mpesa-pushlistingunlock (MPESA_LISTING_CALLBACK_URL):
//   https://lymgdrrualawffpogjdz.supabase.co/functions/v1/mpesa-callbacklistingunlock
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Requires: marketplace.listing_unlocks.result_code (integer, nullable)
//   alter table marketplace.listing_unlocks add column result_code integer;
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const OK = { ResultCode: 0, ResultDesc: 'Accepted' };
const respond = (data = OK) =>
  new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const callback = body?.Body?.stkCallback;
  if (!callback) return new Response('Bad payload', { status: 400 });

  const checkoutRequestID: string = callback.CheckoutRequestID;
  const resultCode: number = callback.ResultCode;

  // ── 1. Find the pending unlock row ──
  const { data: pending, error: findErr } = await supabase
    .schema('marketplace')
    .from('listing_unlocks')
    .select('*')
    .eq('checkout_request_id', checkoutRequestID)
    .maybeSingle();

  if (findErr || !pending) {
    console.error('Pending listing unlock not found:', checkoutRequestID, findErr);
    return respond();
  }

  // ── 2. Duplicate callback guard ──
  if (pending.status === 'completed') {
    console.log('Duplicate callback ignored:', checkoutRequestID);
    return respond();
  }

  // ── 3. Payment failed or cancelled ──
  if (resultCode !== 0) {
    await supabase
      .schema('marketplace')
      .from('listing_unlocks')
      .update({
        status: 'failed',
        failure_reason: callback.ResultDesc ?? 'Unknown failure',
        result_code: resultCode
      })
      .eq('checkout_request_id', checkoutRequestID);

    console.log(`Listing unlock failed (ResultCode ${resultCode}):`, checkoutRequestID);
    return respond();
  }

  // ── 4. Extract metadata from successful callback ──
  const items: any[] = callback.CallbackMetadata?.Item ?? [];
  const get = (name: string) => items.find((i: any) => i.Name === name)?.Value;

  const mpesaCode: string = String(get('MpesaReceiptNumber') ?? '');

  // ── 5. Mark unlock as completed ──
  const { error: updateErr } = await supabase
    .schema('marketplace')
    .from('listing_unlocks')
    .update({
      status: 'completed',
      mpesa_receipt_number: mpesaCode,
      paid_at: new Date().toISOString()
    })
    .eq('checkout_request_id', checkoutRequestID);

  if (updateErr) {
    console.error('Failed to update listing_unlock:', updateErr);
    return respond();
  }

  console.log(`Listing unlock confirmed: ${mpesaCode} | listing ${pending.listing_id} | buyer ${pending.buyer_id}`);

  return respond();
});