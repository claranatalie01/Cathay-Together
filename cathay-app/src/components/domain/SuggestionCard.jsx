import { useRef, useState } from 'react';
import { COPY } from '../../data/copy';
import { fallbackTo } from '../../data/photos';
import './SuggestionCard.css';

const SWIPE_DISTANCE = 80; // px of horizontal drag that counts as a choice

// Swipe horizontally to choose. Vertical scrolling cancels the gesture.
export default function SuggestionCard({ place, choice, onChoose, describedBy }) {
  const copy = COPY.prefs;
  const gesture = useRef(null);
  const submitting = useRef(false);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(null);

  const down = (event) => {
    if (!event.isPrimary || event.button !== 0 || submitting.current) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const move = (event) => {
    const start = gesture.current;
    if (start?.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    setDrag(Math.abs(dx) > Math.abs(dy) ? dx : 0);
  };
  const choose = async (next, card, byKeyboard = false) => {
    if (submitting.current) return;
    submitting.current = true;
    setLeaving(next);
    const exit = matchMedia('(prefers-reduced-motion: reduce)').matches ? null : card.animate(
      [{ transform: getComputedStyle(card).transform },
        { transform: `translateX(${next === 'like' ? 110 : -110}%) rotate(${next === 'like' ? 12 : -12}deg)` }],
      { duration: 175, easing: 'ease-in', fill: 'forwards' },
    );
    try {
      await onChoose(next, exit?.finished.catch(() => {}), byKeyboard);
    } finally {
      exit?.cancel();
      setLeaving(null);
      setDrag(0);
      submitting.current = false;
    }
  };
  const end = (event) => {
    const start = gesture.current;
    if (start?.id !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (event.type === 'pointerup' && Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
      void choose(dx > 0 ? 'like' : 'pass', event.currentTarget);
    } else {
      setDrag(0);
    }
  };
  const keyDown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (event.repeat || gesture.current) return;
    void choose(event.key === 'ArrowRight' ? 'like' : 'pass', event.currentTarget, true);
  };
  const feedback = leaving ?? (dragging && Math.abs(drag) >= 12 ? (drag > 0 ? 'like' : 'pass') : null);
  const stamp = feedback ?? choice;

  return (
    <article
      className={`suggestion${dragging ? ' suggestion--dragging' : ''}`}
      tabIndex={0}
      aria-label={place.name}
      aria-describedby={describedBy}
      aria-busy={Boolean(leaving)}
      style={{ transform: drag ? `translateX(${drag}px) rotate(${Math.max(-12, Math.min(12, drag / 18))}deg)` : undefined }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={keyDown}
    >
      <div className="suggestion__photo">
        <img src={place.photo} alt={place.alt} draggable="false" referrerPolicy="no-referrer" onError={fallbackTo(place.category_key)} />
        <span className="suggestion__tag">{place.category}</span>
        {stamp && (
          <span className={`suggestion__stamp suggestion__stamp--${stamp}${feedback ? ' suggestion__stamp--swiping' : ''}`} aria-hidden={Boolean(feedback)}>
            <img src={stamp === 'like' ? '/assets/5c16d.svg' : '/assets/9a5a4.svg'} alt="" />
            {feedback ? (stamp === 'like' ? copy.like : copy.pass) : (stamp === 'like' ? copy.liked : copy.passed)}
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
