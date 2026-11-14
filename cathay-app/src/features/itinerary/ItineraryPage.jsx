import { useCallback, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, getItinerary, saveItinerary } from '../../api';
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
import ItineraryTimeline from './ItineraryTimeline';
import './ItineraryPage.css';

const hours = (minutes) => `${Math.floor(minutes / 60)} hrs${minutes % 60 ? ` ${minutes % 60} min` : ''}`;

// The plan: summary tiles, a tab per day, the viewer's own flights, voted and suggested stops with
// travel between them, and the Maybe list. Edit lets you replace, move and remove activities.
export default function ItineraryPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const copy = COPY.itin;
  const { status, data, error, reload } = useAsync(() => getItinerary(groupId), [groupId]);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);
  const closeEdit = useCallback(() => {
    if (savePending.current) return;
    setEdit(null);
    setEditError('');
  }, []);
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

  const { days, summary, maybe } = data;
  const dayIndex = Math.min(Math.max(Math.trunc(Number(params.get('day'))) || 1, 1), days.length);
  const day = days[dayIndex - 1];
  const view = params.get('view') === 'timeline' ? 'timeline' : 'list';
  const list = view === 'list';
  const sharedStops = data.sharedDays.find(({ date }) => date === day.date)?.stops ?? [];
  const ids = day.items.filter((item) => item.kind === 'place').map(({ id }) => id);
  const removed = data.removedByDay[day.date] ?? [];
  const patchParams = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const openEdit = (stop, change = null) => {
    const elsewhere = new Set(day.items.filter((item) => item.id !== stop.id).map((item) => item.placeId));
    const places = data.editPlaces.filter(({ id }) => id !== stop.placeId && !elsewhere.has(id));
    setEditError('');
    const shared = change?.type !== 'restore' && sharedStops.find(({ id }) => id === stop.id);
    setEdit({
      stage: change ? 'scope' : 'activity', change, stop, day, places, shared,
      scope: change?.type === 'restore' ? 'personal' : null,
      groupRevision: data.groupRevision, personalRevision: data.personalRevision,
    });
  };

  const save = async () => {
    if (savePending.current) return;
    savePending.current = true;
    setSaving(true);
    setEditError('');
    try {
      await saveItinerary(groupId, {
        scope: edit.scope, groupRevision: edit.groupRevision, personalRevision: edit.personalRevision,
        change: { ...edit.change, date: edit.day.date, stopId: edit.stop.id },
      });
      setEdit(null);
      toast(edit.scope === 'personal' ? copy.savedPersonal : copy.savedGroup);
    } catch (error) {
      setEditError(error instanceof ApiError ? error.message : copy.saveFailed);
      if (error instanceof ApiError && error.code === 'itinerary_changed') {
        setEdit(null);
        toast(error.message);
        reload();
      }
    } finally {
      savePending.current = false;
      setSaving(false);
    }
  };

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
        <SegmentedControl
          name="itinerary-view"
          label={copy.viewLabel}
          value={view}
          onChange={(value) => {
            setEditing(false);
            patchParams('view', value === 'list' ? null : value);
          }}
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
              {editing && <p className="itinerary__note">{copy.editNote}</p>}
              <ol className="itinerary__list">
                {day.items.map((item) => {
                  const placeIndex = ids.indexOf(item.id);
                  return (
                    <li key={item.id}>
                      {!editing && item.travelBefore && <TravelConnector minutes={item.travelBefore.minutes} text={item.travelBefore.text} />}
                      <p className="itinerary__slot">{item.kind.startsWith('flight') && item.title ? `${item.slot} · ${item.title === 'Arrival' ? 'Arrive in Tokyo' : 'Flight home'}` : item.slot}</p>
                      <ItineraryStop
                        stop={item}
                        to={stopLink(item)}
                        editing={editing}
                        canUp={placeIndex > 0}
                        canDown={placeIndex !== -1 && placeIndex < ids.length - 1}
                        onUp={() => openEdit(item, { type: 'move', direction: -1 })}
                        onDown={() => openEdit(item, { type: 'move', direction: 1 })}
                        onRemove={() => openEdit(item, { type: 'remove' })}
                        onReplace={Number.isFinite(item.start) && data.editPlaces.some(({ id }) => id !== item.placeId) ? () => openEdit(item) : undefined}
                        onRestore={item.myChange ? () => openEdit(item, { type: 'restore' }) : undefined}
                        pickFlightsTo={`/groups/${groupId}/flights/search`}
                      />
                    </li>
                  );
                })}
              </ol>
              {removed.map((item) => (
                <div className="itinerary__removed" key={item.id}>
                  <span>{copy.removedStop(item.name)} <strong>{copy.myChange}</strong></span>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(item, { type: 'restore' })}>{copy.restoreShared}</Button>
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
          ) : <ItineraryTimeline data={data.timeline[dayIndex - 1]} filter={params.get('traveller')} onFilter={(id) => patchParams('traveller', id)} />}
        </section>

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
        {list && <p className="itinerary__footnote">{copy.footnote}</p>}
      </main>
      <div className="itinerary__bar">
        {list && (
          <Button variant="secondary" onClick={() => setEditing((current) => !current)}>
            {!editing && <img src="/assets/ui-edit-teal.svg" alt="" />}
            {editing ? copy.done : copy.edit}
          </Button>
        )}
        {!editing && <Button to={`/groups/${groupId}/details`}>{copy.done}</Button>}
      </div>
    </>,
    <ItineraryEditSheet edit={edit} setEdit={setEdit} onClose={closeEdit} onSave={save} busy={saving} error={editError} />,
  );
}
