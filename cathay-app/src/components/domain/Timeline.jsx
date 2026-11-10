import './Timeline.css';

// Two hourly scales side by side (arrivals and departures). Each column has a vertical axis with
// hour labels, one marker per time (members who share a time share a marker), a band between the
// first and last marker, and a "Span" summary. Positions come from the times, never from fixed offsets.
// A column is { id, title, dateLabel, icon, tone: 'arrive' | 'depart', points: [{ time, minutes, names, includesViewer }], spanLabel }.
const MIN_GAP_PX = 30; // closest two markers stay at least this far apart
const MIN_HEIGHT_PX = 168;
const MAX_HEIGHT_PX = 480;

function scaleOf(points) {
  const minutes = points.map((p) => p.minutes);
  const start = Math.floor(Math.min(...minutes) / 60) * 60;
  let end = Math.ceil(Math.max(...minutes) / 60) * 60;
  if (end === start) end = start + 60;
  let closest = Infinity;
  for (let i = 1; i < minutes.length; i += 1) closest = Math.min(closest, minutes[i] - minutes[i - 1]);
  const perMinute = Math.max(MIN_HEIGHT_PX / (end - start), Number.isFinite(closest) ? MIN_GAP_PX / closest : 0);
  const height = Math.min(MAX_HEIGHT_PX, Math.round((end - start) * perMinute));
  const hours = [];
  for (let m = start; m <= end; m += 60) hours.push(m);
  return { start, end, height, hours };
}

const clock = (minutes) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

function Column({ column }) {
  const { points } = column;
  const scale = points.length ? scaleOf(points) : null;
  const at = (minutes) => `${((minutes - scale.start) / (scale.end - scale.start)) * 100}%`;
  return (
    <section className={`timeline__column timeline__column--${column.tone}`} aria-label={`${column.title}, ${column.dateLabel ?? ''}`}>
      <h3 className="timeline__title">
        <img src={column.icon} alt="" />
        {column.title}
      </h3>
      <p className="timeline__date">{column.dateLabel}</p>
      {scale ? (
        <>
          <div className="timeline__axis" style={{ height: scale.height }}>
            {scale.hours.map((minutes) => (
              <span className="timeline__hour" style={{ top: at(minutes) }} key={minutes}>
                {clock(minutes)}
              </span>
            ))}
            {points.length > 1 && (
              <span
                className="timeline__band"
                style={{ top: at(points[0].minutes), height: `${((points[points.length - 1].minutes - points[0].minutes) / (scale.end - scale.start)) * 100}%` }}
              />
            )}
            {points.map((point) => (
              <span className={`timeline__marker${point.includesViewer ? ' is-you' : ''}`} style={{ top: at(point.minutes) }} key={point.time}>
                <span className="timeline__dot" />
                <span className="timeline__label">
                  <strong>{point.time}</strong> {point.names.join(', ')}
                </span>
              </span>
            ))}
          </div>
          {column.spanLabel && (
            <p className="timeline__span">
              <img src={column.tone === 'arrive' ? '/assets/ui-arrows-teal.svg' : '/assets/ui-arrows-steel.svg'} alt="" />
              Span {column.spanLabel}
            </p>
          )}
        </>
      ) : (
        <p className="timeline__empty">No flights picked yet.</p>
      )}
    </section>
  );
}

export default function Timeline({ columns, legend }) {
  return (
    <div className="timeline">
      <div className="timeline__columns">
        {columns.map((column) => (
          <Column column={column} key={column.id} />
        ))}
      </div>
      {legend && (
        <p className="timeline__legend">
          <span className="timeline__legend-dot" aria-hidden="true" />
          {legend}
        </p>
      )}
    </div>
  );
}
