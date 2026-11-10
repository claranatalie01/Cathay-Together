import './IconHeading.css';

// Section heading with a tinted icon square (Group details refresh, trialled in Flow E).
// tone: teal, steel or sand. `as` sets the heading level.
export default function IconHeading({ icon, tone = 'teal', as: Tag = 'h2', id, className = '', children }) {
  return (
    <div className={`icon-heading icon-heading--${tone} ${className}`.trim()}>
      <span className="icon-heading__icon" aria-hidden="true">
        <img src={icon} alt="" />
      </span>
      <Tag className="icon-heading__text" id={id}>
        {children}
      </Tag>
    </div>
  );
}

// Teal, steel blue and sand in turn, so each member keeps one colour on a screen.
export const avatarTone = (index) => ['teal', 'steel', 'sand'][index % 3];
