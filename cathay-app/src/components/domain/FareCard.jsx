import Button from '../ui/Button';
import Chip from '../ui/Chip';
import Price from '../ui/Price';
import './FareCard.css';

const ROWS = [
  { key: 'seat', label: 'Seat reservation', icon: 'ui-seat.svg', info: true },
  { key: 'baggage', label: 'Check-in baggage', icon: 'ui-baggage.svg' },
  { key: 'changeFee', label: 'Flight change fee*', icon: 'ui-change-flight.svg', money: true },
  { key: 'cancelFee', label: 'Cancellation fee', icon: 'ui-cancel-flight.svg', money: true },
];

// One fare type for a flight (real app, S6): gradient strip, name, price, a grey panel of four
// rules, a "Fare comparison" link and a small Select button.
export default function FareCard({ fare, onSelect, onCompare, busy = false, disabled = false }) {
  const titleId = `fare-${fare.id}`;
  return (
    <article className={`fare-card fare-card--${fare.id}`} aria-labelledby={titleId}>
      <div className="fare-card__strip" aria-hidden="true" />
      <div className="fare-card__body">
        <header className="fare-card__head">
          <div className="fare-card__title">
            <h3 className="fare-card__name" id={titleId}>
              {fare.name}
            </h3>
            {fare.tagline && <p className="fare-card__tagline">{fare.tagline}</p>}
            {fare.recommended && (
              <Chip tone="peach">
                <span aria-hidden="true">★ </span>Recommended
              </Chip>
            )}
          </div>
          <Price amount={fare.price} className="fare-card__price" />
        </header>
        <dl className="fare-card__panel">
          {ROWS.map((row) => {
            const value = fare.rows[row.key];
            return (
              <div className="fare-card__row" key={row.key}>
                <dt>
                  <img className="fare-card__icon" src={`/assets/${row.icon}`} alt="" />
                  {row.label}
                  {row.info && <img className="fare-card__info" src="/assets/ui-info.svg" alt="" />}
                </dt>
                <dd>{row.money ? (value === 0 ? <strong>Free</strong> : <Price amount={value} />) : <strong>{value}</strong>}</dd>
              </div>
            );
          })}
        </dl>
        <footer className="fare-card__foot">
          <button className="fare-card__compare" type="button" onClick={onCompare}>
            Fare comparison
          </button>
          <Button size="sm" onClick={() => onSelect(fare)} disabled={disabled} aria-busy={busy || undefined} aria-label={`Select ${fare.name} fare`}>
            Select
          </Button>
        </footer>
      </div>
    </article>
  );
}
