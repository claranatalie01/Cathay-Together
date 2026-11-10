import { Link } from 'react-router-dom';
import Price from '../ui/Price';
import './FlightCard.css';

// One flight in the results list (real app, S5): a "ticket" with the trip on the left and the
// price on the right. The whole card is one link to that flight's fares.
// `match` is the group-timing badge: { tone: 'within' | 'outside', text: 'Lands 15m after Gaudi' }.
export default function FlightCard({ flight, to, match = null, className = '' }) {
  const label = `${flight.departTime} ${flight.from} to ${flight.arriveTime} ${flight.to}, ${flight.duration}, ${flight.flightNo}, from HKD ${flight.priceFrom.toLocaleString('en-US')} per adult${match ? `, ${match.text}` : ''}`;
  const note = flight.lowest ? 'Lowest Fare' : flight.seatsLeft ? `${flight.seatsLeft} Seats Left` : null;
  return (
    <Link className={`flight-card ${className}`.trim()} to={to} aria-label={label}>
      <span className="flight-card__trip">
        {match && (
          <span className={`flight-card__match flight-card__match--${match.tone}`}>
            {match.tone === 'within' && <img src="/assets/389be.svg" alt="" />}
            {match.text}
          </span>
        )}
        <span className="flight-card__times">
          <span className="flight-card__time">{flight.departTime}</span>
          <span className="flight-card__duration">{flight.duration}</span>
          <span className="flight-card__time">{flight.arriveTime}</span>
        </span>
        <span className="flight-card__route">
          <span className="flight-card__code">{flight.from}</span>
          <span className="flight-card__line">
            <img src="/assets/ui-plane-dark.svg" alt="" />
          </span>
          <span className="flight-card__code">{flight.to}</span>
        </span>
        <span className="flight-card__number">{flight.flightNo}</span>
        {flight.operatedBy && (
          <span className="flight-card__operator">
            {flight.flightNo} operated by <strong>{flight.operatedBy}</strong>
          </span>
        )}
      </span>
      <span className="flight-card__fare">
        {note && <span className="flight-card__note">{note}</span>}
        <Price amount={flight.priceFrom} className="flight-card__price" />
        <span className="flight-card__per">Per Adult From</span>
        <img className="flight-card__more" src="/assets/ui-dots-dark.svg" alt="" />
      </span>
    </Link>
  );
}
