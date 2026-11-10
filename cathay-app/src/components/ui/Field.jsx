import './Field.css';

// Labelled form field in the design's bordered style. `children` is the control
// (input or select); it must use the same `id` and the `field__text` class.
// Errors are announced and linked with aria-describedby.
// `valueClassName` and `disabled` exist for the style guide's state specimens.
export default function Field({ id, label, error, icon, disclosure, disabled = false, valueClassName = '', children }) {
  return (
    <div className={`field${error ? ' field--invalid' : ''}${disabled ? ' field--disabled' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className={`field__value ${valueClassName}`.trim()}>
        {icon && <img className="field__icon" src={icon} alt="" />}
        {children}
        {disclosure && (
          <span className="field__disclosure" aria-hidden="true">
            {disclosure}
          </span>
        )}
      </div>
      {error && (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
