import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, getItinerary } from '../../api';
import ItineraryStop from '../../components/domain/ItineraryStop';
import TravelConnector from '../../components/domain/TravelConnector';
import BottomNav from '../../components/layout/BottomNav';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import IconHeading from '../../components/ui/IconHeading';
import SegmentedControl from '../../components/ui/SegmentedControl';
import StatTile from '../../components/ui/StatTile';
import Tabs from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { COPY } from '../../data/copy';
import { OSM_CREDIT } from '../../data/placeGeo';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import CalendarExport from './CalendarExport';
import ItineraryEditSheet from './ItineraryEditSheet';
import { useItineraryDraft } from './useItineraryDraft';
import { useStopReorder } from './useStopReorder';
import ItineraryTimeline from './ItineraryTimeline';
import './ItineraryPage.css';

const hours = (minutes) => `${Math.floor(minutes / 60)} hrs${minutes % 60 ? ` ${minutes % 60} min` : ''}`;

// The plan: summary tiles, a tab per day, the viewer's own flights, voted and suggested stops with
// travel between them, and the Maybe list. Edit lets you retime, move and remove activities.
export default function ItineraryPage() {
  const { groupId } = useParams();
  return <TripItinerary key={groupId} groupId={groupId} />;
}

function TripItinerary({ groupId }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const copy = COPY.itin;
  const { status, data, error, reload } = useAsync(() => getItinerary(groupId), [groupId]);
  const draft = useItineraryDraft(groupId, data, toast);
  const { session, panel, busy, error: draftError, openPanel, apply } = draft;
  const editing = Boolean(session);
  const dragHandlers = useStopReorder(params.toString(), (id, target) => {
    const date = days[dayIndex - 1].date;
    apply({ type: 'move', id, target, date, reviewTime: true });
  });
  useDocumentTitle(copy.title);

  const frame = (body, sheet) => (
    <Screen>
      <StatusBar />
      <PageHeader title={data?.group.name ?? 'Itinerary'} onBack={() => navigate(`/groups/${groupId}/preferences/saved`)} />
      {status === 'success' && <CalendarExport key={groupId} itinerary={data} />}
      {body}
      <BottomNav variant="groups" />
      {sheet}
    </Screen>
  );

  if (status === 'loading') return frame(<LoadingState variant="detail" />);
  if (status === 'error') {
    if (error instanceof ApiError && error.code === 'itinerary_not_built') return <Navigate to={`/groups/${groupId}/itinerary/building`} replace />;
    return frame(<ErrorState error={error} onRetry={reload} />);
  }

  const { summary, maybe } = data;
  const days = session?.preview?.days ?? (session?.scope === 'group' ? data.sharedActivityDays ?? data.days : data.days);
  const dayIndex = Math.min(Math.max(Math.trunc(Number(params.get('day'))) || 1, 1), days.length);
  const day = days[dayIndex - 1];
  const view = params.get('view') === 'timeline' ? 'timeline' : 'list';
  const list = view === 'list';
  const ids = day.items.filter((item) => item.kind === 'place').map(({ id }) => id);
  const removed = session?.scope === 'group' ? [] : (data.removedByDay[day.date] ?? [])
    .filter((item) => !ids.includes(item.id));
  const patchParams = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  function editStop(type, item, extra) {
    apply({ type, id: item.id, name: item.name, date: day.date, ...extra });
  }

  function fixTime(issue, fromReview = false) {
    const stop = days.find(({ date }) => date === issue.date)?.items.find(({ id }) => id === issue.id);
    openPanel({ type: 'time', issue, stop, fromReview });
  }

  function addOperation(op, scope, date) {
    if (date) {
      const next = new URLSearchParams(params);
      next.set('day', String(days.find((entry) => entry.date === date).index));
      next.delete('view');
      setParams(next, { replace: true });
    }
    apply(op, scope, panel?.type === 'time' ? panel : null);
  }

  const stopLink = (stop) => `/groups/${groupId}/itinerary/places/${stop.id}?day=${dayIndex}`;

  return frame(
    <>
      <main className="itinerary">
        <section className="itinerary__tiles" aria-label="Summary">
          <StatTile icon="/assets/ui-pin-teal.svg" tone="teal" value={copy.places(summary.places)} label={copy.placesSub(summary.voted, summary.places - summary.voted)} />
          <StatTile icon="/assets/ui-calendar.svg" tone="steel" value={copy.days(summary.days)} label={data.group.datesLabel} />
          <StatTile icon="/assets/ui-yen-sand.svg" tone="sand" value={`¥${summary.costPerPerson.toLocaleString('en-US')}`} label={copy.cost} />
          <StatTile icon="/assets/ui-arrows-steel.svg" tone="steel" value={`${summary.avgTravelMinutes} min`} label={copy.travel} />
        </section>
        <p className="itinerary__from">{copy.builtFrom(data.members)}</p>
        {editing && <p className="itinerary__scope">{session.scope === 'personal' ? copy.scopePersonal : copy.scopeGroup} · Draft</p>}
        <Button className="itinerary__add-place" variant="secondary" disabled={busy} onClick={() => openPanel({ type: 'search' })}>
          <img src="/assets/ui-pin-teal.svg" alt="" />
          {copy.addPlace}
        </Button>
        <SegmentedControl
          name="itinerary-view"
          label={copy.viewLabel}
          value={view}
          onChange={(value) => patchParams('view', value === 'list' ? null : value)}
          options={[
            { id: 'list', label: COPY.board.list, icon: '/assets/ui-list.svg', iconSelected: '/assets/ui-list-light.svg' },
            { id: 'timeline', label: COPY.board.timeline, icon: '/assets/ui-timeline.svg', iconSelected: '/assets/ui-timeline-light.svg' },
          ]}
        />
        <Tabs
          label="Days"
          value={String(dayIndex)}
          onChange={(id) => patchParams('day', id)}
          tabs={days.map((d) => ({ id: String(d.index), label: copy.dayLabel(d.index), sub: d.label }))}
          panelId="itinerary-day"
        />
        <section className="itinerary__day" id="itinerary-day" aria-labelledby="day-heading">
          <IconHeading icon="/assets/ui-calendar-teal.svg" tone="teal" id="day-heading">
            {copy.dayHeading(day.index, day.longLabel, day.title)}
          </IconHeading>
          {list ? (
            <>
              {editing && <p className="itinerary__note">Press and hold a card to reorder it, or use Move up and Move down.</p>}
              <ol className="itinerary__list">
                {day.items.map((item) => {
                  const placeIndex = ids.indexOf(item.id);
                  const editable = placeIndex >= 0 && !item.fixed && !item.booked;
                  const issue = session?.preview?.issues.find((entry) => entry.date === day.date && entry.id === item.id);
                  return (
                    <li key={item.id} data-edit-stop={editing && editable ? item.id : undefined}>
                      {item.travelBefore && <TravelConnector minutes={item.travelBefore.minutes} text={item.travelBefore.text} />}
                      <p className="itinerary__slot">{item.kind.startsWith('flight') && item.title ? `${item.slot} · ${item.title === 'Arrival' ? 'Arrive in Tokyo' : 'Flight home'}` : item.slot}</p>
                      <ItineraryStop
                        stop={item}
                        to={stopLink(item)}
                        editing={editing}
                        canUp={editable && !busy && placeIndex > 0}
                        canDown={editable && !busy && placeIndex < ids.length - 1}
                        onUp={() => editStop('move', item, { target: ids[placeIndex - 1], reviewTime: true })}
                        onDown={() => editStop('move', item, { target: ids[placeIndex + 1], reviewTime: true })}
                        onRemove={editable && !busy ? () => editStop('remove', item) : undefined}
                        onEditDuration={editable && !busy ? () => openPanel({ type: editing ? 'duration' : 'scope', stop: item }) : undefined}
                        dragHandlers={editing && editable && !busy ? dragHandlers : undefined}
                        onRestore={editing && !busy && session.scope === 'personal' && item.myChange ? () => editStop('restore', item) : undefined}
                        pickFlightsTo={`/groups/${groupId}/flights/search`}
                      />
                      {issue && <div className="itinerary-edit__warning">
                        <p>{issue.reason}</p>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => fixTime(issue)}>Fix time</Button>
                      </div>}
                    </li>
                  );
                })}
              </ol>
              {removed.map((item) => (
                <div className="itinerary__removed" key={item.id}>
                  <span>{copy.removedStop(item.name)} <strong>{copy.myChange}</strong></span>
                  {editing && <Button size="sm" variant="secondary" disabled={busy} onClick={() => editStop('restore', item)}>{copy.restoreShared}</Button>}
                </div>
              ))}
              {day.items.length === 0 && <p className="itinerary__note">{copy.emptyDay}</p>}
              {!editing && (
                <div className="itinerary__total">
                  <p>
                    <img src="/assets/ui-yen-sand.svg" alt="" />
                    {copy.dayTotal(day.totals.cost, hours(day.totals.minutes))}
                  </p>
                  <p className="itinerary__total-note">
                    {data.builtBy === 'ai' ? copy.researchedTravel(day.totals.travelMinutes) : copy.allowance(day.totals.allowance, day.totals.travelMinutes)}
                    {data.usesOpenStreetMap && <> · <a href="https://www.openstreetmap.org/copyright">{OSM_CREDIT}</a></>}
                    {data.usesGeoapify && <> · <a href="https://www.geoapify.com/">Powered by Geoapify</a></>}
                  </p>
                </div>
              )}
            </>
          ) : <>
            {editing && <p className="itinerary__note">Timeline shows your saved itinerary. Draft changes are shown in List.</p>}
            <ItineraryTimeline data={data.timeline[dayIndex - 1]} filter={params.get('traveller')} onFilter={(id) => patchParams('traveller', id)} />
          </>}
        </section>

        {editing && session.preview?.issues.filter(({ date, id }) => date === day.date && (!list || !day.items.some((item) => item.id === id))).map((issue) => (
          <div className="itinerary-edit__warning" key={issue.id}><p><strong>{issue.name}</strong> · {issue.reason}</p>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => fixTime(issue)}>Fix time</Button>
          </div>
        ))}
        {editing && draftError && !panel && <p role="alert">{draftError}</p>}

        {list && !editing && maybe.length > 0 && (
          <section className="itinerary__maybe" aria-labelledby="maybe-heading">
            <IconHeading icon="/assets/4714d.svg" tone="sand" id="maybe-heading">
              {copy.maybeTitle}
            </IconHeading>
            <p className="itinerary__note">{copy.maybeNote}</p>
            <ul>
              {maybe.map((place) => (
                <li key={place.placeId}>
                  <p className="itinerary__maybe-name">{place.name}</p>
                  <p className="itinerary__note">{copy.maybeLine(place.liked, place.passed, place.duration, place.savedNote)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <div className="itinerary__bar">
        {editing ? <>
          <Button variant="secondary" disabled={busy} onClick={() => session.operations.length ? openPanel({ type: 'discard' }) : draft.discard()}>Cancel editing</Button>
          <Button disabled={busy || !session.operations.length} onClick={() => draft.recheck()}>{busy ? 'Updating…' : 'Finished editing'}</Button>
        </> : <>
          <Button variant="secondary" onClick={() => openPanel({ type: 'scope' })}>{copy.edit}</Button>
          <Button to={`/groups/${groupId}/details`}>{copy.done}</Button>
        </>}
      </div>
    </>,
    panel && <ItineraryEditSheet key={panel.type + (panel.issue?.id ?? '')} panel={panel} session={session} data={data} day={day}
      busy={busy} error={draftError} onClose={draft.closePanel} onPanel={openPanel}
      onStart={(scope) => {
        patchParams('view', null);
        draft.start(scope);
        const startDay = scope === 'group' ? (data.sharedActivityDays ?? data.days).find(({ date }) => date === day.date) : day;
        const stop = startDay?.items.find(({ id }) => id === panel.stop?.id);
        if (stop) openPanel({ type: 'duration', stop });
      }}
      onOperation={addOperation} onSave={draft.save} onRecheck={() => draft.recheck()}
      onRebase={draft.rebase} onDiscard={draft.discard} onFix={(issue) => fixTime(issue, true)}
      onUndo={draft.undo} />,
  );
}
