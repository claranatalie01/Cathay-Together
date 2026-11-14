import { useEffect, useRef, useState } from 'react';
import { calendarExportFor } from '../../algorithms/calendarExport';
import { insertCalendarEvents, loadGoogleCalendar, requestCalendarAccess } from '../../api/googleCalendar';
import Button from '../../components/ui/Button';

const clientId = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID?.trim();
const formatTripDates = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

export default function CalendarExport({ itinerary }) {
  const dialog = useRef(null);
  const operation = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const [oauth, setOauth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => () => operation.current?.abort(), []);

  function prepareGoogle() {
    setError('');
    loadGoogleCalendar().then(setOauth, (failure) => setError(failure.message));
  }

  function open() {
    const plan = calendarExportFor(itinerary);
    const dates = formatTripDates.formatRange(new Date(itinerary.days[0].date), new Date(itinerary.days.at(-1).date));
    setSnapshot({ ...plan, dates });
    setResult(null);
    setError('');
    if (clientId && plan.events.length && !oauth) prepareGoogle();
    dialog.current.showModal();
  }

  async function confirm() {
    if (operation.current || !oauth || !snapshot.events.length) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError('');
    try {
      // Start authorisation directly in the click handler so Google can open its pop-up.
      const token = await requestCalendarAccess(oauth, clientId);
      if (controller.signal.aborted) return;
      const outcome = await insertCalendarEvents(snapshot.events, token, controller.signal);
      if (!controller.signal.aborted) setResult(outcome);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const complete = result && !result.remaining;
  const problem = !clientId
    ? 'Google Calendar is not configured for this deployment.'
    : snapshot && !snapshot.events.length
      ? 'There are no activities with scheduled times to export.'
      : '';

  return (
    <div className="itinerary-calendar">
      <Button variant="secondary" className="itinerary-calendar__button" aria-haspopup="dialog" onClick={open}>
        <img src="/assets/ui-calendar-teal.svg" alt="" />
        Add to Google Calendar
      </Button>
      <dialog ref={dialog} className="itinerary-calendar__dialog" aria-labelledby="calendar-export-heading"
        aria-describedby="calendar-export-summary" onCancel={(event) => { if (busy) event.preventDefault(); }}>
        <h2 id="calendar-export-heading">{complete ? 'Calendar export complete' : 'Add to Google Calendar?'}</h2>
        {complete ? (
          <p id="calendar-export-summary" role="status">
            {result.added} {result.added === 1 ? 'event' : 'events'} added to your primary calendar.
            {result.alreadyAdded > 0 && ` Already on your calendar: ${result.alreadyAdded}.`}
          </p>
        ) : (
          <>
            <p id="calendar-export-summary">
              Add your full itinerary for {snapshot?.dates}, including the shared activities you’re following and your personal changes.
              If you replaced an activity, only your choice is added.
            </p>
            {snapshot?.timeZone && (
              <div className="itinerary-calendar__details">
                <strong>{itinerary.group.destination.split(',')[0]} local time</strong>
                <p>One event per scheduled activity, with a location when available.</p>
              </div>
            )}
            <p className="itinerary-calendar__note">This is a one-time export. Google Calendar may ask for permission after you confirm.</p>
          </>
        )}
        {snapshot?.unscheduled > 0 && (
          <p className="itinerary-calendar__note">Activities without a scheduled time are left out ({snapshot.unscheduled}).</p>
        )}
        {problem && <p role="status">{problem}</p>}
        {error && <p role="alert">{error}</p>}
        {result?.remaining > 0 && (
          <p role="alert">{result.remaining} events still need to be added. Try again to finish the export.</p>
        )}
        <div className="itinerary-calendar__actions">
          <Button size="sm" variant="secondary" autoFocus disabled={busy} onClick={() => dialog.current.close()}>
            {complete ? 'Done' : 'Cancel'}
          </Button>
          {!complete && !problem && (
            <Button size="sm" aria-busy={busy} disabled={busy || (!oauth && !error)} onClick={oauth ? confirm : prepareGoogle}>
              {busy ? 'Adding…' : !oauth && !error ? 'Loading…' : error || result ? 'Try again' : 'Add events'}
            </Button>
          )}
        </div>
      </dialog>
    </div>
  );
}
