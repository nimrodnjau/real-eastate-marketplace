import { useEffect, useState } from 'react';
import { db } from '../lib/supabaseClient';

// ASSUMPTIONS TO VERIFY: marketplace.profiles has `full_name` and
// `avatar_url` columns. If your profiles table uses different column
// names, adjust the `.select()` string and the JSX below.

export default function ProviderDirectory({ providerType, selectedProviderId, onSelect }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await db
        .schema('marketplace')
        .from('service_provider_profiles')
        .select(
          'user_id, provider_type, bio, rating_avg, verification_status, profiles:profiles!service_provider_profiles_user_id_fkey (full_name, avatar_url)'
        )
        .eq('provider_type', providerType)
        .eq('verification_status', 'verified')
        .order('rating_avg', { ascending: false });

      if (cancelled) return;

      if (error) {
        setError(error.message);
      } else {
        setProviders(data || []);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [providerType]);

  if (loading) return <p className="provider-directory-state">Loading {providerType}s…</p>;
  if (error) return <p className="provider-directory-state provider-directory-error">Couldn't load providers: {error}</p>;
  if (providers.length === 0) {
    return <p className="provider-directory-state">No verified {providerType}s available right now.</p>;
  }

  return (
    <ul className="provider-directory-list">
      {providers.map((p) => {
        const isSelected = selectedProviderId === p.user_id;
        return (
          <li key={p.user_id} className={`provider-directory-card${isSelected ? ' is-selected' : ''}`}>
            <button type="button" className="provider-directory-card-button" onClick={() => onSelect(p)}>
              {p.profiles?.avatar_url && (
                <img className="provider-directory-avatar" src={p.profiles.avatar_url} alt="" />
              )}
              <div className="provider-directory-card-text">
                <span className="provider-directory-name">{p.profiles?.full_name || 'Unnamed provider'}</span>
                {p.bio && <span className="provider-directory-bio">{p.bio}</span>}
                <span className="provider-directory-rating">
                  {p.rating_avg ? `★ ${Number(p.rating_avg).toFixed(1)}` : 'No ratings yet'}
                </span>
              </div>
              {isSelected && <span className="provider-directory-check">✓</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}