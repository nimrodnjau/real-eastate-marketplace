// src/lib/pushNotifications.js
import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePushNotifications(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push not supported on this browser');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  await navigator.serviceWorker.register('/sw.js');
  // register() resolves once the SW is *installed*, not once it's
  // active — pushManager.subscribe() needs an active worker, so wait
  // for `ready`, which resolves once there's an active worker
  // controlling the page. Paired with skipWaiting()/clients.claim()
  // in sw.js, this resolves quickly instead of hanging on a worker
  // stuck in "waiting".
  const registration = await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const sub = subscription.toJSON();

  // IMPORTANT: push_subscriptions lives in the `marketplace` schema —
  // without .schema('marketplace') this silently writes to
  // public.push_subscriptions instead, which the send-push edge
  // function never reads from.
  const { error } = await supabase
    .schema('marketplace')
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
      { onConflict: 'endpoint' }
    );

  if (error) {
    console.error('Failed to save push subscription:', error);
    throw error;
  }

  return true;
}