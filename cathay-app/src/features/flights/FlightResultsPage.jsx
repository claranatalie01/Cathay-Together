import { useCallback, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getFlights, getSuggestions } from '../../api';
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
import { cabinSub, hkd, routeTitle, spanLabel } from './flightFormat';
import Sheet from '../../components/ui/Sheet';
import GroupCombinations, { GroupBar, hasGroup, labelsByFlight } from './SuggestionPanel';
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
  const { status, data, error, reload } = useAsync(
    () => getFlights(groupId, { direction, date, cabin }),
    [groupId, direction, date, cabin],
  );

  // The group's possible combinations. They feed the bar, the sheet and the tags on the cards.
  // If this fails the page simply shows the plain flight list.
  const suggestions = useAsync(() => getSuggestions(groupId, { direction, cabin }), [groupId, direction, cabin]);
  const group = useLastData(suggestions.status, suggestions.data);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

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

  // Group timing: once someone else has chosen, flights are listed closest to the group first,
  // and each says how far apart the group would land (or take off).
  const timing = COPY.flights.timing;
  const hasTiming = shown.groupWindow.others.length > 0;
  const intro = hasTiming ? timing.intro[direction] : null;
  const flights = hasTiming ? [...shown.flights].sort((a, b) => a.timing.spreadMinutes - b.timing.spreadMinutes) : shown.flights;
  const sections = [{ id: 'all', flights, heading: null }];
  // A tag on the flights that are part of a suggestion, and a line saying how the flight sits
  // against the people who have already picked.
  const showGroup = hasGroup(group) && group.direction === direction;
  const tags = showGroup ? labelsByFlight(group) : {};
  const matchFor = (flight) =>
    tags[flight.id] ? { tone: 'within', text: tags[flight.id].map((id) => COPY.flights.suggest.tags[direction][id]).join(' · ') } : null;
  const gapFor = (flight) => {
    if (!flight.timing) return null;
    const { deltaMinutes, spreadMinutes } = flight.timing;
    if (deltaMinutes === null) {
      const text = timing.withGroup[direction];
      return spreadMinutes === 0 ? text.same : text.apart(spanLabel(spreadMinutes));
    }
    const text = timing.withOne[direction];
    const name = shown.groupWindow.others[0].name;
    if (deltaMinutes === 0) return text.same(name);
    return deltaMinutes > 0 ? text.after(spanLabel(deltaMinutes), name) : text.before(spanLabel(-deltaMinutes), name);
  };
  const flightLink = (flight) => `/groups/${groupId}/flights/${direction}/${flight.id}/fares?cabin=${shown.cabin}`;

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
        <SegmentedControl
          name="cabin"
          label={copy.cabinLabel}
          value={shown.cabin}
          onChange={(id) => update({ cabin: id })}
          options={shown.cabins.map((c) => ({ id: c.id, label: c.label, sub: cabinSub(c) }))}
        />
        {showGroup && <GroupBar data={group} onOpen={() => setSheetOpen(true)} />}
        <p className="results__count" role="status">
          {copy.count(shown.flights.length)}
        </p>
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
                      <FlightCard flight={flight} match={matchFor(flight)} gap={gapFor(flight)} to={flightLink(flight)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
      <Sheet open={sheetOpen && showGroup} onClose={closeSheet} title={COPY.flights.suggest.title} titleId="group-combinations-title">
        {showGroup && <GroupCombinations data={group} groupId={groupId} direction={direction} cabinLabel={shown.cabins.find((c) => c.id === shown.cabin)?.label ?? ''} />}
      </Sheet>
    </>,
    header,
  );
}
