import { useRef } from 'react';
import './Tabs.css';

// Text tabs with a 3 dp indicator under the active one (real app: Return / One way,
// date tabs, Economy / Premium Economy). Roving tabindex; Left, Right, Home and End
// move the selection. A tab with `disabled` stays visible but cannot be chosen
// (the real app shows "Not available" in plain grey text).
// tone: 'brand' (mid-teal, Book and Results) or 'deep' (deep teal, fare screens).
export default function Tabs({ tabs, value, onChange, label, tone = 'brand', scroll = false, panelId, className = '' }) {
  const refs = useRef({});
  const enabled = tabs.filter((tab) => !tab.disabled);

  const move = (event) => {
    const keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const index = enabled.findIndex((tab) => tab.id === value);
    const step = keys[event.key];
    const next =
      step === 'first' ? enabled[0] : step === 'last' ? enabled[enabled.length - 1] : enabled[(index + step + enabled.length) % enabled.length];
    if (next) {
      onChange(next.id);
      refs.current[next.id]?.focus();
    }
  };

  return (
    <div
      className={`tabs tabs--${tone}${scroll ? ' tabs--scroll' : ''} ${className}`.trim()}
      role="tablist"
      aria-label={label}
      onKeyDown={move}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            className={`tab${selected ? ' is-selected' : ''}${tab.disabled ? ' is-unavailable' : ''}`}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={panelId}
            aria-disabled={tab.disabled || undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => !tab.disabled && onChange(tab.id)}
          >
            <span className="tab__text">
              <span className="tab__label">{tab.label}</span>
              {tab.sub && <span className="tab__sub">{tab.sub}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
