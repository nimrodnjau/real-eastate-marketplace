import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { supabase, db } from '../lib/supabaseClient';

// Save/unsave a listing. Drop this into PublicListingCard (or any
// place a listing's id is in scope): <FavoriteButton listingId={listing.id} />
//
// `db` is already scoped to the marketplace schema (see supabaseClient.js),
// so table queries go through db.from(...) directly — no .schema() call
// needed. Auth is project-wide, so it goes through the full `supabase`
// client instead, which is where auth.getUser() actually lives.

export default function FavoriteButton({ listingId }) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialState() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (isMounted) setLoading(false);
        return;
      }

      const { data, error } = await db
        .from('favorites')
        .select('id')
        .eq('listing_id', listingId)
        .eq('buyer_id', user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error('Failed to check favorite status:', error);
      } else {
        setIsFavorited(!!data);
      }
      setLoading(false);
    }

    loadInitialState();

    return () => {
      isMounted = false;
    };
  }, [listingId]);

  async function toggleFavorite(e) {
    e.stopPropagation(); // don't trigger the card's onClick (navigate to listing)
    if (pending) return;
    setPending(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Must be signed in to save a property.');
      setPending(false);
      return;
    }

    if (isFavorited) {
      const { error } = await db
        .from('favorites')
        .delete()
        .eq('listing_id', listingId)
        .eq('buyer_id', user.id);

      if (error) {
        console.error('Failed to remove favorite:', error);
      } else {
        setIsFavorited(false);
      }
    } else {
      const { error } = await db
        .from('favorites')
        .insert({ listing_id: listingId, buyer_id: user.id });

      if (error) {
        console.error('Failed to save favorite:', error);
      } else {
        setIsFavorited(true);
      }
    }

    setPending(false);
  }

  if (loading) {
    return null; // or a skeleton, depending on your card layout
  }

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      disabled={pending}
      aria-pressed={isFavorited}
      aria-label={isFavorited ? 'Remove from saved properties' : 'Save property'}
      className={`favorite-button${isFavorited ? ' favorite-button--active' : ''}`}
    >
      <Heart size={18} fill={isFavorited ? 'currentColor' : 'none'} />
    </button>
  );
}