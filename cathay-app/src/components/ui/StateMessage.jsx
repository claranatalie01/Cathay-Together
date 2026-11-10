import './StateMessage.css';

// Centred message for empty, declined, unavailable and error states.
// `as` lets the style guide render several on one page without repeating <main>.
export default function StateMessage({ as: Tag = 'main', mark, tone = 'tint', title, text, children, role }) {
  return (
    <Tag className="state" role={role}>
      <span className={`state__mark${tone === 'sand' ? ' state__mark--sand' : ''}`} aria-hidden="true">
        {mark}
      </span>
      <h2 className="state__title">{title}</h2>
      {text && <p className="state__text">{text}</p>}
      {children && <div className="state__actions">{children}</div>}
    </Tag>
  );
}
