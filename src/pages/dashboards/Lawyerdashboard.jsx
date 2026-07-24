import DashboardLayout from '../../components/dashboard/DashboardLayout';
import StatCard from '../../components/dashboard/StatCard';
import ListRows from '../../components/dashboard/ListRows';
import ProcessTracker from '../../components/dashboard/ProcessTracker';
import '../../styles/dashboard.css';

// Lawyer dashboard — split out from the old shared
// RoleDashboard + dashboardContent.js config so this role's content lives
// in one independent, top-to-bottom readable file. Swap the placeholder
// arrays below for real Supabase queries later; DashboardLayout, StatCard,
// ListRows, and ProcessTracker don't need to change to do that.

const STATS = [
  {
    "label": "Pending requests",
    "value": "5",
    "icon": "clipboardList"
  },
  {
    "label": "Documents this month",
    "value": "11",
    "icon": "fileText"
  },
  {
    "label": "Pending earnings",
    "value": "KES 95,000",
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
    "description": "Work requested by agents, buyers, and sellers.",
    "icon": "clipboardList",
    "type": "list",
    "items": [
      {
        "title": "Sale agreement — 3-bed apartment, Kilimani",
        "meta": "From: Amina Yusuf (Agent)",
        "badge": "New",
        "badgeTone": "neutral"
      },
      {
        "title": "Title search — Half-acre plot, Ruiru",
        "meta": "From: seller",
        "badge": "In progress",
        "badgeTone": "pending"
      }
    ]
  },
  {
    "id": "documents",
    "title": "Document queue",
    "description": "Drafts in progress and awaiting delivery.",
    "icon": "fileText",
    "type": "list",
    "items": [
      {
        "title": "Lease agreement — Office suite, Westlands",
        "meta": "Draft in review",
        "badge": "In progress",
        "badgeTone": "pending"
      },
      {
        "title": "Sale agreement — 4-bedroom maisonette, Karen",
        "meta": "Ready to send",
        "badge": "Ready",
        "badgeTone": "success"
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
        "title": "Sale agreement fee",
        "meta": "3 Jul 2026",
        "badge": "KES 25,000",
        "badgeTone": "success"
      },
      {
        "title": "Title search fee",
        "meta": "28 Jun 2026",
        "badge": "KES 12,000",
        "badgeTone": "success"
      }
    ]
  }
];

export default function LawyerDashboard() {
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
      roleLabel="Lawyer"
      pageTitle="Lawyer dashboard"
      pageSubtitle="Requests, drafts, and payments from agents, buyers, and sellers."
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