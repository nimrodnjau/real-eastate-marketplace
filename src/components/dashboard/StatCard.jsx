import { Icon } from './icons';

export default function StatCard({ icon, label, value, hint }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon">
        <Icon name={icon} />
      </div>
      <p className="stat-card-value">{value}</p>
      <p className="stat-card-label">{label}</p>
      {hint && <p className="stat-card-hint">{hint}</p>}
    </div>
  );
}