import { useEffect, useRef } from 'react';
import './Sheet.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Bottom sheet dialog over a dimmed page. Closes with Escape, the × button or a
// tap on the dimmed area; keeps keyboard focus inside while open and returns it
// to the control that opened it. Render it as a direct child of <Screen>.
export default function Sheet({ open, onClose, title, titleId, descriptionId, className = '', children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const node = ref.current;
    node?.querySelector('[data-autofocus]')?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      } else if (event.key === 'Tab' && node) {
        const items = [...node.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && opener.isConnected) opener.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className={`sheet ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} ref={ref}>
        <div className="sheet__handle">
          <span className="sheet__handle-bar" />
        </div>
        <div className="sheet__heading">
          <h2 className="sheet__title" id={titleId}>
            {title}
          </h2>
          <button className="sheet__close" type="button" onClick={onClose} aria-label="Close">
            <img src="/assets/ui-close.svg" alt="" />
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}
