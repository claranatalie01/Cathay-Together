import { Link } from 'react-router-dom';
import { COPY } from '../../data/copy';
import { fallbackTo } from '../../data/photos';
import './ItineraryStop.css';

const shortDate = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
};
const minutesLabel = (m) => (m >= 60 ? `${Math.floor(m / 60)}${m % 60 ? ` hr ${m % 60} min` : ' hr'}` : `${m} min`);

// One stop in a day: a booked flight (arrival teal, departure steel blue), a place with photo, or a
// prompt to choose flights. In edit mode a place shows move and remove buttons instead of linking.
export default function ItineraryStop({ stop, to, editing = false, canUp = false, canDown = false, onUp, onDown, onRemove, pickFlightsTo }) {
  const copy = COPY.itin;
  if (stop.kind === 'flight-missing') {
    const arrival = stop.id === 'flight-arrival';
    return (
      <div className="stop stop--missing">
        <p>{copy.flightMissing(arrival)}</p>
        {pickFlightsTo && (
          <Link className="stop__link" to={pickFlightsTo}>
            {copy.pickFlights}
          </Link>
        )}
      </div>
    );
  }
  if (stop.kind.startsWith('flight')) {
    const arrival = stop.kind === 'flight-arrival';
    return (
      <div className={`stop stop--flight stop--${arrival ? 'arrive' : 'leave'}`}>
        <img className="stop__flight-icon" src={`/assets/ui-plane-${arrival ? 'arrival' : 'departure'}.svg`} alt="" />
        <div className="stop__flight-body">
          <p className="stop__eyebrow">{copy.bookedFlight(arrival)}</p>
          <p className="stop__flight-route">
            {stop.from} <img src="/assets/ui-plane-dark.svg" alt="" />
            <span className="sr-only">to</span> {stop.to}
          </p>
          <p className="stop__meta">
            {shortDate(stop.date)} · {stop.flightNo}
          </p>
          <p className="stop__flight-times">
            {stop.departTime} to {stop.arriveTime}
          </p>
        </div>
      </div>
    );
  }

  const body = (
    <>
      <img className="stop__photo" src={stop.thumb} alt={stop.alt} referrerPolicy="no-referrer" onError={fallbackTo(stop.category_key)} />
      <div className="stop__body">
        <p className="stop__name">{stop.name}</p>
        <p className="stop__meta">
          {stop.durationLabel ?? minutesLabel(stop.minutes)} · {stop.costLabel}
        </p>
        <p className="stop__text">{stop.description}</p>
        <span className={`stop__tag${stop.source === 'voted' ? ' is-voted' : ''}`}>
          {stop.source === 'voted' ? (
            <>
              <img src="/assets/4714d.svg" alt="" />
              {copy.votedBy(stop.liked, stop.total)}
            </>
          ) : (
            <>
              <img src="/assets/ui-sparkle.svg" alt="" />
              {copy.suggested}
            </>
          )}
        </span>
      </div>
    </>
  );

  if (!editing) {
    return (
      <Link className="stop stop--place" to={to}>
        {body}
      </Link>
    );
  }
  return (
    <div className="stop stop--place stop--editing">
      {body}
      <div className="stop__tools">
        <button type="button" onClick={onUp} disabled={!canUp} aria-label={copy.moveUp(stop.name)}>
          <img src="/assets/ui-arrow-up.svg" alt="" />
        </button>
        <button type="button" onClick={onDown} disabled={!canDown} aria-label={copy.moveDown(stop.name)}>
          <img src="/assets/ui-arrow-down.svg" alt="" />
        </button>
        <button type="button" className="is-remove" onClick={onRemove} aria-label={copy.remove(stop.name)}>
          <img src="/assets/ui-trash.svg" alt="" />
        </button>
      </div>
    </div>
  );
}
