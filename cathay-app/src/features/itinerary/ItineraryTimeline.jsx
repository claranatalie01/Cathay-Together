import { clockOf } from '../../algorithms/itinerary';
import { COPY } from '../../data/copy';

const copy = COPY.itin;
const tones = ['steel', 'peach', 'violet', 'sand', 'blue', 'green', 'rose'];
const HOUR = 60;
const PIXELS_PER_MINUTE = 0.95;

function Time({ minutes, hourly = false, separator = '' }) {
  const clock = clockOf(minutes);
  const hour = Number(clock.slice(0, 2));
  return (
    <time dateTime={clock}>
      <span>{hour % 12 || 12}{!hourly && clock.slice(2)}</span> <span>{hour < 12 ? 'AM' : 'PM'}{separator}</span>
    </time>
  );
}

function Activity({ event, rowFor }) {
  const { start, end, skipped, name } = event;
  return (
    <div className="itinerary-timeline__block" data-skipped={skipped || undefined}
      style={{ gridRow: `${rowFor.get(start)} / ${rowFor.get(Math.max(end, start + 1))}` }}>
      <div className="itinerary-timeline__range">
        <Time minutes={start} separator={end > start ? '–' : ''} />{end > start && <><wbr /><Time minutes={end} /></>}
      </div>
      <strong>{skipped ? copy.skippedStop(name) : name}</strong>
    </div>
  );
}

function EventTracks({ groupStops, members, selected }) {
  const events = [...groupStops, ...members.flatMap((member) => member.events)];
  const endpoints = events.flatMap(({ start, end }) => [start, Math.max(end, start + 1)]);
  const first = Math.floor(Math.min(...endpoints) / HOUR) * HOUR;
  const last = Math.ceil(Math.max(...endpoints) / HOUR) * HOUR;
  const hours = Array.from({ length: (last - first) / HOUR + 1 }, (_, index) => first + index * HOUR);
  const times = [...new Set([...endpoints, ...hours])].sort((a, b) => a - b);
  const rowFor = new Map(times.map((minute, index) => [minute, index + 1]));
  const trackRows = times.slice(0, -1).map((minute, index) => {
    // Let a short slot grow when its clock labels or activity name wrap.
    return `minmax(${(times[index + 1] - minute) * PIXELS_PER_MINUTE}px, auto)`;
  }).join(' ');

  // Keep the group centred and reserve the same columns for each traveller on every day.
  const left = members.filter((_, index) => index % 3 === 0);
  const right = members.filter((_, index) => index % 3 !== 0);
  const extra = Math.max(left.length - 1, right.length - 2, 0) * 17;
  const span = 100 + extra * 2;
  const at = (value) => `${((value + extra) / span) * 100}%`;
  const width = (from, to) => `${((to - from) / span) * 100}%`;
  const lanes = [
    ...left.map((member, index) => {
      const from = 34 - 17 * (left.length - index);
      const to = 33 - 17 * (left.length - index - 1);
      return { ...member, from, to, besideClock: index === 0 };
    }),
    { id: null, name: copy.groupPlan, events: groupStops, from: 34, to: 66 },
    ...right.map((member, index) => ({
      ...member, from: 67 + 17 * index, to: 83 + 17 * index,
    })),
  ];

  return (
    <div className="itinerary-timeline__scroll">
      <div className="itinerary-timeline__canvas" style={{ width: `${span}%` }}>
        <div className="itinerary-timeline__tracks" style={{ gridTemplateRows: `${trackRows} 0px` }}>
          <div className="itinerary-timeline__clock" aria-hidden="true">
            {hours.map((hour) => <div key={hour} style={{ gridRow: rowFor.get(hour) }}><Time minutes={hour} hourly /></div>)}
          </div>
          {lanes.filter(({ id, events }) => id === null || events.length)
            .map(({ id, name, tone, events, from, to, besideClock }) => (
              <section className="itinerary-timeline__track" aria-label={name} data-tone={tone} key={id ?? 'group'}
                data-filtered-out={id && selected && selected.id !== id ? '' : undefined}
                style={{
                  left: besideClock ? 'var(--timeline-clock-width)' : at(from),
                  width: besideClock ? `calc(${at(to)} - var(--timeline-clock-width))` : width(from, to),
                }}>
                <h3 className="itinerary-timeline__heading">{name}</h3>
                {events.map((event) => <Activity event={event} rowFor={rowFor} key={event.id} />)}
              </section>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function ItineraryTimeline({ data, filter, onFilter }) {
  const groupStops = [...data.groupStops].sort((a, b) => a.start - b.start);
  const members = data.members.map((member, index) => ({ ...member, tone: tones[index % tones.length] }));
  const selected = members.find(({ id }) => id === filter);
  const untimed = (selected ? [selected] : members).filter((member) => member.untimed.length);
  const hasTimedStops = groupStops.length > 0 || members.some(({ events }) => events.length > 0);

  return (
    <div className="itinerary-timeline">
      {hasTimedStops ? <EventTracks groupStops={groupStops} members={members} selected={selected} />
        : <h3 className="itinerary-timeline__heading itinerary-timeline__heading--empty">{copy.groupPlan}</h3>}
      {data.untimed.length > 0 && (
        <ul className="itinerary-timeline__untimed">
          {data.untimed.map((item, index) => <li key={index}>{item} · {copy.timeUnknown}</li>)}
        </ul>
      )}
      {untimed.map((member) => (
        <ul className="itinerary-timeline__untimed" key={member.id}>
          {!member.events.length && <li><strong>{member.name}</strong></li>}
          {member.untimed.map(({ name, skipped }, index) => <li key={index}>{skipped ? copy.skippedStop(name) : name} · {copy.timeUnknown}</li>)}
        </ul>
      ))}
      {!groupStops.length && !data.untimed.length && <p className="itinerary__note">{copy.noTimelineStops}</p>}
      {selected && !selected.events.length && !selected.untimed.length && (
        <p className="itinerary-timeline__empty-filter" role="status">{copy.noTimelineChanges(selected.name)}</p>
      )}
      {members.length > 0 && (
        <div className="itinerary-timeline__filters" role="group" aria-label={copy.timelineFilters}>
          {[{ id: null, name: copy.timelineEveryone }, ...members].map(({ id, name }) => (
            <button type="button" key={id ?? 'everyone'} aria-pressed={(selected?.id ?? null) === id}
              onClick={() => onFilter(id)}><span>{name}</span></button>
          ))}
        </div>
      )}
    </div>
  );
}
