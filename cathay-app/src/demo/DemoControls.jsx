import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onDataChanged } from '../api';
import {
  addFriend,
  friendsPickAndBook,
  listPersonas,
  readSnapshot,
  resetDemo,
  setFailNext,
  setViewer,
} from './demoApi';
import { useDemoVisibility } from './useDemoVisibility';
import './DemoControls.css';

function useSnapshot() {
  const [snapshot, setSnapshot] = useState(readSnapshot);
  useEffect(() => onDataChanged(() => setSnapshot(readSnapshot())), []);
  return [snapshot, () => setSnapshot(readSnapshot())];
}

// Panel for simulating the other people in a group. Not part of the product:
// it is outlined and tagged "Demo only", and can be hidden.
//   context: 'members' | 'groups' | 'invite'
//   group:   the API group being shown (members / invite pages)
//   inviteCode: the invite code in the URL (invite page, even if the group failed to load)
export function DemoControls({ context, group, inviteCode }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useDemoVisibility();
  const [snapshot, refresh] = useSnapshot();
  const personas = listPersonas();

  if (!visible) {
    return (
      <div className="demo-toggle">
        <button className="demo-toggle__button" type="button" onClick={() => setVisible(true)}>
          Show demo controls
        </button>
      </div>
    );
  }

  const code = inviteCode ?? group?.code;
  const stored = snapshot.groups.find((g) => g.code === code);
  const memberIds = group ? group.members.map((m) => m.userId) : [];
  const joiner = personas.find((p) => !memberIds.includes(p.id) && p.id === 'clara') ?? personas.find((p) => !memberIds.includes(p.id));
  const kabeMissing = group && !memberIds.includes('kabe');

  return (
    <aside className="demo-panel" aria-label="Demo controls">
      <div className="demo-panel__head">
        <span className="demo-panel__tag">DEMO ONLY</span>
        <h3 className="demo-panel__title">Simulated invitations</h3>
        <button className="demo-panel__hide" type="button" onClick={() => setVisible(false)}>
          Hide
        </button>
      </div>
      <p className="demo-panel__text">Pretend friends act on your invite. Not part of the real product.</p>

      <div className="demo-panel__row">
        <label className="demo-panel__label" htmlFor="demo-viewer">
          Viewing as
        </label>
        <select
          className="demo-select"
          id="demo-viewer"
          value={snapshot.currentUserId}
          onChange={(event) => setViewer(event.target.value)}
        >
          {personas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.name}
            </option>
          ))}
        </select>
      </div>

      {context === 'members' && group && (
        <div className="demo-actions">
          {joiner && (
            <button
              className="demo-button demo-button--solid"
              type="button"
              onClick={() => {
                setViewer(joiner.id);
                navigate(`/invite/${group.code}`);
              }}
            >
              {`Open link as ${joiner.name}`}
            </button>
          )}
          {kabeMissing && (
            <button className="demo-button" type="button" onClick={() => addFriend(group.id, 'kabe')}>
              Kabe joins
            </button>
          )}
          <button className="demo-button" type="button" onClick={() => friendsPickAndBook(group.id)}>
            Friends pick &amp; book
          </button>
        </div>
      )}

      <label className="demo-check">
        <input
          type="checkbox"
          checked={snapshot.options.failNext}
          onChange={(event) => {
            setFailNext(event.target.checked);
            refresh();
          }}
        />
        Next request fails
      </label>

      <div className="demo-actions">
        <button
          className="demo-button"
          type="button"
          onClick={() => {
            resetDemo();
            navigate('/groups');
          }}
        >
          Reset demo
        </button>
      </div>
    </aside>
  );
}
