import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import StatCard from '../../components/dashboard/StatCard';
import { supabase } from '../../lib/supabaseClient';
import { useLandlordUnitsSection } from '../../components/dashboard/useLandlordUnitsSection';
import { useLandlordNearbySections } from '../../components/dashboard/useLandlordNearbySections';
import { useLandlordMessagesSection } from '../../components/dashboard/useLandlordMessagesSection';
import '../../styles/dashboard.css';

// Landlord dashboard — "Your units" lives in
// components/dashboard/useLandlordUnitsSection.jsx, "Property managers near
// you" and "Agents near you" live in
// components/dashboard/useLandlordNearbySections.jsx, "Messages" reuses the
// shared MessagesSection component via
// components/dashboard/useLandlordMessagesSection.jsx. This file only owns:
// auth/user lookup and composing the page.

export default function LandlordDashboard() {
  const [userId, setUserId] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (cancelled) return;

      if (userError || !userData?.user) {
        setAuthError(userError ?? new Error('No logged-in user'));
        return;
      }
      setUserId(userData.user.id);
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    section: unitsSection,
    stats: unitStats,
    error: unitsError,
    modalElement,
    pickerElement,
  } = useLandlordUnitsSection(userId);

  const {
    managersSection,
    agentsSection,
    error: nearbyError,
    modalElement: nearbyModalElement,
  } = useLandlordNearbySections();

  const {
    section: messagesSection,
    error: messagesError,
  } = useLandlordMessagesSection();

  const sections = [unitsSection, managersSection, agentsSection, messagesSection];
  const displayError = authError || unitsError || nearbyError || messagesError;

  return (
    <>
      <DashboardLayout
        roleLabel="Landlord"
        pageTitle="Landlord dashboard"
        pageSubtitle="Your leased units and the managers helping you run them."
        sections={sections}
        verificationStatus={null}
      >
        <div className="stat-grid">
          {unitStats.map((s) => (
            <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} hint={s.hint} />
          ))}
        </div>
        {displayError && (
          <p className="dashboard-error" role="alert">
            Couldn't load your dashboard data — try refreshing.
          </p>
        )}
      </DashboardLayout>

      {modalElement}
      {pickerElement}
      {nearbyModalElement}
    </>
  );
}