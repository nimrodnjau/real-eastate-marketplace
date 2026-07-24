import DashboardLayout from '../../components/dashboard/DashboardLayout';
import StatCard from '../../components/dashboard/StatCard';
import ListRows from '../../components/dashboard/ListRows';
import ProcessTracker from '../../components/dashboard/ProcessTracker';
import '../../styles/dashboard.css';

// Surveyor dashboard — split out from the old shared
// RoleDashboard + dashboardContent.js config so this role's content lives
// in one independent, top-to-bottom readable file. Swap the placeholder
// arrays below for real Supabase queries later; DashboardLayout, StatCard,
// ListRows, and ProcessTracker don't need to change to do that.

const STATS = [
  {
    "label": "Pending requests",
    "value": "3",
    "icon": "clipboardList"
  },
  {
    "label": "Reports this month",
    "value": "5",
    "icon": "fileText"
  },
  {
    "label": "Pending earnings",
    "value": "KES 48,000",
    "icon": "wallet"
  },
  {
    "label": "Credential status",
    "value": "Verified",
    "icon": "shieldCheck"
  }
];

const SECTIONS = [
  {
    "id": "requests",
    "title": "Incoming requests",
    "description": "Survey requests from agents, sellers, and buyers.",
    "icon": "clipboardList",
    "type": "list",
    "items": [
      {
        "title": "Boundary survey — Half-acre plot, Ruiru",
        "meta": "From: seller",
        "badge": "New",
        "badgeTone": "neutral"
      }
    ]
  },
  {
    "id": "reports",
    "title": "Report queue",
    "description": "Surveys in progress and ready to send.",
    "icon": "fileText",
    "type": "list",
    "items": [
      {
        "title": "Survey report — Half-acre plot, Ruiru",
        "meta": "Field work in progress",
        "badge": "In progress",
        "badgeTone": "pending"
      }
    ]
  },
  {
    "id": "payments",
    "title": "Payment history",
    "description": "Paid out after verification.",
    "icon": "wallet",
    "type": "list",
    "items": [
      {
        "title": "Boundary survey fee",
        "meta": "20 Jun 2026",
        "badge": "KES 22,000",
        "badgeTone": "success"
      }
    ]
  }
];

export default function SurveyorDashboard() {
  const sections = SECTIONS.map((section) => ({
    ...section,
    content:
      section.type === 'process' ? (
        <ProcessTracker steps={section.steps} />
      ) : (
        <ListRows items={section.items} emptyLabel={section.emptyLabel} />
      ),
  }));

  return (
    <DashboardLayout
      roleLabel="Surveyor"
      pageTitle="Surveyor dashboard"
      pageSubtitle="Survey requests, boundary reports, and payments."
      sections={sections}
      verificationStatus={"Credentials verified"}
    >
      <div className="stat-grid">
        {STATS.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} hint={s.hint} />
        ))}
      </div>
    </DashboardLayout>
  );
}