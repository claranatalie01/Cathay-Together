import { useEffect, useState } from 'react';
import { getItineraryCatalogue } from '../../api';
import { clockOf, localClockLabel, minutesOf } from '../../algorithms/itinerary';
import Button from '../../components/ui/Button';
import Sheet from '../../components/ui/Sheet';
import { COPY } from '../../data/copy';
import { fallbackTo } from '../../data/photos';

const copy = COPY.itin;
const searchKey = (name) => name.toLowerCase().normalize('NFKD').replace(/\p{Mark}/gu, '');
export const visitLabel = (minutes) => [Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} hr` : '', minutes % 60 ? `${minutes % 60} min` : ''].filter(Boolean).join(' ');

function ScopeChoices({ value, addition = false }) {
  return (
    <fieldset className="itinerary-edit__scopes" aria-label={addition ? 'Who is this for?' : copy.scopeTitle}>
      <label><input name="scope" value="personal" type="radio" defaultChecked={value === 'personal'} data-autofocus />
        <span><strong>{addition ? 'For me' : copy.scopePersonal}</strong><small>{copy.scopePersonalNote}</small></span>
      </label>
      <label><input name="scope" value="group" type="radio" defaultChecked={value === 'group'} />
        <span><strong>{addition ? 'For the group' : copy.scopeGroup}</strong><small>{copy.scopeGroupNote}</small></span>
      </label>
    </fieldset>
  );
}

function DurationFields({ minutes, focus = false }) {
  return (
    <fieldset className="itinerary-edit__duration">
      <legend>Time at this stop</legend>
      <div className="itinerary-edit__fields">
        <label className="itinerary-edit__select">Hours<input name="hours" type="number" min="0" max="12" required defaultValue={Math.floor(minutes / 60)} data-autofocus={focus || undefined} /></label>
        <label className="itinerary-edit__select">Minutes<input name="minutes" type="number" min="0" max="59" required defaultValue={minutes % 60} /></label>
      </div>
    </fieldset>
  );
}

function SearchPlaces({ groupId, destination, planned, onSelect }) {
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({});
  useEffect(() => {
    let current = true;
    getItineraryCatalogue(groupId).then(
      (places) => { if (current) setResult({ places }); },
      (error) => { if (current) setResult({ error: error.message }); },
    );
    return () => { current = false; };
  }, [groupId, attempt]);

  const term = searchKey(query).trim();
  const places = result.places ?? [];
  const matched = term ? places.filter(({ name }) => searchKey(name).includes(term))
    : places.filter((place) => place.score > 0 && !planned.has(place.id) && !planned.has(searchKey(place.name).trim()))
      .sort((a, b) => b.score - a.score).slice(0, 6);

  return (
    <div className="itinerary-edit">
      <p className="itinerary__note">{destination}</p>
      <label className="itinerary-edit__select">Place or activity name
        <input type="search" value={query} placeholder="Search places" onChange={(event) => setQuery(event.target.value)} data-autofocus />
      </label>
      <h3>{term ? 'Matching places' : 'You might also like'}</h3>
      {!term && <p className="itinerary__note">Based on your Likes and saved categories.</p>}
      {result.error ? <><p role="alert">{result.error}</p><Button variant="secondary" onClick={() => { setResult({}); setAttempt(attempt + 1); }}>Try again</Button></>
        : !result.places ? <p role="status">Loading places…</p>
          : !matched.length && <p role="status">{term ? 'No matching places.' : 'Search to discover more places in this destination.'}</p>}
      <ul className="itinerary-edit__results" aria-label={term ? 'Search results' : 'Recommended places'}>
        {matched.map((place) => (
          <li key={place.id}>
            {place.thumb && <img src={place.thumb} alt="" referrerPolicy="no-referrer" onError={fallbackTo(place.categoryKey)} />}
            <div><strong>{place.name}</strong><p className="itinerary__note">{[place.area, visitLabel(place.minutes)].filter(Boolean).join(' · ')}</p></div>
            <Button variant="secondary" size="sm" aria-label={`Add ${place.name}`} onClick={() => onSelect(place)}>Add</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const displayClock = (clock) => localClockLabel(minutesOf(clock));

function TimeEditor({ panel, days, busy, error, canUndo, onUndo, onApply, onBack }) {
  const { issue, stop, adjusted, shifts } = panel;
  const [chooseDay, setChooseDay] = useState(false);
  const [start, setStart] = useState(stop?.startTime ?? '');
  useEffect(() => {
    setStart(stop?.startTime ?? '');
    setChooseDay(false);
  }, [panel]);

  const submit = (time, date = issue.date, reorder = false) => onApply({
    type: 'time', id: issue.id, date: issue.date, start: time, targetDate: date, reorder,
    newId: date !== issue.date ? `moved-${crypto.randomUUID()}` : undefined,
  }, undefined, date !== issue.date ? date : undefined);

  return (
    <form className="itinerary-edit" onSubmit={(event) => {
      event.preventDefault();
      submit(start, issue.date, true);
    }}>
      <p id="itinerary-edit-description"><strong>{issue.name}</strong>{stop?.minutes > 0 && <> · {visitLabel(stop.minutes)}</>}</p>
      {stop && <label className="itinerary-edit__select">Start time
        <input type="time" value={start} onChange={(event) => setStart(event.target.value)} required data-autofocus disabled={busy || (stop.fixed || stop.booked)} />
      </label>}
      {adjusted ? <div role="status" className="itinerary-edit__notice">
        <p>Start time updated.</p>
        {shifts?.map(({ id, name, from, to }) => <p key={id}>{name} moves from {displayClock(from)} to {displayClock(to)}.</p>)}
      </div> : issue.reason && <div className="itinerary-edit__warning">
        <p>{issue.reason}</p>
        {issue.suggestedStart && <Button onClick={() => submit(issue.suggestedStart, issue.date, issue.reorder)} disabled={busy}>
          Use {displayClock(issue.suggestedStart)}
        </Button>}
        {!issue.suggestedStart && issue.alternativeDays?.length > 0 && (
          chooseDay ? <label className="itinerary-edit__select">Choose another day
            <select value="" disabled={busy} onChange={(event) => {
              const alternative = issue.alternativeDays.find(({ date }) => date === event.target.value);
              if (alternative) submit(alternative.start, alternative.date);
            }}>
              <option value="">Select a day</option>
              {issue.alternativeDays.map(({ date, start: time }) => {
                const day = days.find((entry) => entry.date === date);
                return <option key={date} value={date}>Day {day.index} · {day.label} · {displayClock(time)}</option>;
              })}
            </select>
          </label> : <Button disabled={busy} onClick={() => setChooseDay(true)}>Choose another day</Button>
        )}
        {!issue.suggestedStart && issue.alternativeDays?.length === 0 && <p>No available slot fits this visit. Try a shorter duration.</p>}
        {!issue.suggestedStart && !issue.alternativeDays?.length && canUndo &&
          <Button variant="secondary" disabled={busy} onClick={() => onUndo(issue)}>Remove this edit</Button>}
      </div>}
      {error && <p role="alert">{error}</p>}
      <div className="itinerary-edit__actions">
        <Button variant="secondary" onClick={onBack} disabled={busy}>{panel.fromReview ? 'Back to review' : 'Back to draft'}</Button>
        {stop && start !== stop.startTime && <Button type="submit" disabled={busy || !start}>Update start time</Button>}
      </div>
    </form>
  );
}

export default function ItineraryEditSheet({ panel, session, data, day, busy, error, onClose, onPanel, onStart, onOperation, onSave, onRecheck, onRebase, onDiscard, onFix, onUndo }) {
  const [validation, setValidation] = useState('');
  const stage = panel.type;
  const scope = session?.scope;
  const title = {
    search: 'Search places', add: 'Add to itinerary', scope: copy.scopeTitle, duration: 'Time at this stop',
    time: 'Fix time', review: 'Review your changes', confirm: 'Save group changes?', discard: 'Discard these edits?',
  }[stage];
  const review = session?.review;
  const unresolved = session?.stale || review?.issues.length || !review?.updates.length;
  const planned = new Set((session?.preview?.days ?? data.days).flatMap(({ items }) => items.filter(({ kind }) => kind === 'place')
    .flatMap((item) => [item.placeId, searchKey(item.name).trim()])));
  const description = stage === 'time' ? panel.issue.name : stage === 'duration' ? panel.stop.name
    : stage === 'confirm' ? 'Everyone will see the shared updates. Existing personal changes will be kept.'
      : stage === 'scope' ? 'This scope applies to the whole editing session.' : '';

  function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    if (stage === 'scope') return onStart(fields.get('scope'));
    const minutes = Number(fields.get('hours')) * 60 + Number(fields.get('minutes'));
    if (!minutes || minutes > 720) return setValidation('Enter a visit time between 1 minute and 12 hours.');
    if (stage === 'duration') return onOperation({
      type: 'duration', id: panel.stop.id, date: day.date, minutes,
    });
    const date = fields.get('day');
    onOperation({
      type: 'add', id: `added-${crypto.randomUUID()}`, placeId: panel.place.id, date, minutes, start: fields.get('start'),
    }, fields.get('scope'), date);
  }

  return (
    <Sheet open onClose={onClose} title={title} titleId="itinerary-edit-title" descriptionId={description ? 'itinerary-edit-description' : undefined}>
      {stage === 'search' && <SearchPlaces groupId={data.group.id} destination={data.group.destination} planned={planned} onSelect={(place) => onPanel({ type: 'add', place })} />}
      {['scope', 'add', 'duration'].includes(stage) && (
        <form className="itinerary-edit" onSubmit={submit}>
          {description && <p className="sheet__text" id="itinerary-edit-description">{description}</p>}
          {stage === 'scope' && <ScopeChoices value="personal" />}
          {stage === 'add' && <>
            <div><h3>{panel.place.name}</h3><p className="itinerary__note">Suggested visit · {visitLabel(panel.place.minutes)}</p></div>
            <div className="itinerary-edit__fields">
              <label className="itinerary-edit__select">Day<select name="day" defaultValue={day.date} data-autofocus>
                {data.days.map((item) => <option key={item.date} value={item.date}>Day {item.index} · {item.label}</option>)}
              </select></label>
              <label className="itinerary-edit__select">Start time<input name="start" type="time" defaultValue="13:30" required /></label>
            </div>
            <DurationFields minutes={panel.place.minutes} />
            {scope ? <p className="itinerary__scope">{scope === 'personal' ? copy.scopePersonal : copy.scopeGroup}</p> : <ScopeChoices value="personal" addition />}
            <p className="itinerary__note">Destination local time. Review before saving.</p>
          </>}
          {stage === 'duration' && <DurationFields minutes={panel.stop.minutes ?? 60} focus />}
          {validation && <p role="alert">{validation}</p>}
          <div className="itinerary-edit__actions">
            <Button variant="secondary" onClick={stage === 'add' ? () => onPanel({ type: 'search' }) : onClose}>Back</Button>
            <Button type="submit">{stage === 'scope' ? 'Start editing' : stage === 'add' ? 'Add to itinerary' : 'Update draft'}</Button>
          </div>
        </form>
      )}
      {stage === 'time' && <TimeEditor panel={panel} days={data.days} busy={busy} error={error}
        canUndo={session?.operations.some(({ id }) => id === panel.issue.id)} onUndo={onUndo}
        onApply={onOperation} onBack={panel.fromReview ? onRecheck : onClose} />}
      {stage === 'review' && (
        <div className="itinerary-edit">
          <p className="itinerary__scope">{scope === 'personal' ? copy.scopePersonal : copy.scopeGroup}</p>
          {busy && <p role="status">Checking the latest plan…</p>}
          {session?.stale && <p role="alert">The itinerary changed during editing. Your draft is still here. Review the stops below before using the latest plan.</p>}
          {session?.stale && review?.conflicts.length > 0 && <ul className="itinerary-edit__review" aria-label="Stops changed since editing began">
            {review.conflicts.map(({ date, name, reason }, index) => <li key={index}><strong>{name} · {date}</strong><p>{reason}</p></li>)}
          </ul>}
          {review?.issues.length > 0 && <ul className="itinerary-edit__review">
            {review.issues.map((issue) => <li key={issue.date + issue.id}><strong>{issue.name} · {issue.date}</strong><p>{issue.reason}</p>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onFix(issue)}>Fix time</Button></li>)}
          </ul>}
          {review?.updates.length > 0 && <ul className="itinerary-edit__review" aria-label="Updated stops">
            {review.updates.map(({ date, id, previous, next, travelBefore }) => (
              <li key={date + id}><strong>{next?.name ?? previous.name}</strong>
                <p className="itinerary__note">{data.days.find((day) => day.date === date)?.label} · {next ? `${next.startTime ?? clockOf(next.start)}–${next.endTime ?? clockOf(next.end)} · ${visitLabel(next.minutes)}` : 'Removed'}</p>
                {previous?.startTime && <p className="itinerary__note">Previously {previous.startTime}–{previous.endTime}</p>}
                {travelBefore?.minutes > 0 && <p className="itinerary__note">{travelBefore.minutes} min estimated travel from the previous stop</p>}
              </li>
            ))}
          </ul>}
          {review && !review.issues.length && !session.stale && <p className="itinerary__note">{review.updates.length ? 'No schedule conflicts found.' : 'No changes to save.'}</p>}
          {error && <p role="alert">{error}</p>}
          <div className="itinerary-edit__actions">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Back to editing</Button>
            {session?.stale && review && !review.issues.length
              ? <Button onClick={onRebase} disabled={busy}>Use latest plan</Button>
              : !review && error ? <Button onClick={onRecheck} disabled={busy}>Retry review</Button>
                : <Button disabled={busy || Boolean(unresolved)} onClick={scope === 'group' ? () => onPanel({ type: 'confirm' }) : onSave}>Save changes</Button>}
          </div>
        </div>
      )}
      {stage === 'confirm' && <div className="itinerary-edit">
        <p className="sheet__text" id="itinerary-edit-description">{description}</p>
        {error && <p role="alert">{error}</p>}
        <div className="itinerary-edit__actions">
          <Button variant="secondary" onClick={() => onPanel({ type: 'review' })} disabled={busy}>Back to review</Button>
          <Button onClick={onSave} disabled={busy}>{busy ? copy.saving : 'Confirm group changes'}</Button>
        </div>
      </div>}
      {stage === 'discard' && <div className="itinerary-edit">
        <p className="sheet__text">Your saved itinerary will stay as it is.</p>
        <div className="itinerary-edit__actions">
          <Button variant="secondary" onClick={onClose}>Keep editing</Button>
          <Button variant="destructive" onClick={onDiscard}>Discard draft</Button>
        </div>
      </div>}
    </Sheet>
  );
}
