import { Icon } from './icons';

export default function SectionCard({ id, icon, title, description, action, children }) {
  return (
    <section className="section-card" id={id}>
      <header className="section-card-header">
        <div className="section-card-heading">
          <span className="section-card-icon">
            <Icon name={icon} />
          </span>
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
        </div>
        {action && (
          <button type="button" className="section-card-action">
            {action.label}
          </button>
        )}
      </header>
      {children}
    </section>
  );
}