import './StatTile.css';

// A number with a label and an icon square (itinerary summary). tone: teal, steel or sand.
export default function StatTile({ icon, tone = 'teal', value, label }) {
  return (
    <div className={`stat stat--${tone}`}>
      <span className="stat__icon" aria-hidden="true">
        <img src={icon} alt="" />
      </span>
      <div className="stat__text">
        <p className="stat__value">{value}</p>
        <p className="stat__label">{label}</p>
      </div>
    </div>
  );
}
