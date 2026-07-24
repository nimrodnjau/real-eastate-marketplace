import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseclient';

export function AdminRoute({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState('checking'); // checking | allowed | denied

  useEffect(() => {
    if (!user) { setStatus('denied'); return; }

    supabase
      .schema('marketplace')
      .from('admin_users')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setStatus(data?.is_active ? 'allowed' : 'denied');
      });
  }, [user]);

  if (status === 'checking') return null;
  if (status === 'denied') return <Navigate to="/admin/login" replace />;
  return children;
}