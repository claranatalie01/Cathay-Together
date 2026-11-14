import { useCallback, useRef, useState } from 'react';
import { reviewItinerary, saveItinerary } from '../../api';

function versions(data) {
  return { group: data.groupRevision, personal: data.personalRevision, people: data.personalRevisions };
}

function isStale(scope, before, after) {
  if (before.group !== after.group || (scope === 'personal' && before.personal !== after.personal)) return true;
  return scope === 'group' && Object.keys({ ...before.people, ...after.people })
    .some((id) => before.people?.[id] !== after.people?.[id]);
}

export function useItineraryDraft(groupId, data, toast) {
  const [panel, setPanel] = useState(null);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef(null);

  const closePanel = useCallback(() => {
    if (!operation.current) setPanel(null);
  }, []);

  function openPanel(next) {
    setError('');
    setPanel(next);
  }

  function start(scope) {
    setSession({ scope, operations: [], base: versions(data) });
    closePanel();
  }

  async function calculate(next, final, timePanel = null) {
    if (operation.current) return;
    operation.current = true;
    setSession(next);
    setBusy(true);
    setError('');
    try {
      const result = await reviewItinerary(groupId, { scope: next.scope, operations: next.operations });
      const stale = isStale(next.scope, next.base, result.revisions);
      setSession({
        ...next, stale, preview: result, review: final ? result : null,
        lastValidDays: result.issues.length ? next.lastValidDays : result.days,
      });
      if (timePanel) {
        const { id, date } = timePanel.issue;
        const op = next.operations.at(-1);
        const targetDate = op?.targetDate ?? date;
        const targetId = op?.newId ?? id;
        const before = new Map((next.lastValidDays ?? data.days).flatMap(({ date: day, items }) => items.map((item) => [item.id, { ...item, date: day }])));
        const after = result.days.find(({ date: day }) => day === targetDate)?.items.find((item) => item.id === targetId);
        const shifts = result.days.flatMap(({ date: day, items }) => items.flatMap((item) => {
          const old = before.get(item.id);
          return item.id !== targetId && old?.date === day && old.startTime && item.startTime && old.startTime !== item.startTime
            ? [{ id: item.id, name: item.name, from: old.startTime, to: item.startTime }] : [];
        }));
        const issue = result.issues.find((entry) => entry.id === targetId && entry.date === targetDate);
        setPanel({ ...timePanel, stop: after, issue: issue ?? { id: targetId, name: timePanel.issue.name, date: targetDate }, shifts, adjusted: !issue });
      } else if (!final && next.operations.at(-1)?.type === 'add') {
        const { id, date } = next.operations.at(-1);
        const issue = result.issues.find((entry) => entry.id === id && entry.date === date);
        const stop = result.days.find((entry) => entry.date === date)?.items.find((item) => item.id === id);
        if (issue) setPanel({ type: 'time', issue, stop });
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      operation.current = null;
      setBusy(false);
    }
  }

  function apply(op, scope, timePanel) {
    if (operation.current) return;
    const next = session ?? { scope, operations: [], base: versions(data) };
    const baseline = next.scope === 'group' ? data.sharedActivityDays ?? data.days : data.days;
    const original = baseline.find(({ date }) => date === op.date)?.items.find(({ id }) => id === op.id);
    const expected = next.operations.find(({ id }) => id === op.id)?.expected ?? (original && {
      name: original.name, placeId: original.placeId, minutes: original.minutes,
      startTime: original.startTime, endTime: original.endTime,
    });
    if (!timePanel) closePanel();
    return calculate({ ...next, operations: [...next.operations, { ...op, expected }], review: null }, false, timePanel);
  }

  function recheck(next = session) {
    openPanel({ type: 'review' });
    return calculate({ ...next, review: null }, true);
  }

  function rebase() {
    recheck({ ...session, base: session.review.revisions, stale: false });
  }

  async function save() {
    if (operation.current || !session.review || session.stale || session.review.issues.length) return;
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      await saveItinerary(groupId, {
        scope: session.scope, operations: session.operations, revisions: session.review.revisions,
      });
      setSession(null);
      setPanel(null);
      toast(session.scope === 'personal' ? 'Your itinerary was updated.' : 'Group itinerary updated.');
    } catch (failure) {
      if (failure.code === 'itinerary_changed' || failure.code === 'invalid_edit') {
        operation.current = null;
        await recheck({ ...session, review: null });
        return;
      }
      setError(failure.message);
    } finally {
      operation.current = null;
      setBusy(false);
    }
  }

  function discard() {
    setSession(null);
    closePanel();
  }

  function undo(issue) {
    const operations = session.operations.filter((op) => op.id !== issue.id);
    if (operations.length === session.operations.length) return;
    return recheck({ ...session, operations, review: null });
  }

  return { panel, session, busy, error, closePanel, openPanel, start, apply, recheck, rebase, save, discard, undo };
}
