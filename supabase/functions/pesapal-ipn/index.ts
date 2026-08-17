// supabase/functions/pesapal-ipn/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getPesapalToken, getPesapalTransactionStatus } from '../_shared/pesapal.ts';

function mapStatus(desc) {
  if (desc === 'Completed') return 'completed';
  return 'failed'; // Failed / Invalid / Pending-on-timeout all land here; Pending should just not update yet
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const orderTrackingId = url.searchParams.get('OrderTrackingId');
  const merchantReference = url.searchParams.get('OrderMerchantReference');
  const notificationType = url.searchParams.get('OrderNotificationType');

  if (!orderTrackingId || !merchantReference) {
    return new Response('Missing params', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  );

  try {
    const token = await getPesapalToken();
    const status = await getPesapalTransactionStatus(token, orderTrackingId);

    if (status.payment_status_description === 'Pending') {
      // Don't write anything yet — Pesapal will call again on the next change.
      return ackResponse(notificationType, orderTrackingId, merchantReference);
    }

    await supabase
      .schema('marketplace')
      .from('listing_unlocks')
      .update({
        status: mapStatus(status.payment_status_description),
        failure_reason: status.payment_status_description !== 'Completed' ? status.description : null,
        paid_at: status.payment_status_description === 'Completed' ? new Date().toISOString() : null,
      })
      .eq('merchant_reference', merchantReference);

    return ackResponse(notificationType, orderTrackingId, merchantReference);
  } catch (err) {
    console.error('pesapal-ipn error', err);
    // status: 500 tells Pesapal we received it but failed to process — they'll retry.
    return new Response(
      JSON.stringify({
        orderNotificationType: notificationType,
        orderTrackingId,
        orderMerchantReference: merchantReference,
        status: 500,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }
});

function ackResponse(notificationType, orderTrackingId, merchantReference) {
  return new Response(
    JSON.stringify({
      orderNotificationType: notificationType,
      orderTrackingId,
      orderMerchantReference: merchantReference,
      status: 200,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}