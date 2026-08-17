import { getPesapalToken, registerIpnUrl } from './supabase/functions/_shared/pesapal.ts';

const token = await getPesapalToken();
const result = await registerIpnUrl(
  token,
  'https://lymgdrrualawffpogjdz.supabase.co/functions/v1/pesapal-ipn',
);
console.log(result); // copy result.ipn_id