import { useState } from 'react';
import './professionalDashboard.css';
import ProfileCredentialsSection from './ProfileCredentialsSection';
import IncomingRequestsSection from "./IncomingRequestSection";
import SchedulingSection from './SchedulingSection';
import TransactionsReviewsSection from './TransactionsReviewsSection';
import DocumentEditorSection from './DocumentEditorSection';
import FinancialSection from './FinancialSection';
import MessagesSection from '../components/dashboard/MessagesSection';
import PublicChatPage from '../pages/PublicChatPage';
import { IconBriefcase, IconCalendar, IconDocument, IconInbox, IconUser, IconWallet } from './Icons';

const TABS = [
  { key: 'profile', label: 'Profile & credentials', icon: IconUser },
  { key: 'requests', label: 'Client requests', icon: IconInbox },
  { key: 'schedule', label: 'Availability', icon: IconCalendar },
  { key: 'transactions', label: 'Transactions & reviews', icon: IconBriefcase },
  { key: 'documents', label: 'Documents', icon: IconDocument },
  { key: 'messages', label: 'Messages', icon: IconInbox }, // TODO: swap for a dedicated chat icon if Icons.js has one
  { key: 'Public Chat', label: 'Public Chat', icon: IconInbox }, // TODO: same — reusing IconInbox as a placeholder
  { key: 'finance', label: 'Finance', icon: IconWallet },
];

/*
  ProfessionalDashboardShell
  The one layout the three role dashboards (Lawyer / Surveyor / Valuer) share.
  Each dashboard file is just this shell + a roleConfig — see
  LawyerDashboard.jsx / SurveyorDashboard.jsx / ValuerDashboard.jsx.

  Props:
  - userId: current professional's profiles.id (from useAuth() in your app)
  - roleConfig: entry from roleConfigs.js — label, dashboardTitle, role,
    credentialFields, and (new) supportsLocation
*/
export default function ProfessionalDashboardShell({ userId, roleConfig }) {
  const [tab, setTab] = useState('profile');

  return (
    <div className="pd-root">
      <div className="pd-shell">
        <aside className="pd-sidebar">
          <div className="pd-brand" style={{fontFamily:'italic'}}>
            The Real Estate Platform
            <br />
            <span>{roleConfig.label} portal</span>
          </div>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`pd-nav-item ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              <Icon width={16} height={16} />
              {label}
            </button>
          ))}
          <div className="pd-sidebar-foot"><button   style={{ color: 'white ', background:' #450804',border:'none',width:'120px',height:'40px',borderRadius:'5px' }} ><span>LOG OUT</span></button></div>
        </aside>

        <main className="pd-main">
          <div className="pd-topbar">
            <div>
              <h1>{TABS.find((t) => t.key === tab)?.label}</h1>
              <div className="pd-topbar-sub">{roleConfig.dashboardTitle}</div>
            </div>
          </div>

          {tab === 'profile' && <ProfileCredentialsSection userId={userId} roleConfig={roleConfig} />}
          {tab === 'requests' && <IncomingRequestsSection userId={userId} roleConfig={roleConfig} />}
          {tab === 'schedule' && <SchedulingSection userId={userId} roleConfig={roleConfig} />}
          {tab === 'transactions' && <TransactionsReviewsSection userId={userId} roleConfig={roleConfig} />}
          {tab === 'documents' && <DocumentEditorSection userId={userId} roleConfig={roleConfig} />}
          {tab === 'messages' && <MessagesSection />}
          {tab === 'finance' && <FinancialSection userId={userId} />}
          {tab === 'Public Chat' && <PublicChatPage userId={userId} roleConfig={roleConfig} />}
        </main>
      </div>
    </div>
  );
}