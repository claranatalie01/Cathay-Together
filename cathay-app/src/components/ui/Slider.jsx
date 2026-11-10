import './Slider.css';

// Labelled range input with a value read-out ("Group timing window ... Within 1 hour") and a
// helper line. A real <input type="range">, so arrow keys, Home and End work natively.
export default function Slider({ id, label, valueText, help, min, max, step = 1, value, onChange }) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div className="slider">
      <div className="slider__head">
        <label className="slider__label" htmlFor={id}>
          {label}
        </label>
        <output className="slider__value" htmlFor={id}>
          {valueText}
        </output>
      </div>
      <input
        className="slider__input"
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--slider-fill': fill }}
        aria-valuetext={valueText}
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {help && (
        <p className="slider__help" id={`${id}-help`}>
          {help}
        </p>
      )}
    </div>
  );
}
