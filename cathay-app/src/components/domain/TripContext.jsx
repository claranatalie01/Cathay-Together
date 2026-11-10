import './TripContext.css';

// Photo, destination, dates and a one-line status for the current group.
// `meta` ([{ icon, text }]) replaces the dates and status lines with one icon line (the group board).
export default function TripContext({ photo, title, dates, status, meta }) {
  return (
    <div className="trip-context">
      <div className="trip-context__photo">
        <img src={photo.src} alt={photo.alt} />
      </div>
      <div className="trip-context__info">
        <p className="trip-context__title">{title}</p>
        {meta ? (
          <p className="trip-context__meta">
            {meta.map((item) => (
              <span key={item.text}>
                <img src={item.icon} alt="" />
                {item.text}
              </span>
            ))}
          </p>
        ) : (
          <>
            <p className="trip-context__dates">{dates}</p>
            <p className="trip-context__status">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
