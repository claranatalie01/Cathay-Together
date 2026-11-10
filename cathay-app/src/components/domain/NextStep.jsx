import { COPY } from '../../data/copy';
import './NextStep.css';

// "Next step · 2 of 4": the one thing to do now on Group details, with a four-step tracker
// (Flight, Pay, Preferences, Itinerary). `step` is calculated from the member's own progress.
export default function NextStep({ step, children, className = '' }) {
  const copy = COPY.nextStep;
  return (
    <aside className={`next-step ${className}`.trim()} aria-label={copy.eyebrow(step)}>
      <p className="next-step__eyebrow">{copy.eyebrow(step)}</p>
      <ol className="next-step__tracker" aria-label={`${copy.stepOf(step)}: ${copy.steps[step - 1]}`}>
        {copy.steps.map((label, index) => (
          <li
            className={`next-step__step${index < step ? ' is-done' : ''}${index === step - 1 ? ' is-current' : ''}`}
            aria-current={index === step - 1 ? 'step' : undefined}
            key={label}
          >
            <span className="next-step__bar" aria-hidden="true" />
            <span className="next-step__label">{label}</span>
          </li>
        ))}
      </ol>
      {children}
    </aside>
  );
}
