import './ChoicePill.css';

// Pass / Like pill (prototype): icon, arrow and label. `selected` shows the chosen state.
export default function ChoicePill({ tone, selected, icon, children, ...rest }) {
  return (
    <button className={`choice choice--${tone}${selected ? ' is-selected' : ''}`} type="button" aria-pressed={selected} {...rest}>
      <img className="choice__icon" src={icon} alt="" />
      {children}
    </button>
  );
}
