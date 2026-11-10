import { useEffect, useRef } from 'react';
import './Dialog.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Centred alert dialog over a dimmed page, for a decision that must be made (not dismissed by
// tapping outside). Escape calls onClose when given. Keeps focus inside and returns it afterwards.
export default function Dialog({ open, onClose, title, titleId, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const node = ref.current;
    node?.querySelector('[data-autofocus]')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape' && onClose) {
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
    <div className="dialog__scrim">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <h2 className="dialog__title" id={titleId}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
