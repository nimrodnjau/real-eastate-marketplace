import { StampIcon } from './dashboard/icons';
import '../styles/loading-spinner.css';

export default function LoadingSpinner({
  message = 'Loading...',
  fullPage = false,
}) {
  return (
    <div
      className={`loading-spinner${fullPage ? ' loading-spinner--full-page' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="loading-spinner-logo" aria-hidden="true">
        <StampIcon />
      </div>

      <p>{message}</p>
    </div>
  );
}