import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getFlights } from '../../api';
import FlightCard from '../../components/domain/FlightCard';
import PhotoHeader from '../../components/domain/PhotoHeader';
import BottomNav from '../../components/layout/BottomNav';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import SegmentedControl from '../../components/ui/SegmentedControl';
import Tabs from '../../components/ui/Tabs';
import { COPY } from '../../data/copy';
import { WING_PHOTO } from '../../data/photos';
import { useAsync } from '../../hooks/useAsync';
import { useLastData } from '../../hooks/useLastData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cabinSub, hkd, routeTitle } from './flightFormat';
import './FlightResultsPage.css';

// Flights for one direction. The chosen day and cabin live in the URL (?date=&cabin=), so Back,
// Forward and direct links all work. Each card links to that flight's fares.
export default function FlightResultsPage({ direction = 'outbound' }) {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const copy = COPY.flights.results;
  const date = params.get('date') ?? undefined;
  const cabin = params.get('cabin') ?? undefined;
  const oneWay = params.get('trip') === 'oneway';
  const windowHours = params.get('window') ?? undefined;
  const { status, data, error, reload } = useAsync(
    () => getFlights(groupId, { direction, date, cabin, window: windowHours }),
    [groupId, direction, date, cabin, windowHours],
  );

  // Keep showing the last results while a new day or cabin loads, so the page does not flash.
  const shown = useLastData(status, data);

  useDocumentTitle(shown ? routeTitle(shown.route) : 'Flights');

  const searchPath = `/groups/${groupId}/flights/search`;
  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => next.set(key, value));
    setParams(next, { replace: true });
  };

  const frame = (body, header) => (
    <Screen>
      <StatusBar />
      {header ?? <PhotoHeader photo={WING_PHOTO} title="Flights" onBack={() => navigate(searchPath)} />}
      {body}
      <BottomNav variant="book" />
    </Screen>
  );

  if (status === 'error') return frame(<ErrorState error={error} onRetry={reload} />);
  if (!shown) return frame(<LoadingState variant="list" />);

  const header = (
    <PhotoHeader
      photo={WING_PHOTO}
      eyebrow={oneWay ? copy.oneWay : shown.tripLabel}
      title={routeTitle(shown.route)}
      subtitle={oneWay ? shown.dates.find((d) => d.date === shown.date)?.label : shown.rangeLabel}
      onBack={() => navigate(searchPath)}
      onEdit={() => navigate(searchPath)}
      editLabel={copy.editSearch}
    />
  );
  const loading = status === 'loading';

  // Group timing: flights are listed under "within the window", then by how far outside it they are.
  const timing = COPY.flights.timing;
  const hours = shown.groupWindow.hours;
  const hasTiming = shown.groupWindow.others.length > 0;
  const intro = hasTiming ? (direction === 'outbound' ? timing.introOutbound(hours) : timing.introReturn(hours)) : null;
  const ORDER = ['within', '15m', '30m', '1h', '2h', 'more'];
  const sections = hasTiming
    ? ORDER.map((id) => ({
        id,
        flights: shown.flights.filter((f) => f.timing.bucket === id),
        heading: id === 'within' ? timing.headingWithin[direction](hours) : timing.headingOutside[direction](id),
      })).filter((section) => section.flights.length > 0)
    : [{ id: 'all', flights: shown.flights, heading: null }];
  const matchFor = (flight) =>
    flight.timing
      ? { tone: flight.timing.within ? 'within' : 'outside', text: flight.timing.within ? timing.badge.within(hours) : timing.badge.outside(flight.timing.bucket) }
      : null;
  const flightLink = (flight) =>
    `/groups/${groupId}/flights/${direction}/${flight.id}/fares?cabin=${shown.cabin}${windowHours ? `&window=${windowHours}` : ''}`;

  return frame(
    <>
      <Tabs
        label={copy.datesLabel}
        scroll
        value={shown.date}
        onChange={(id) => update({ date: id })}
        panelId="flight-results"
        tabs={shown.dates.map((d) => ({
          id: d.date,
          label: d.label,
          sub: d.priceFrom === null ? copy.unavailable : hkd(d.priceFrom),
          disabled: d.priceFrom === null,
        }))}
      />
      <main className="results" id="flight-results" aria-busy={loading || undefined}>
        <p className="results__count" role="status">
          {copy.count(shown.flights.length)}
        </p>
        <SegmentedControl
          name="cabin"
          label={copy.cabinLabel}
          value={shown.cabin}
          onChange={(id) => update({ cabin: id })}
          options={shown.cabins.map((c) => ({ id: c.id, label: c.label, sub: cabinSub(c) }))}
        />
        {intro && <p className="results__intro">{intro}</p>}
        {shown.flights.length === 0 ? (
          <p className="results__empty">{copy.empty}</p>
        ) : (
          <div className={`results__groups${loading ? ' is-loading' : ''}`}>
            {sections.map((section) => (
              <section className="results__group" key={section.id} aria-labelledby={`group-${section.id}`}>
                {section.heading && (
                  <h2 className={`results__heading results__heading--${section.id === 'within' ? 'within' : 'outside'}`} id={`group-${section.id}`}>
                    {section.heading}
                  </h2>
                )}
                <ul className="results__list">
                  {section.flights.map((flight) => (
                    <li key={flight.id}>
                      <FlightCard flight={flight} match={matchFor(flight)} to={flightLink(flight)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </>,
    header,
  );
}
