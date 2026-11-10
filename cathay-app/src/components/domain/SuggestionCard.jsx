import { useRef, useState } from 'react';
import { COPY } from '../../data/copy';
import './SuggestionCard.css';

const SWIPE_DISTANCE = 80; // px of horizontal drag that counts as a choice

// One itinerary suggestion (prototype): photo with category tag, name and area, description,
// budget and timing, a tip. Drag it left to pass or right to like; `choice` shows the stamp.
// Dragging is a shortcut only: the Pass and Like buttons beside it do the same for keyboard users.
export default function SuggestionCard({ place, choice, onChoose }) {
  const copy = COPY.prefs;
  const start = useRef(null);
  const distanceRef = useRef(0);
  const [drag, setDrag] = useState(0);

  const down = (event) => {
    start.current = event.clientX;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const move = (event) => {
    if (start.current === null) return;
    distanceRef.current = event.clientX - start.current;
    setDrag(distanceRef.current);
  };
  const up = () => {
    const distance = distanceRef.current;
    start.current = null;
    distanceRef.current = 0;
    setDrag(0);
    if (distance >= SWIPE_DISTANCE) onChoose('like');
    else if (distance <= -SWIPE_DISTANCE) onChoose('pass');
  };

  return (
    <article
      className="suggestion"
      style={{ transform: drag ? `translateX(${drag}px) rotate(${drag / 40}deg)` : undefined }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className="suggestion__photo">
        <img src={place.photo} alt={place.alt} draggable="false" />
        <span className="suggestion__tag">{place.category}</span>
        {choice && (
          <span className={`suggestion__stamp suggestion__stamp--${choice}`}>
            <img src={choice === 'like' ? '/assets/5c16d.svg' : '/assets/9a5a4.svg'} alt="" />
            {choice === 'like' ? copy.liked : copy.passed}
          </span>
        )}
      </div>
      <div className="suggestion__body">
        <h2 className="suggestion__name">{place.name}</h2>
        <p className="suggestion__area">
          <img src="/assets/c9562.svg" alt="" />
          {place.area}
        </p>
        <p className="suggestion__text">{place.description}</p>
        <dl className="suggestion__facts">
          <div>
            <dt>{copy.budget}</dt>
            <dd className="is-brand">{place.budget}</dd>
          </div>
          <div>
            <dt>{copy.durationBest}</dt>
            <dd>
              {place.duration} · {place.bestTime}
            </dd>
          </div>
        </dl>
        <p className="suggestion__tip">{place.tip}</p>
      </div>
    </article>
  );
}
