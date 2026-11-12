import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, deleteGroup, getGroups, leaveGroup, signOut } from '../../api';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import PageHeader from '../../components/layout/PageHeader';
import BottomNav from '../../components/layout/BottomNav';
import GroupCard from '../../components/domain/GroupCard';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import Sheet from '../../components/ui/Sheet';
import StateMessage from '../../components/ui/StateMessage';
import { useToast } from '../../components/ui/Toast';
import { COPY } from '../../data/copy';
import { photoFor } from '../../data/trip';
import { memberSummary } from './groupSelectors';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './GroupsPage.css';

const canRemove = (group) => group.viewerRole === 'creator' || group.viewerRole === 'member';

// How one group appears in the list, depending on the signed-in person's role.
function describe(group) {
  const text = COPY.groups;
  const creator = group.members.find((m) => m.userId === group.creatorId);
  if (group.viewerRole === 'invitee') {
    const declined = group.invitation === 'declined';
    return {
      to: `/invite/${group.code}`,
      chip: declined ? text.chips.declined : text.chips.invitee,
      status: declined ? text.status.declined : text.status.invited(group.members.length, creator?.name ?? 'a friend'),
    };
  }
  return {
    to: `/groups/${group.id}/invite`,
    chip: group.viewerRole === 'creator' ? text.chips.creator : text.chips.member,
    status: memberSummary(group.members),
  };
}

export default function GroupsPage() {
  const navigate = useNavigate();
  const copy = COPY.groups;
  const { status, data: groups, error, reload } = useAsync(getGroups, []);
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const [managing, setManaging] = useState(false);
  const [selection, setSelection] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const requestInProgress = useRef(false);
  const focusAfterRemoval = useRef(false);
  const manageButton = useRef(null);
  const createButton = useRef(null);
  const closeRemoval = useCallback(() => {
    if (!requestInProgress.current) setSelection(null);
  }, []);
  useDocumentTitle(copy.title);

  useEffect(() => {
    if (status !== 'success' || !focusAfterRemoval.current) return;
    focusAfterRemoval.current = false;
    (manageButton.current ?? createButton.current)?.focus();
  }, [status, groups]);

  const switchAccount = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      toast(COPY.signIn.signOutFailed);
      setSigningOut(false);
    }
  };

  const accountAction = (
    <button className="groups__sign-out" type="button" onClick={switchAccount} disabled={signingOut} aria-busy={signingOut || undefined}>
      <img src="/assets/ui-sign-out-teal.svg" alt="" />
      <span>{signingOut ? COPY.signIn.signingOut : COPY.signIn.signOut}</span>
    </button>
  );

  const frame = (body, sheet) => (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.title} action={accountAction} />
      {body}
      <BottomNav variant="groups" />
      {sheet}
    </Screen>
  );

  if (status === 'loading') return frame(<LoadingState variant="list" />);
  if (status === 'error') return frame(<ErrorState error={error} onRetry={reload} />);

  if (groups.length === 0) {
    return frame(
      <StateMessage mark="+" title={copy.emptyTitle} text={copy.emptyText}>
        <Button ref={createButton} onClick={() => navigate('/groups/new')}>{copy.create}</Button>
      </StateMessage>,
    );
  }

  const removableGroups = groups.filter(canRemove);
  const choosing = managing && removableGroups.length > 0;
  const selected = selection && removableGroups.find((group) => group.id === selection.id && group.viewerId === selection.viewerId);
  const removal = selected && copy.remove[selected.viewerRole];

  const confirmRemoval = async () => {
    if (requestInProgress.current || !selected) return;
    requestInProgress.current = true;
    setRemoving(true);
    setRemoveError('');
    let message = removal.success;
    try {
      await (selected.viewerRole === 'creator' ? deleteGroup : leaveGroup)(selected.id);
    } catch (actionError) {
      if (!(actionError instanceof ApiError) || actionError.code !== 'group_not_found') {
        setRemoveError(actionError instanceof ApiError ? actionError.message : copy.remove.failed);
        return;
      }
      message = copy.remove.unavailable;
    } finally {
      requestInProgress.current = false;
      setRemoving(false);
    }
    if (removableGroups.length === 1) setManaging(false);
    setSelection(null);
    focusAfterRemoval.current = true;
    reload();
    toast(message);
  };

  return frame(
    <main className="groups">
      <p className="groups__intro">{copy.intro}</p>
      <div className="gd__head groups__head">
        <span className="gd__tile gd__tile--teal" aria-hidden="true">
          <img src="/assets/ui-users-group.svg" alt="" />
        </span>
        <h2 className="gd__title">{copy.heading}</h2>
        {removableGroups.length > 0 && (
          <Button ref={manageButton} variant="secondary" className="groups__manage" data-managing={choosing || undefined} onClick={() => setManaging(!choosing)}>
            {choosing ? copy.remove.done : copy.remove.manage}
          </Button>
        )}
      </div>
      {choosing && <p className="groups__remove-hint" role="status">{copy.remove.choose}</p>}
      <ul className="groups__list">
        {(choosing ? removableGroups : groups).map((group) => {
          const info = describe(group);
          return (
            <li key={group.id}>
              <GroupCard
                to={info.to}
                onClick={choosing ? () => {
                  setRemoveError('');
                  setSelection({ id: group.id, viewerId: group.viewerId });
                } : undefined}
                photo={photoFor(group.destination, group.id)}
                name={group.name}
                meta={`${group.destination} · ${group.datesLabel}`}
                status={info.status}
                chip={info.chip}
              />
            </li>
          );
        })}
      </ul>
      <Button ref={createButton} to="/groups/new" className="groups__create">
        {copy.create}
      </Button>
    </main>,
    selected && (
      <Sheet open onClose={closeRemoval} title={removal.title} titleId="remove-group-title" descriptionId="remove-group-description" className="groups__remove-sheet">
        <div className="groups__remove-summary">
          <img src={photoFor(selected.destination, selected.id).src} alt="" />
          <div>
            <p className="groups__remove-name">{selected.name}</p>
            <p>{memberSummary(selected.members)}</p>
          </div>
        </div>
        <p className="sheet__text" id="remove-group-description">{removal.description}</p>
        {removeError && <p className="groups__remove-error" role="alert">{removeError}</p>}
        <div className="groups__remove-actions">
          <Button variant="secondary" onClick={closeRemoval} disabled={removing} data-autofocus>{copy.remove.cancel}</Button>
          <Button variant="destructive" onClick={confirmRemoval} disabled={removing} aria-busy={removing || undefined}>
            {removing ? removal.pending : removal.confirm}
          </Button>
        </div>
      </Sheet>
    ),
  );
}
