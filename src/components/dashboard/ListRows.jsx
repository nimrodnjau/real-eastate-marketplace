export default function ListRows({ items, emptyLabel = 'Nothing here yet.' }) {
  if (!items || items.length === 0) {
    return <p className="list-empty">{emptyLabel}</p>;
  }

  return (
    <ul className="list-rows">
      {items.map((item, i) => (
        <li key={i} className="list-row">
          <div className="list-row-text">
            <p className="list-row-title">{item.title}</p>
            <p className="list-row-meta">{item.meta}</p>
          </div>
          <div className="list-row-actions">
            {item.badge && (
              <span className={`badge badge--${item.badgeTone || 'neutral'}`}>{item.badge}</span>
            )}
            {item.onViewPhotos && (
              <button
                type="button"
                className="list-row-photos-btn"
                onClick={item.onViewPhotos}
                aria-label={`View photos for ${item.title}`}
              >
                {item.photoCount > 0 ? `Photos (${item.photoCount})` : 'No photos'}
              </button>
            )}
            {item.onClick && (
              <button
                type="button"
                className="list-row-edit-btn"
                onClick={item.onClick}
                aria-label={`Edit ${item.title}`}
              >
                Edit
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}