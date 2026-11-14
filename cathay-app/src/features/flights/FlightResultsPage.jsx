import { useCallback, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getFlights, getSuggestions } from '../../api';
import FlightCard from '../../components/domain/FlightCard';
import PhotoHeader from '../../components/domain/PhotoHeader';
import BottomNav from '../../components/layout/BottomNav';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
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
import Sheet from '../../components/ui/Sheet';
import GroupCombinations, { RecommendedGroupFlight, hasGroup } from './SuggestionPanel';
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

  // The group's possible combinations feed the recommended card and comparison sheet.
  const suggestions = useAsync(() => getSuggestions(groupId, { direction, date, cabin }), [groupId, direction, date, cabin]);
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
  const showGroup = hasGroup(group) && group.direction === direction && group.date === shown.date && group.cabin === shown.cabin;
  const waitingForRecommendation = !showGroup && (status === 'loading' || suggestions.status === 'loading');
  // Solo travellers (or trips with no valid combination) can still choose a flight.
  const personalRecommendation = !showGroup && !waitingForRecommendation
    ? shown.flights.reduce((best, flight) => !best || flight.priceFrom < best.priceFrom ? flight : best, null)
    : null;
  const suggest = COPY.flights.suggest;
  const openSheet = () => setSheetOpen(true);
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
      <main className="results" id="flight-results" aria-busy={waitingForRecommendation || undefined}>
        <SegmentedControl
          name="cabin"
          label={copy.cabinLabel}
          value={shown.cabin}
          onChange={(id) => update({ cabin: id })}
          options={shown.cabins.map((c) => ({ id: c.id, label: c.label, sub: cabinSub(c) }))}
        />
        {showGroup && <RecommendedGroupFlight data={group} groupId={groupId} onOpen={openSheet} />}
        {waitingForRecommendation && <p className="results__message" role="status">{copy.loadingRecommendation}</p>}
        {personalRecommendation && (
          <section className="group-recommendation" aria-label={copy.flightOptions}>
            <FlightCard flight={personalRecommendation} to={flightLink(personalRecommendation)}
              match={{ tone: 'within', text: suggest.recommended }} fareLabel={suggest.yourFare} />
            <Button className="group-recommendation__more" variant="secondary" onClick={openSheet} aria-haspopup="dialog">
              {suggest.viewMore}
              <img src="/assets/ui-chevron-right.svg" alt="" />
            </Button>
          </section>
        )}
        {!showGroup && !waitingForRecommendation && !personalRecommendation && <p className="results__message">{copy.empty}</p>}
      </main>
      <Sheet open={sheetOpen && Boolean(showGroup || personalRecommendation)} onClose={closeSheet}
        title={showGroup ? suggest.title : copy.flightOptions} titleId="flight-options-title">
        {showGroup ? (
          <GroupCombinations data={group} groupId={groupId} direction={direction} cabinLabel={shown.cabins.find((c) => c.id === shown.cabin)?.label ?? ''} />
        ) : (
          <ul className="results__option-list">
            {shown.flights.map((flight) => <li key={flight.id}><FlightCard flight={flight} to={flightLink(flight)} /></li>)}
          </ul>
        )}
      </Sheet>
    </>,
    header,
  );
}
