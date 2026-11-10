import Button from './Button';
import Sheet from './Sheet';
import { COPY } from '../../data/copy';
import './CalendarSheet.css';

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
const money = (value) => value.toLocaleString('en-US');

// The months to draw: the one the window starts in and the next one.
function monthsFrom(startIso) {
  const start = new Date(`${startIso}T12:00:00Z`);
  return [0, 1].map((offset) => {
    const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1, 12));
    const year = first.getUTCFullYear();
    const month = first.getUTCMonth();
    const days = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
    return { year, month, blanks: first.getUTCDay(), days };
  });
}

// Select travel dates (real-app look): route header, weekday row, two months with the chosen
// window highlighted and the lowest economy fare under each open day, then Done.
// `windowInfo` is one item of GET /date-windows; every other day is shown but not selectable.
export default function CalendarSheet({ open, onClose, origin, destination, currency, windowInfo, rangeText, startText, endText }) {
  const copy = COPY.createGroup.calendar;
  const fares = new Map((windowInfo?.fares ?? []).map((f) => [f.date, f.priceFrom]));

  return (
    <Sheet open={open} onClose={onClose} title={copy.title} titleId="calendar-title" className="sheet--calendar">
      {windowInfo && (
        <>
          <div className="calendar__route">
            <div className="calendar__end">
              <strong>{origin}</strong>
              <span>{startText}</span>
            </div>
            <img className="calendar__plane" src="/assets/ui-plane-teal.svg" alt="" />
            <div className="calendar__end">
              <strong>{destination}</strong>
              <span>{endText}</span>
            </div>
          </div>
          <div className="calendar__weekdays" aria-hidden="true">
            {copy.weekdays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar__scroll">
            {monthsFrom(windowInfo.start).map(({ year, month, blanks, days }) => (
              <section className="calendar__month" key={`${year}-${month}`} aria-label={`${copy.months[month]} ${year}`}>
                <h3 className="calendar__month-title">{`${copy.months[month]} ${year}`}</h3>
                <ol className="calendar__grid">
                  {Array.from({ length: blanks }, (_, i) => (
                    <li key={`b${i}`} aria-hidden="true" />
                  ))}
                  {Array.from({ length: days }, (_, i) => {
                    const iso = isoOf(year, month, i + 1);
                    const inside = iso >= windowInfo.start && iso <= windowInfo.end;
                    const edge = iso === windowInfo.start ? ' is-start' : iso === windowInfo.end ? ' is-end' : '';
                    const fare = fares.get(iso);
                    return (
                      <li
                        key={iso}
                        className={`calendar__day${inside ? ` is-selected${edge}` : ''}`}
                        aria-disabled={inside ? undefined : 'true'}
                        aria-current={inside && edge ? 'date' : undefined}
                      >
                        <span className="calendar__num">{i + 1}</span>
                        {inside && fare != null && <span className="calendar__fare">{money(fare)}</span>}
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
          <p className="calendar__note">{copy.note(rangeText, origin, currency)}</p>
        </>
      )}
      {!windowInfo && <p className="calendar__note">{copy.loading}</p>}
      <Button className="calendar__done" onClick={onClose} data-autofocus>
        {copy.done}
      </Button>
    </Sheet>
  );
}
