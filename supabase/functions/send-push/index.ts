// supabase/functions/send-push/index.ts
import webpush from 'npm:web-push';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

webpush.setVapidDetails(
  'mailto:otienorayan38@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

Deno.serve(async (req) => {
  // Browsers send this automatically before the real POST, because
  // functions.invoke() sends an Authorization + apikey header. Without
  // answering it, the browser blocks the real request client-side —
  // which is exactly the error you're seeing.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, url } = await req.json();

    if (!user_id) {
      console.error('send-push: missing user_id in request body');
      return new Response(JSON.stringify({ error: 'missing user_id' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // IMPORTANT: push_subscriptions lives in the `marketplace` schema,
    // same as messages/conversations. Without .schema(), this silently
    // queries public.push_subscriptions and returns [] — no error,
    // no notification, and the function still returns 200.
    const { data: subs, error: subsError } = await supabase
      .schema('marketplace')
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id);

    console.log('send-push: user_id =', user_id, '| subs found =', subs?.length ?? 0, '| subsError =', subsError);

    if (subsError) {
      console.error('send-push: failed to fetch subscriptions:', subsError);
      return new Response(JSON.stringify({ error: subsError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!subs || subs.length === 0) {
      console.warn('send-push: no push subscriptions found for user', user_id);
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no_subscriptions' }), {
        headers: corsHeaders,
      });
    }

    const results = await Promise.all(
      subs.map((sub) =>
        webpush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title, body, url })
          )
          .then(() => {
            console.log('send-push: sent OK to subscription', sub.id);
            return { id: sub.id, ok: true };
          })
          .catch(async (err) => {
            console.error('send-push: failed for subscription', sub.id, '| statusCode =', err.statusCode, '| body =', err.body);
            if (err.statusCode === 410 || err.statusCode === 404) {
              // Subscription is gone/expired on the push service's end — clean it up.
              await supabase
                .schema('marketplace')
                .from('push_subscriptions')
                .delete()
                .eq('id', sub.id);
              console.log('send-push: deleted stale subscription', sub.id);
            }
            return { id: sub.id, ok: false, statusCode: err.statusCode };
          })
      )
    );

    const sent = results.filter((r) => r.ok).length;

    return new Response(JSON.stringify({ ok: true, sent, total: subs.length, results }), {
      headers: corsHeaders,
    });
  } catch (err) {
    console.error('send-push error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});