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

// Each person keeps one avatar colour on every screen: Kabe teal, Gaudi steel blue, Clara sand.
// Anyone else gets a colour from their id, so it still never changes between pages.
const MEMBER_TONES = { kabe: 'teal', gaudi: 'steel', clara: 'sand' };
const TONES = ['teal', 'steel', 'sand'];
export function avatarTone(userId = '') {
  if (MEMBER_TONES[userId]) return MEMBER_TONES[userId];
  let h = 0;
  for (const ch of String(userId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}
