// supabase/functions/_shared/pesapal.ts
const BASE_URL = Deno.env.get('PESAPAL_ENV') === 'live'
  ? 'https://pay.pesapal.com/v3'
  : 'https://cybqa.pesapal.com/pesapalv3';

export async function getPesapalToken() {
  const res = await fetch(`${BASE_URL}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      consumer_key: Deno.env.get('PESAPAL_CONSUMER_KEY'),
      consumer_secret: Deno.env.get('PESAPAL_CONSUMER_SECRET'),
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || 'Pesapal auth failed');
  return data.token; // valid ~5 minutes — just fetch fresh each invocation, edge functions are short-lived
}

export async function registerIpnUrl(token, url) {
  const res = await fetch(`${BASE_URL}/api/URLSetup/RegisterIPN`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url, ipn_notification_type: 'GET' }),
  });
  return res.json(); // { ipn_id, ... }
}

export async function submitPesapalOrder(token, order) {
  const res = await fetch(`${BASE_URL}/api/Transactions/SubmitOrderRequest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(order),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || 'SubmitOrderRequest failed');
  return data; // { order_tracking_id, merchant_reference, redirect_url, status }
}

export async function getPesapalTransactionStatus(token, orderTrackingId) {
  const res = await fetch(
    `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
  );
  return res.json(); // { payment_status_description: 'Completed'|'Failed'|'Invalid'|'Pending', ... }
}