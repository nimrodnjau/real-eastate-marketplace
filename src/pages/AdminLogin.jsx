import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseclient';

const COLORS = {
  maroon: '#3B0A14',
  cream: '#F7F4EE',
  white: '#FFFFFF',
  ink: '#20141a',
  muted: '#8a7d80',
  border: '#e7e1e0',
  red: '#B84A3E',
};

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Incorrect email or password.');
      setLoading(false);
      return;
    }

    const { data: adminRow, error: adminError } = await supabase
      .schema('marketplace')
      .from('admin_users')
      .select('is_active')
      .eq('id', signInData.user.id)
      .maybeSingle();

    if (adminError || !adminRow?.is_active) {
      await supabase.auth.signOut();
      setError("This account doesn't have access to the office dashboard.");
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate('/admin');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.cream,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: COLORS.white,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: '32px 30px',
          width: 340,
        }}
      >
        <div
          style={{
            fontFamily: "'Spectral', serif",
            color: COLORS.maroon,
            fontSize: 20,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Office sign in
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 22 }}>
          Staff access to the marketplace dashboard.
        </div>

        <label style={{ display: 'block', fontSize: 13, color: COLORS.ink, marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
            marginBottom: 16,
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />

        <label style={{ display: 'block', fontSize: 13, color: COLORS.ink, marginBottom: 6 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
            marginBottom: 20,
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />

        {error && (
          <div style={{ fontSize: 13, color: COLORS.red, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            background: COLORS.maroon,
            color: COLORS.white,
            fontSize: 14,
            fontWeight: 500,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}