import { useEffect, useRef } from 'react';

const HOLD_MS = 400;
const MOVE_THRESHOLD = 9;

export function useStopReorder(resetKey, onMove) {
  const press = useRef(null);

  function clearPress() {
    const active = press.current;
    if (!active) return;
    press.current = null;
    clearTimeout(active.timer);
    active.card.removeAttribute('data-dragging');
    active.card.style.removeProperty('--stop-drag-y');
    active.target?.removeAttribute('data-drop-target');
    active.card.removeEventListener('touchmove', active.stopScroll);
  }

  useEffect(() => clearPress, [resetKey]);

  return {
    onPointerDown(event) {
      if (!event.isPrimary || event.button !== 0 || event.target.closest('button, a, input')) return;
      clearPress();
      const card = event.currentTarget;
      const id = event.pointerId;
      const active = {
        card, id, x: event.clientX, y: event.clientY, held: false,
        stopScroll: (touch) => { if (press.current?.held && touch.cancelable) touch.preventDefault(); },
      };
      press.current = active;
      card.addEventListener('touchmove', active.stopScroll, { passive: false });
      active.timer = setTimeout(() => {
        if (!card.isConnected) return clearPress();
        active.held = true;
        card.dataset.dragging = '';
        card.style.setProperty('--stop-drag-y', '0px');
        card.setPointerCapture(id);
      }, HOLD_MS);
    },
    onPointerMove(event) {
      const active = press.current;
      if (active?.id !== event.pointerId) return;
      if (!active.held) {
        if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > MOVE_THRESHOLD) clearPress();
        return;
      }
      const list = active.card.closest('ol');
      active.card.style.setProperty('--stop-drag-y', `${event.clientY - active.y}px`);
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-edit-stop]');
      active.target?.removeAttribute('data-drop-target');
      active.target = target && list?.contains(target) && target !== active.card.closest('li') ? target : null;
      if (active.target) active.target.dataset.dropTarget = '';
    },
    onPointerUp(event) {
      const active = press.current;
      if (active?.id !== event.pointerId) return;
      const id = active.card.closest('li').dataset.editStop;
      const target = active.target?.dataset.editStop;
      clearPress();
      if (target) onMove(id, target);
    },
    onPointerCancel: clearPress,
    onPointerLeave(event) {
      if (!press.current?.held && event.pointerType !== 'touch') clearPress();
    },
    onLostPointerCapture: clearPress,
    onContextMenu(event) {
      if (press.current) event.preventDefault();
    },
  };
}
