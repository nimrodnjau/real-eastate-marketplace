export default function ProcessTracker({ steps }) {
  return (
    <ol className="process-tracker">
      {steps.map((step, i) => (
        <li key={i} className={`process-step process-step--${step.status}`}>
          <span className="process-node" aria-hidden="true">
            {step.status === 'done' ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="5 13 10 18 19 7" />
              </svg>
            ) : null}
          </span>
          <span className="process-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}