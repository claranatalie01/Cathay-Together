import './SegmentedControl.css';

// Cabin picker (Economy / Premium Economy +HKD / Business +HKD). Real radio inputs, so
// arrow keys and the group label work natively. The selected segment has the teal gradient.
// An option may carry `icon` (and `iconSelected` for the white-on-teal state), as on the board's List / Timeline toggle.
export default function SegmentedControl({ name, label, options, value, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label className={`segmented__option segmented__option--${option.id}${option.id === value ? ' is-selected' : ''}`} key={option.id}>
          <input
            className="sr-only"
            type="radio"
            name={name}
            value={option.id}
            checked={option.id === value}
            onChange={() => onChange(option.id)}
          />
          <span className="segmented__main">
            {option.icon && <img className="segmented__icon" src={option.id === value ? option.iconSelected ?? option.icon : option.icon} alt="" />}
            <span className="segmented__label">{option.label}</span>
          </span>
          {option.sub && <span className="segmented__sub">{option.sub}</span>}
        </label>
      ))}
    </div>
  );
}
