// supabase/functions/pesapal-pushlistingunlock/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getPesapalToken, submitPesapalOrder } from '../_shared/pesapal.ts';

const UNLOCK_VALID_MINUTES = 20;

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  );

  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', ''));
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const { listingId } = await req.json();
  if (!listingId) return json({ error: 'listingId required' }, 400);

  // Same dedupe window as the M-Pesa flow.
  const cutoff = new Date(Date.now() - UNLOCK_VALID_MINUTES * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .schema('marketplace')
    .from('listing_unlocks')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .eq('status', 'completed')
    .gte('paid_at', cutoff)
    .maybeSingle();

  if (existing) return json({ alreadyUnlocked: true });

  const merchantReference = crypto.randomUUID();

  const { error: insertError } = await supabase
    .schema('marketplace')
    .from('listing_unlocks')
    .insert({
      listing_id: listingId,
      buyer_id: user.id,
      status: 'pending',
      payment_method: 'card',
      merchant_reference: merchantReference,
    });
  if (insertError) return json({ error: 'Could not start payment' }, 500);

  try {
    const token = await getPesapalToken();
    const order = await submitPesapalOrder(token, {
      id: merchantReference,
      currency: 'KES',
      amount: 10,
      description: 'Listing unlock',
      callback_url: `${Deno.env.get('APP_BASE_URL')}/payment/pesapal/callback`,
      notification_id: Deno.env.get('PESAPAL_IPN_ID'),
      billing_address: {
        email_address: user.email || '',
        phone_number: '',
        country_code: 'KE',
        first_name: user.user_metadata?.first_name || 'Buyer',
        last_name: user.user_metadata?.last_name || '',
      },
    });

    await supabase
      .schema('marketplace')
      .from('listing_unlocks')
      .update({ order_tracking_id: order.order_tracking_id })
      .eq('merchant_reference', merchantReference);

    return json({ redirectUrl: order.redirect_url });
  } catch (err) {
    await supabase
      .schema('marketplace')
      .from('listing_unlocks')
      .update({ status: 'failed', failure_reason: String(err.message) })
      .eq('merchant_reference', merchantReference);
    return json({ error: 'Could not start the card payment. Please try again.' }, 500);
  }
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}