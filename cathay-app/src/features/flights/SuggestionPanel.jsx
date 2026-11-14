import { useState } from 'react';
import Button from '../../components/ui/Button';
import FlightCard from '../../components/domain/FlightCard';
import { COPY } from '../../data/copy';
import { hkd, spanLabel } from './flightFormat';
import './SuggestionPanel.css';

const STEP = 5;

// True when the suggestions hold something worth showing: a group of two or more.
export const hasGroup = (data) => Boolean(data && data.featured.length > 0 && data.featured[0].picks.length >= 2);

export function RecommendedGroupFlight({ data, groupId, onOpen }) {
  const copy = COPY.flights.suggest;
  const recommendation = data.featured.find((option) => option.labels.includes('balanced'));
  const mine = recommendation?.picks.find((pick) => pick.userId === data.viewerId);
  const gap = recommendation ? spreadText(recommendation, data.direction) : null;
  return (
    <section className="group-recommendation" aria-label={copy.title}>
      {mine && (
        <FlightCard
          flight={{ ...mine, priceFrom: mine.price }}
          to={mine.fixed ? undefined : `/groups/${groupId}/flights/${data.direction}/${mine.flightId}/fares?cabin=${data.cabin}`}
          match={{ tone: 'within', text: copy.recommended }}
          gap={gap[0].toUpperCase() + gap.slice(1)}
          fareLabel={mine.fixed ? copy.yourSelectedFare : copy.yourFare}
        />
      )}
      <Button className="group-recommendation__more" variant="secondary" onClick={onOpen}
        aria-haspopup="dialog">
        {copy.viewMore}
        <img src="/assets/ui-chevron-right.svg" alt="" />
      </Button>
    </section>
  );
}

const spreadText = (option, direction) => {
  const copy = COPY.flights.suggest;
  return option.spreadMinutes === 0 ? copy.together[direction] : copy.spread[direction](spanLabel(option.spreadMinutes));
};

// Who flies what in one combination, and the button that opens the viewer's own flight.
function Combination({ option, groupId, direction, cabin, viewerId }) {
  const copy = COPY.flights.suggest;
  const me = option.picks.find((p) => p.userId === viewerId);
  return (
    <>
      <ul className="suggest__list">
        {option.picks.map((p) => (
          <li className="suggest__row" key={p.userId}>
            <span className="suggest__who">
              {p.userId === viewerId ? copy.youName : p.name}
              <span className="suggest__sub">
                {p.airport.code} · <strong>{p.flightNo}</strong>
                {p.stops ? ` · ${copy.stops(p.stops)}` : ''}
                {p.fixed ? ` · ${copy.alreadyChosen}${p.cabinLabel ? `, ${p.cabinLabel}` : ''}` : ''}
              </span>
              {p.via && <span className="suggest__sub">Via Hong Kong · {p.via.layoverLabel} wait</span>}
            </span>
            <span className="suggest__time">
              {p.time}
              {p.nextDay && <span className="suggest__sub"> {copy.nextDay}</span>}
            </span>
            <span className="suggest__price">
              {hkd(p.price)}
              {p.extra > 0 && <span className="suggest__sub">{copy.extra(hkd(p.extra))}</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="suggest__foot">
        <p className="suggest__summary">
          <strong>{copy.total(hkd(option.total))}</strong> · {spreadText(option, direction)}
        </p>
        {/* Choosing is always the person's own: this only opens their flight. A flight they have
            already chosen needs no button. */}
        {me && !me.fixed && (
          <Button className="suggest__choose" to={`/groups/${groupId}/flights/${direction}/${me.flightId}/fares?cabin=${cabin}`} variant="secondary">
            {copy.choose(me.flightNo)}
          </Button>
        )}
      </div>
    </>
  );
}

// What goes inside the bottom sheet: possible combinations, one flight per member, in the order
// cheapest, closest, best of both, then the rest. Everyone still chooses their own flight; this
// only shows what would line up. Members who have chosen stay as chosen; the others are placed
// from their own airport in the selected cabin. PROPOSAL: not in the real-app screenshots.
export default function GroupCombinations({ data, groupId, direction, cabinLabel }) {
  const copy = COPY.flights.suggest;
  const [visible, setVisible] = useState(STEP);
  const labelsOf = (labels) => labels.map((id) => copy.sections[direction][id]).join(' · ');
  const common = { groupId, direction, cabin: data.cabin, viewerId: data.viewerId };

  return (
    <div className="suggest">
      <p className="suggest__help">{copy.help(cabinLabel)}</p>

      {data.featured.map((f) => (
        <section className="suggest__card" key={f.labels.join()} aria-label={labelsOf(f.labels)}>
          <h3 className="suggest__heading">{labelsOf(f.labels)}</h3>
          <Combination option={f} {...common} />
        </section>
      ))}

      {data.others.length > 0 && (
        <section className="suggest__others" aria-labelledby="suggest-others">
          <h3 className="suggest__heading suggest__heading--plain" id="suggest-others">
            {copy.others}
          </h3>
          <p className="suggest__help">{copy.othersHelp}</p>
          <ul className="suggest__more">
            {data.others.slice(0, visible).map((option) => (
              <li key={option.picks.map((p) => p.flightId).join('|')}>
                <details className="suggest__detail">
                  <summary className="suggest__summary-line">
                    <span>{hkd(option.total)}</span>
                    <span className="suggest__sub">{spreadText(option, direction)}</span>
                    <img className="suggest__chevron" src="/assets/ui-chevron-down.svg" alt="" />
                  </summary>
                  <Combination option={option} {...common} />
                </details>
              </li>
            ))}
          </ul>
          {data.others.length > visible && (
            <Button variant="secondary" onClick={() => setVisible(visible + STEP)}>
              {copy.showMore(Math.min(STEP, data.others.length - visible))}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
