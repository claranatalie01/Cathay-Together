import './PhotoHeader.css';

// Destination photo with a dark overlay, white title and dates, and a rounded bottom-left
// curve (real app, S5 / S10). The title is the page <h1> and takes focus after navigation.
export default function PhotoHeader({ photo, eyebrow, title, subtitle, onBack, onEdit, editLabel = 'Edit search', titleId = 'page-title', titleAs: Title = 'h1', className = '' }) {
  return (
    <header className={`photo-header ${className}`.trim()}>
      <img className="photo-header__image" src={photo.cover} alt="" />
      <div className="photo-header__overlay" />
      {onBack && (
        <button className="photo-header__back" type="button" onClick={onBack} aria-label="Back">
          <img src="/assets/ui-back-light.svg" alt="" />
        </button>
      )}
      <div className="photo-header__text">
        {eyebrow && <p className="photo-header__eyebrow">{eyebrow}</p>}
        <Title className="photo-header__title" id={titleId} tabIndex={-1} data-page-title>
          {title}
        </Title>
        {subtitle && <p className="photo-header__subtitle">{subtitle}</p>}
      </div>
      {onEdit && (
        <button className="photo-header__edit" type="button" onClick={onEdit} aria-label={editLabel}>
          <img src="/assets/ui-pencil-light.svg" alt="" />
        </button>
      )}
    </header>
  );
}
