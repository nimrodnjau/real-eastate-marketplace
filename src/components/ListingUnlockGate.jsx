import { useEffect, useRef, useState } from 'react';
import { db, supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import '../styles/listingUnlockGate.css';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;
const MPESA_CANCELLED_CODE = 1032; // Safaricom: "Request cancelled by user"
const UNLOCK_VALID_MINUTES = 20;
const UNLOCK_VALID_MS = UNLOCK_VALID_MINUTES * 60 * 1000;

function classifyOutcome(data) {
  if (data.result_code === MPESA_CANCELLED_CODE) return 'cancelled';
  return 'failed';
}

export default function ListingUnlockGate({ listingId, onClose, onUnlocked }) {
  const { profile } = useAuth();
  const [phone, setPhone] = useState(profile?.phone || '');
  const [method, setMethod] = useState('mpesa'); // mpesa | card
  const [stage, setStage] = useState('checking'); // checking | form | sending | waiting | failed | cancelled
  const [errorMsg, setErrorMsg] = useState(null);
  const pollTimer = useRef(null);
  const pollDeadline = useRef(null);

  // Skip the paywall only if this buyer paid for this listing within the last
  // UNLOCK_VALID_MINUTES — matches the same window enforced server-side in
  // mpesa-pushlistingunlock.
  useEffect(() => {
    let isCurrent = true;

    async function checkExisting() {
      if (!profile?.id) {
        setStage('form');
        return;
      }

      const cutoff = new Date(Date.now() - UNLOCK_VALID_MS).toISOString();

      const { data, error } = await db
        .schema('marketplace')
        .from('listing_unlocks')
        .select('id')
        .eq('listing_id', listingId)
        .eq('buyer_id', profile.id)
        .eq('status', 'completed')
        .gte('paid_at', cutoff)
        .order('paid_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isCurrent) return;
      if (!error && data) onUnlocked();
      else setStage('form');
    }

    checkExisting();
    return () => { isCurrent = false; };
  }, [listingId, onUnlocked, profile?.id]);

  useEffect(() => () => {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
  }, []);

  const pollForCompletion = () => {
    pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;

    pollTimer.current = window.setInterval(async () => {
      const { data, error } = await db
        .schema('marketplace')
        .from('listing_unlocks')
        .select('status, failure_reason, result_code')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return;

      if (data?.status === 'completed') {
        window.clearInterval(pollTimer.current);
        onUnlocked();
        return;
      }
      if (data?.status === 'failed') {
        window.clearInterval(pollTimer.current);
        const outcome = classifyOutcome(data);
        setStage(outcome);
        if (outcome === 'failed') {
          setErrorMsg(data.failure_reason || 'Payment was not completed.');
        }
        return;
      }
      if (Date.now() > pollDeadline.current) {
        window.clearInterval(pollTimer.current);
        setStage('failed');
        setErrorMsg('No confirmation yet. If you completed the payment, try again in a moment.');
      }
    }, POLL_INTERVAL_MS);
  };

  const submitPhone = async (event) => {
    event.preventDefault();
    setErrorMsg(null);

    const cleanPhone = phone.trim();
    // Swap for your existing signup phone validator if you have one —
    // this is a minimal placeholder.
    if (!/^0?7\d{8}$/.test(cleanPhone)) {
      setErrorMsg('Enter a valid Safaricom number, e.g. 0712345678.');
      return;
    }
    const normalizedPhone = cleanPhone.startsWith('0') ? `254${cleanPhone.slice(1)}` : cleanPhone;

    setStage('sending');

    const { data, error } = await supabase.functions.invoke('mpesa-pushlistingunlock', {
      body: { listingId, phone: normalizedPhone },
    });

    if (error || data?.error) {
      setStage('form');
      setErrorMsg(data?.error || 'Could not start the M-Pesa payment. Please try again.');
      return;
    }
    if (data?.alreadyUnlocked) {
      onUnlocked();
      return;
    }

    setStage('waiting');
    pollForCompletion();
  };

  // Card flow: Pesapal returns a hosted checkout URL — we redirect the buyer
  // there directly rather than collecting card details ourselves, so this
  // stays out of PCI-DSS scope. Edge function not built yet — next step.
  const submitCard = async () => {
    setErrorMsg(null);
    setStage('sending');

    const { data, error } = await supabase.functions.invoke('pesapal-pushlistingunlock', {
      body: { listingId },
    });

    if (error || data?.error) {
      setStage('form');
      setErrorMsg(data?.error || 'Could not start the card payment. Please try again.');
      return;
    }
    if (data?.alreadyUnlocked) {
      onUnlocked();
      return;
    }
    if (data?.redirectUrl) {
      window.location.href = data.redirectUrl;
      return;
    }
  };

  return (
    <div className="listing-unlock-overlay" role="dialog" aria-modal="true">
      <div className="listing-unlock-modal">
        <button type="button" className="listing-unlock-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>Unlock full listing details</h2>
        <p className="listing-unlock-fee">KES 10 {method === 'mpesa' ? 'via M-Pesa' : 'via card'}</p>
        <p className="listing-unlock-reason">
          This covers full property details — description, exact address, and contact info.
          Your unlock stays free to reopen for {UNLOCK_VALID_MINUTES} minutes after payment.
        </p>

        {stage === 'checking' && <p>Checking...</p>}

        {(stage === 'form' || stage === 'sending') && (
          <>
            <div className="listing-unlock-method-tabs" role="tablist" aria-label="Payment method">
              <button
                type="button"
                role="tab"
                aria-selected={method === 'mpesa'}
                className={`listing-unlock-method-tab${method === 'mpesa' ? ' listing-unlock-method-tab--active' : ''}`}
                onClick={() => setMethod('mpesa')}
                disabled={stage === 'sending'}
              >
                M-Pesa
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={method === 'card'}
                className={`listing-unlock-method-tab${method === 'card' ? ' listing-unlock-method-tab--active' : ''}`}
                onClick={() => setMethod('card')}
                disabled={stage === 'sending'}
              >
                Card
              </button>
            </div>

            {method === 'mpesa' ? (
              <form onSubmit={submitPhone}>
                <label htmlFor="unlock-phone">M-Pesa phone number</label>
                <input
                  id="unlock-phone"
                  type="tel"
                  placeholder="0712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={stage === 'sending'}
                  required
                />
                {errorMsg && <p className="listing-unlock-error">{errorMsg}</p>}
                <button type="submit" disabled={stage === 'sending'}>
                  {stage === 'sending' ? 'Sending prompt...' : 'Pay KES 10'}
                </button>
              </form>
            ) : (
              <div className="listing-unlock-card-panel">
                <p className="listing-unlock-hint">
                  You'll be redirected to a secure Pesapal page to enter your card details.
                </p>
                {errorMsg && <p className="listing-unlock-error">{errorMsg}</p>}
                <button type="button" className="listing-unlock-card-submit" onClick={submitCard} disabled={stage === 'sending'}>
                  {stage === 'sending' ? 'Redirecting...' : 'Pay KES 10 with card'}
                </button>
              </div>
            )}
          </>
        )}

        {stage === 'waiting' && (
          <div className="listing-unlock-waiting">
            <p>Check your phone and enter your M-Pesa PIN.</p>
            <p className="listing-unlock-hint">This closes automatically once payment is confirmed.</p>
          </div>
        )}

        {stage === 'cancelled' && (
          <div>
            <p className="listing-unlock-error">You cancelled the M-Pesa prompt.</p>
            <button type="button" className="listing-unlock-retry-btn" onClick={() => setStage('form')}>Try again</button>
          </div>
        )}

        {stage === 'failed' && (
          <div>
            <p className="listing-unlock-error">{errorMsg}</p>
            <button type="button" className="listing-unlock-retry-btn" onClick={() => setStage('form')}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}