import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, db } from '../lib/supabaseClient';
import { normalizePhone } from '../lib/validation';

const AuthContext = createContext(undefined);

// Maps a role to the table its extra profile row lives in, and which of
// the signup's roleFields become which columns. Roles not listed here
// (buyer, tenant) need no extra row.
const ROLE_TABLE_MAP = {
  agent: { table: 'agent_profiles', map: (f) => ({ agency_name: f.agency_name || null }) },
  lawyer: { table: 'service_provider_profiles', map: (f) => ({ provider_type: 'lawyer', license_number: f.license_number }) },
  valuer: { table: 'service_provider_profiles', map: (f) => ({ provider_type: 'valuer', license_number: f.license_number }) },
  surveyor: { table: 'service_provider_profiles', map: (f) => ({ provider_type: 'surveyor', license_number: f.license_number }) },
  bank: { table: 'bank_profiles', map: (f) => ({ institution_name: f.institution_name }) },
  seller: { table: 'seller_profiles', map: () => ({}) },
  landlord: { table: 'landlord_profiles', map: () => ({}) },
  property_manager: { table: 'property_manager_profiles', map: (f) => ({ company_name: f.company_name || null }) },
};

async function createRoleProfileRow(userId, role, roleFields = {}) {
  const entry = ROLE_TABLE_MAP[role];
  if (!entry) return { error: null };

  const { error } = await db.from(entry.table).insert({
    user_id: userId,
    ...entry.map(roleFields),
  });
  return { error };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile:', error.message);
      setProfile(null);
      return;
    }
    setProfile(data);
  };

  useEffect(() => {
    // StrictMode (dev only) mounts this effect twice in a row. Without this
    // guard, the first run's async callbacks (getSession / onAuthStateChange)
    // can still resolve AFTER the second run has already subscribed, racing
    // each other and occasionally leaving `session` stale on the very first
    // sign-in. `ignore` makes the first run's callbacks no-ops once cleanup
    // has fired.
    let ignore = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (ignore) return;
      setSession(session);
      loadProfile(session?.user?.id).finally(() => {
        if (!ignore) setLoading(false);
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (ignore) return;
      setSession(session);
      loadProfile(session?.user?.id);
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  // Full signup: email/password + name/phone/country + role + role-specific
  // fields + terms acceptance.
  const signUpWithEmail = async ({
    email,
    password,
    fullName,
    phone,
    country,
    role,
    roleFields = {},
    termsAccepted,
  }) => {
    if (!termsAccepted) {
      return { error: new Error('You must accept the Terms of Service to continue.') };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone: normalizePhone(phone), country, role },
      },
    });
    if (error) return { error };

    // If email confirmation is required, there's no session yet, so RLS
    // blocks the profile insert (auth.uid() is null). In that case the
    // profile row gets created later on /select-role, after confirmation +
    // login. If confirmation is disabled, a session comes back immediately
    // and we insert right away.
    if (data.session && data.user) {
      // signUp() returning data.session doesn't guarantee the client has
      // finished attaching it internally yet — the next request can still
      // go out unauthenticated (auth.uid() = null), which RLS then rejects
      // with 42501. Explicitly (re)apply the fresh tokens and await it, so
      // the insert below is guaranteed to carry a valid JWT.
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessionError) return { error: sessionError };

      const { error: profileError } = await db.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        phone: normalizePhone(phone),
        country,
        email,
        role,
        terms_accepted_at: new Date().toISOString(),
      });
      if (profileError) return { error: profileError };

      const { error: roleError } = await createRoleProfileRow(data.user.id, role, roleFields);
      if (roleError) return { error: roleError };
    }

    return { data, error: null };
  };

  const signInWithEmail = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/welcome` },
    });
    return { data, error };
  };

  // Finishes the profile for a Google signup, or an email/password signup
  // where confirmation was required and the row was deferred.
  const completeProfile = async ({ fullName, phone, country, role, roleFields = {}, termsAccepted }) => {
    if (!termsAccepted) {
      return { error: new Error('You must accept the Terms of Service to continue.') };
    }

    // getSession() reads the already-persisted local session rather than
    // round-tripping to the server, so it reliably reflects what the next
    // request will actually be authenticated as.
    const { data: { session: currentSession }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !currentSession?.user) {
      return { error: new Error('No authenticated user found.') };
    }
    const user = currentSession.user;

    const { error } = await db.from('profiles').insert({
      id: user.id,
      full_name: fullName || user.user_metadata?.full_name || user.email,
      phone: normalizePhone(phone),
      country,
      email: user.email,
      role,
      terms_accepted_at: new Date().toISOString(),
    });
    if (error) return { error };

    const { error: roleError } = await createRoleProfileRow(user.id, role, roleFields);
    if (roleError) return { error: roleError };

    await loadProfile(user.id);
    return { error: null };
  };

  const resendConfirmationEmail = async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    completeProfile,
    resendConfirmationEmail,
    signOut,
    refreshProfile: () => loadProfile(session?.user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}