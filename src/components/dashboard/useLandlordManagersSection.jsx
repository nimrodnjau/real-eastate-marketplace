import { useEffect, useState } from 'react';
import ListRows from './ListRows';
import { fetchVerifiedPropertyManagers } from '../../api/landlordDashboard';

// "Property managers near you" section — pulled out of LandlordDashboard.jsx
// the same way "Your units" was, so that file only owns auth/user lookup
// and composing the page. Place this alongside useLandlordUnitsSection.jsx
// in components/dashboard/.
export function useLandlordManagersSection() {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: managersError } = await fetchVerifiedPropertyManagers();
      if (cancelled) return;

      if (managersError) {
        setError(managersError);
        setLoading(false);
        return;
      }

      setManagers(data ?? []);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const managerItems = managers.map((m) => ({
    id: m.user_id,
    title: m.company_name || 'Property manager',
    meta: 'Verified property manager',
    badge: 'Verified',
    badgeTone: 'success',
  }));

  const emptyLabel = loading ? 'Loading…' : 'No verified property managers yet.';

  const section = {
    id: 'managers',
    title: 'Property managers near you',
    description: 'Hand off day-to-day management.',
    icon: 'users',
    type: 'list',
    items: managerItems,
    emptyLabel,
    content: <ListRows items={managerItems} emptyLabel={emptyLabel} />,
  };

  return { section, error, loading };
}