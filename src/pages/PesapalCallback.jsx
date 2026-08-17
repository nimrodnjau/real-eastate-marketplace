// pages/PesapalCallback.jsx
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/supabaseClient';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

export default function PesapalCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('waiting'); // waiting | completed | failed
  const deadline = useRef(Date.now() + POLL_TIMEOUT_MS);

  const merchantReference = searchParams.get('OrderMerchantReference');

  useEffect(() => {
    if (!merchantReference) {
      setStatus('failed');
      return;
    }

    const interval = window.setInterval(async () => {
      const { data, error } = await db
        .schema('marketplace')
        .from('listing_unlocks')
        .select('status, listing_id, failure_reason')
        .eq('merchant_reference', merchantReference)
        .maybeSingle();

      if (error) return;

      if (data?.status === 'completed') {
        window.clearInterval(interval);
        setStatus('completed');
        setTimeout(() => navigate(`/listings/${data.listing_id}`), 1200);
        return;
      }
      if (data?.status === 'failed') {
        window.clearInterval(interval);
        setStatus('failed');
        return;
      }
      if (Date.now() > deadline.current) {
        window.clearInterval(interval);
        setStatus('failed');
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [merchantReference, navigate]);

  return (
    <div className="pesapal-callback-page">
      {status === 'waiting' && <p>Confirming your payment...</p>}
      {status === 'completed' && <p>Payment confirmed. Redirecting...</p>}
      {status === 'failed' && (
        <div>
          <p>We couldn't confirm your payment.</p>
          <button onClick={() => navigate(-1)}>Go back</button>
        </div>
      )}
    </div>
  );
}