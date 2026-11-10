import './StepProgress.css';

// "TOKYO · YOUR PICKS ... 1 of 4" with one segment per step (prototype). Reads as text, not as a control.
export default function StepProgress({ label, current, total, stepText }) {
  return (
    <div className="steps" aria-label={`${label}, ${stepText}`}>
      <div className="steps__head" aria-hidden="true">
        <span className="steps__label">{label}</span>
        <span className="steps__count">{stepText}</span>
      </div>
      <div className="steps__bar" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span className={`steps__seg${i < current ? ' is-on' : ''}`} key={i} />
        ))}
      </div>
    </div>
  );
}
