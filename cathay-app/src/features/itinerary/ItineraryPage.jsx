import { useEffect, useMemo, useState } from 'react';
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
import StatTile from '../../components/ui/StatTile';
import Tabs from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { COPY } from '../../data/copy';
import { OSM_CREDIT } from '../../data/placeGeo';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './ItineraryPage.css';

const hours = (minutes) => `${Math.floor(minutes / 60)} hrs${minutes % 60 ? ` ${minutes % 60} min` : ''}`;

// The plan: summary tiles, a tab per day, the viewer's own flights, voted and suggested stops with
// travel between them, and the Maybe list. Edit lets you move and remove stops (flights stay put).
export default function ItineraryPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const copy = COPY.itin;
  const { status, data, error, reload } = useAsync(() => getItinerary(groupId), [groupId]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  useDocumentTitle(copy.title);

  // The editable order of each day's stops, taken from the saved plan.
  const saved = useMemo(() => (data ? Object.fromEntries(data.days.map((d) => [d.date, d.items.filter((i) => i.kind === 'place').map((i) => i.id)])) : null), [data]);
  useEffect(() => {
    if (!editing) setDraft(saved);
  }, [saved, editing]);

  const frame = (body) => (
    <Screen>
      <StatusBar />
      <PageHeader title={data?.group.name ?? 'Itinerary'} onBack={() => navigate(`/groups/${groupId}/preferences/saved`)} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (status === 'loading') return frame(<LoadingState variant="detail" />);
  if (status === 'error') {
    if (error instanceof ApiError && error.code === 'itinerary_not_built') return <Navigate to={`/groups/${groupId}/itinerary/building`} replace />;
    return frame(<ErrorState error={error} onRetry={reload} />);
  }

  const { days, summary, maybe } = data;
  const dayIndex = Math.min(Math.max(Number(params.get('day')) || 1, 1), days.length);
  const day = days[dayIndex - 1];
  const current = editing && draft ? draft : saved;
  const stopById = Object.fromEntries(days.flatMap((d) => d.items.map((i) => [i.id, i])));
  const ids = current[day.date];
  const flightFirst = day.items.filter((i) => i.kind.startsWith('flight') && day.items.indexOf(i) === 0);
  const flightLast = day.items.filter((i) => i.kind.startsWith('flight') && day.items.indexOf(i) > 0);

  const move = (from, to) => {
    const next = [...ids];
    [next[from], next[to]] = [next[to], next[from]];
    setDraft({ ...draft, [day.date]: next });
  };
  const remove = (id) => setDraft({ ...draft, [day.date]: ids.filter((x) => x !== id) });
  const cancel = () => {
    setEditing(false);
    setDraft(saved);
  };
  const save = async () => {
    setSaving(true);
    try {
      await saveItinerary(groupId, days.map((d) => ({ date: d.date, stopIds: draft[d.date] })));
      setEditing(false);
      toast(copy.saved);
    } catch (saveError) {
      toast(saveError instanceof ApiError && saveError.code === 'invalid_edit' ? saveError.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const stopLink = (stop) => `/groups/${groupId}/itinerary/places/${stop.id}`;
  const rows = editing
    ? [...flightFirst, ...ids.map((id) => stopById[id]), ...flightLast]
    : day.items;

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
        <Tabs
          label="Days"
          value={String(dayIndex)}
          onChange={(id) => setParams({ day: id }, { replace: true })}
          tabs={days.map((d) => ({ id: String(d.index), label: copy.dayLabel(d.index), sub: d.label }))}
          panelId="itinerary-day"
        />
        <section className="itinerary__day" id="itinerary-day" aria-labelledby="day-heading">
          <IconHeading icon="/assets/ui-calendar-teal.svg" tone="teal" id="day-heading">
            {copy.dayHeading(day.index, day.longLabel, day.title)}
          </IconHeading>
          {editing && <p className="itinerary__note">{copy.editNote}</p>}
          <ol className="itinerary__list">
            {rows.map((item) => {
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
                    onUp={() => move(placeIndex, placeIndex - 1)}
                    onDown={() => move(placeIndex, placeIndex + 1)}
                    onRemove={() => remove(item.id)}
                    pickFlightsTo={`/groups/${groupId}/flights/search`}
                  />
                </li>
              );
            })}
          </ol>
          {rows.length === 0 && <p className="itinerary__note">{copy.emptyDay}</p>}
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
        </section>

        {!editing && maybe.length > 0 && (
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
        <p className="itinerary__footnote">{copy.footnote}</p>
      </main>
      <div className="itinerary__bar">
        {editing ? (
          <>
            <Button variant="secondary" onClick={cancel} disabled={saving}>
              {copy.cancel}
            </Button>
            <Button onClick={save} disabled={saving} aria-busy={saving || undefined}>
              {saving ? copy.saving : copy.save}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <img src="/assets/ui-edit-teal.svg" alt="" />
              {copy.edit}
            </Button>
            <Button to={`/groups/${groupId}/details`}>{copy.done}</Button>
          </>
        )}
      </div>
    </>,
  );
}
