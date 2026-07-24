// src/components/PushNotificationBanner.jsx
import { useEffect, useState } from 'react';
import { enablePushNotifications } from '../../lib/pushNotifications';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/push-notification-banner.css';

function dismissKeyFor(userId) {
  return `push-banner-dismissed:${userId}`;
}

export default function PushNotificationBanner({ userId }) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | requesting | enabled | denied | error

  useEffect(() => {
    if (!userId) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    const alreadyDenied = Notification.permission === 'denied';
    const dismissed = localStorage.getItem(dismissKeyFor(userId)) === 'true';

    // Hard-denied at the browser level is still a valid reason to hide —
    // re-showing would be pointless, they'd need to reset it from site
    // settings regardless of which account is logged in.
    if (alreadyDenied || dismissed) return;

    // The real source of truth for "has THIS user enabled push" is
    // whether they have a saved subscription row — NOT
    // Notification.permission, which is global to the browser/device.
    // Without this check, once any user grants permission on a shared
    // browser, every other user who logs in there would never see the
    // banner either, even though they've never subscribed themselves.
    let cancelled = false;
    supabase
      .schema('marketplace')
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Failed to check push subscription:', error);
          return;
        }
        const hasSubscription = (data || []).length > 0;
        setVisible(!hasSubscription);
      });

    return () => { cancelled = true; };
  }, [userId]);

  async function handleEnable() {
    setStatus('requesting');
    try {
      const result = await enablePushNotifications(userId);
      if (result) {
        setStatus('enabled');
        setTimeout(() => setVisible(false), 1500);
      } else {
        setStatus('denied');
        setVisible(false);
      }
    } catch (err) {
      console.error('Failed to enable push notifications:', err);
      setStatus('error');
    }
  }

  function handleDismiss() {
    localStorage.setItem(dismissKeyFor(userId), 'true');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="push-banner">
      <span className="push-banner-text">
        {status === 'enabled'
          ? '✅ Notifications enabled!'
          : 'Turn on notifications to know when you get a new message.'}
      </span>
      {status !== 'enabled' && (
        <div className="push-banner-actions">
          <button
            onClick={handleEnable}
            disabled={status === 'requesting'}
            className="push-banner-enable-btn"
          >
            {status === 'requesting' ? 'Enabling...' : 'Enable'}
          </button>
          <button
            onClick={handleDismiss}
            className="push-banner-dismiss-btn"
          >
            Not now
          </button>
        </div>
      )}
      {status === 'error' && (
        <span className="push-banner-error">Something went wrong — check console.</span>
      )}
    </div>
  );
}