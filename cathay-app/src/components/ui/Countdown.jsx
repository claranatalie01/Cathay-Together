import { useEffect, useState } from 'react';
import './Countdown.css';

// Minutes and seconds left until `expiresAt` (epoch ms), drawn as a ring. Ticks every second from
// the clock and calls onExpire once at zero. Under `warnBelowSeconds` the ring takes the caution tone.
// Screen readers get a calm text (not every tick); the visible time is hidden from them.
export default function Countdown({ expiresAt, totalSeconds, onExpire, warnBelowSeconds = 300, label = 'Time left to pay' }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  useEffect(() => {
    if (left === 0) onExpire?.();
  }, [left, onExpire]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const warn = left <= warnBelowSeconds;
  const share = `${Math.min(100, (left / totalSeconds) * 100)}%`;
  return (
    <div className={`countdown${warn ? ' is-warning' : ''}`} role="timer" aria-label={`${label}: ${Math.floor(left / 60)} minutes ${left % 60} seconds`}>
      <p className="countdown__label">
        <img src="/assets/ui-clock.svg" alt="" />
        {label}
      </p>
      <div className="countdown__ring" style={{ '--countdown-share': share }} aria-hidden="true">
        <div className="countdown__inner">
          <span className="countdown__time">
            {mm}:{ss}
          </span>
          <span className="countdown__unit">min : sec</span>
        </div>
      </div>
    </div>
  );
}
