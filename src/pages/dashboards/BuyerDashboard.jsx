import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import StatCard from '../../components/dashboard/StatCard';
import ListRows from '../../components/dashboard/ListRows';
import ProcessTracker from '../../components/dashboard/ProcessTracker';
import MessagesSection from '../../components/dashboard/MessagesSection';
import WatchingSection from '../../components/dashboard/WatchingSection';
import { db } from '../../lib/supabaseClient'; // adjust path if different
import '../../styles/dashboard.css';
import ProfessionalsSectionForBuyer from '../../components/dashboard/ProfessionalsSectionForBuyer';
import MyViewingRequestsSection from '../../components/dashboard/MyViewingRequestsSection';
import OngoingPurchasesSection from '../../components/dashboard/OngoingPurchasesSection';




const STAT_CONFIG = [
  { key: 'saved_properties', label: 'Saved properties', icon: 'building' },
  { key: 'active_requests', label: 'Active requests', hint: 'Viewings & offers', icon: 'clipboardList' },
  { key: 'in_escrow', label: 'In escrow', icon: 'wallet', format: 'currency' },
  { key: 'unread_alerts', label: 'Unread alerts', icon: 'bell' },
];

function formatStatValue(key, value, format) {
  if (value === null || value === undefined) return '—';
  if (format === 'currency') {
    return `KES ${Number(value).toLocaleString()}`;
  }
  return String(value);
}

export default function BuyerDashboard() {
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      setStatsLoading(true);
      const { data, error } = await db
        .rpc('get_buyer_overview_stats')
        .single();

      if (!isMounted) return;

      if (error) {
        console.error('Failed to load buyer overview stats:', error);
        setStatsError(error);
      } else {
        setStats(data);
      }
      setStatsLoading(false);
    }

    loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const SECTIONS = [
    {
      id: 'watching',
      title: "Properties you're watching",
      description: 'New activity on your saved listings.',
      icon: 'building',
      type: 'component',
      action: {
        label: 'Browse more',
        onClick: () => navigate('/listings'),
      },
      content: <WatchingSection />,
    },
    {
      id: 'messages',
      title: 'Messages',
      description: 'Chat with sellers, agents, and other professionals.',
      icon: 'messageSquare',
      type: 'component',
      content: <MessagesSection />,
    },
   {
      id: 'professionals',
      title: 'Professionals near you',
      description: 'Agents, lawyers, valuers, and surveyors you can reach out to.',
      icon: 'users',
      type: 'component',
      content: <ProfessionalsSectionForBuyer />,
    },
    {
  id: 'viewing-requests',
  title: 'Viewing requests',
  description: 'Status of the viewings you\'ve requested.',
  icon: 'calendarCheck', // ⚠ guessing this key exists in whatever maps icon strings → lucide components — check against 'building'/'clipboardList'/'wallet'/'bell' etc. and swap if 'calendarCheck' isn't registered
  type: 'component',
  content: <MyViewingRequestsSection />,
},
{
    id: 'ongoing-purchases',
      title: 'Ongoing purchases',
      description: "Pick up where you left off — no need to find the listing again.",
      icon: 'clipboardList',

      type: 'component',
      content: <OngoingPurchasesSection />,
    },
    {
      id: 'alerts',
      title: 'Recent alerts',
      description: 'Updates on the things you\'re tracking.',
      icon: 'bell',
      type: 'list',
      items: [
        {
          title: 'New price on 3-bed apartment, Kilimani',
          meta: '2 hours ago',
          badge: 'Price',
          badgeTone: 'neutral',
        },
        {
          title: 'Seller responded to your offer',
          meta: 'Yesterday',
          badge: 'Offer',
          badgeTone: 'pending',
        },
      ],
    },
  ];

  const sections = SECTIONS.map((section) => {
    if (section.type === 'component') return section; // content already set directly (e.g. MessagesSection)
    return {
      ...section,
      content:
        section.type === 'process' ? (
          <ProcessTracker steps={section.steps} />
        ) : (
          <ListRows items={section.items} emptyLabel={section.emptyLabel} />
        ),
    };
  });

  return (
    <DashboardLayout
      roleLabel="Buyer"
      pageTitle="Buyer dashboard"
      pageSubtitle="Track the properties you're watching and the people helping you close."
      sections={sections}
      verificationStatus={null}
    >
      <div className="stat-grid">
        {STAT_CONFIG.map((s) => (
          <StatCard
            key={s.key}
            icon={s.icon}
            label={s.label}
            value={
              statsLoading
                ? '…'
                : statsError
                ? '—'
                : formatStatValue(s.key, stats?.[s.key], s.format)
            }
            hint={s.hint}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}