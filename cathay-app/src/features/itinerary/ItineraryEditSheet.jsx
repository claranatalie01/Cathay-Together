import { useEffect, useRef } from 'react';
import Button from '../../components/ui/Button';
import Sheet from '../../components/ui/Sheet';
import { COPY } from '../../data/copy';

const copy = COPY.itin;

export default function ItineraryEditSheet({ edit, setEdit, onClose, onSave, busy, error }) {
  const description = useRef(null);
  const stage = edit?.stage;
  useEffect(() => {
    if (stage === 'confirm') description.current?.focus();
  }, [stage]);

  if (!edit) return null;
  const { stop, day, places, scope, change, shared } = edit;
  const selected = places.find(({ id }) => id === edit.placeId);
  const title = {
    activity: copy.editStop(stop.name),
    scope: copy.scopeTitle,
    confirm: copy.groupConfirm,
  }[stage];
  const currentName = stage === 'confirm' ? shared.name : stop.name;
  const details = change?.type === 'replace'
    ? copy.replacementSummary(currentName, selected.name, day.index)
    : copy.changeSummary(currentName, day.index);

  function continueEdit(event) {
    event.preventDefault();
    if (busy) return;
    if (stage === 'activity' && selected) {
      setEdit({ ...edit, stage: 'scope', change: { type: 'replace', placeId: selected.id } });
    }
    if (stage === 'scope' && scope === 'personal') void onSave();
    if (stage === 'scope' && scope === 'group' && shared) setEdit({ ...edit, stage: 'confirm' });
    if (stage === 'confirm') void onSave();
  }

  return (
    <Sheet open onClose={onClose} title={title} titleId="itinerary-edit-title" descriptionId="itinerary-edit-description">
      <form className="itinerary-edit" onSubmit={continueEdit}>
        <p id="itinerary-edit-description" className="sheet__text" tabIndex={-1} ref={description}>
          {stage === 'activity' ? copy.chooseActivity : details}
        </p>
        {stage === 'activity' && (
          <label className="itinerary-edit__select">
            {copy.replacement}
            <select value={edit.placeId ?? ''} onChange={(event) => setEdit({ ...edit, placeId: event.target.value })} data-autofocus>
              <option value="">{copy.chooseActivity}</option>
              {places.map((place) => <option key={place.id} value={place.id}>{place.name}{place.area ? ` · ${place.area}` : ''}</option>)}
            </select>
          </label>
        )}
        {stage === 'scope' && (
          <fieldset className="itinerary-edit__scopes" aria-label={copy.scopeTitle} disabled={busy}>
            <label>
              <input type="radio" name="edit-scope" value="personal" checked={scope === 'personal'} onChange={() => setEdit({ ...edit, scope: 'personal' })} data-autofocus />
              <span><strong>{copy.scopePersonal}</strong><small>{copy.scopePersonalNote}</small></span>
            </label>
            <label>
              <input type="radio" name="edit-scope" value="group" checked={scope === 'group'} onChange={() => setEdit({ ...edit, scope: 'group' })} disabled={!shared} />
              <span><strong>{copy.scopeGroup}</strong><small>{shared ? copy.scopeGroupNote : copy.scopeGroupUnavailable}</small></span>
            </label>
          </fieldset>
        )}
        {stage === 'confirm' && <p className="sheet__text">{copy.groupConfirmNote}</p>}
        {error && <p className="sheet__text" role="alert">{error}</p>}
        <div className="itinerary-edit__actions">
          <Button variant="secondary" onClick={onClose} disabled={busy}>{copy.cancel}</Button>
          <Button type="submit" disabled={busy || (stage === 'activity' && !selected) || (stage === 'scope' && !scope)}>
            {busy ? copy.saving : stage === 'confirm' ? copy.confirmGroupChange : copy.continueEdit}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
