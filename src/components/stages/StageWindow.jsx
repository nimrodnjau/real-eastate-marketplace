// components/stages/StageWindow.jsx
//
// Shared chrome for every stage window: header (eyebrow "Stage N of 8",
// title, subtitle), a Messages toggle, and a "cleared" banner with the
// stamp signature element once the stage is complete. Stage1Connect
// through Stage4Payment all render inside this.
//
// Purely presentational — no data fetching. `children` is the stage's
// own content; `messagesSlot` is rendered when the messages panel is open
// (see StageMessagePanel.jsx).

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import '../../styles/stage-shared.css';

function StampIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 13 10 18 19 7" />
    </svg>
  );
}

export default function StageWindow({
  stageNumber,
  totalStages = 8,
  title,
  subtitle,
  isComplete = false,
  clearedTitle = 'Stage cleared',
  clearedSubtitle,
  unreadMessageCount = 0,
  messagesSlot,
  children,
}) {
  const [messagesOpen, setMessagesOpen] = useState(false);

  return (
    <div className="stage-ui">
      <div className="stage-window">
        <div className="stage-window-header">
          <p className="stage-window-eyebrow">
            <span className="stage-window-eyebrow-dot" />
            Stage {stageNumber} of {totalStages}
          </p>
          <h2 className="stage-window-title">{title}</h2>
          {subtitle && <p className="stage-window-subtitle">{subtitle}</p>}

          {messagesSlot && (
            <button
              type="button"
              className="stage-window-messages-toggle"
              onClick={() => setMessagesOpen((o) => !o)}
            >
              <MessageCircle size={14} />
              <span>{messagesOpen ? 'Hide messages' : 'Messages'}</span>
              {unreadMessageCount > 0 && (
                <span className="stage-window-messages-badge">{unreadMessageCount}</span>
              )}
            </button>
          )}
        </div>

        <div className="stage-window-body">
          {messagesOpen && messagesSlot}

          {isComplete && (
            <div className="stage-window-cleared">
              <span className="stage-stamp">
                <StampIcon />
              </span>
              <div className="stage-window-cleared-text">
                <p className="stage-window-cleared-title">{clearedTitle}</p>
                {clearedSubtitle && <p className="stage-window-cleared-sub">{clearedSubtitle}</p>}
              </div>
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}

// Small stepper used inside a stage window to show sub-steps within that
// stage (e.g. Connect's inquiry -> visit -> pros). Not the same as the
// overall 8-stage tracker — this is scoped to one window.
export function StageSubsteps({ steps }) {
  return (
    <ol className="stage-substeps">
      {steps.map((step, i) => (
        <li key={step.key ?? i} className={`stage-substep stage-substep--${step.status}`}>
          <span className="stage-substep-marker">
            {step.status === 'done' ? '✓' : i + 1}
          </span>
          <span className="stage-substep-label">{step.label}</span>
          {i < steps.length - 1 && <span className="stage-substep-connector" />}
        </li>
      ))}
    </ol>
  );
}