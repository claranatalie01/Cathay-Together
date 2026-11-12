import { useCallback, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ApiError, declineInvite, getCurrentUser, getGroupByCode, joinGroup } from '../../api';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import PageHeader from '../../components/layout/PageHeader';
import BottomNav from '../../components/layout/BottomNav';
import BonusTeaser from '../../components/domain/BonusTeaser';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import Sheet from '../../components/ui/Sheet';
import StateMessage from '../../components/ui/StateMessage';
import { DemoControls } from '../../demo';
import { COPY } from '../../data/copy';
import { INVITE_PHOTO } from '../../data/trip';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './InvitePage.css';

const UNAVAILABLE_CODES = ['invite_not_found'];

export default function InvitePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const copy = COPY.invite;
  const { status, data, error, reload } = useAsync(
    () => Promise.all([getGroupByCode(code), getCurrentUser()]),
    [code],
  );
  const [busy, setBusy] = useState(null); // 'join' | 'decline' | null
  const [actionError, setActionError] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const closeConfirm = useCallback(() => setConfirmOpen(false), []);

  const group = data?.[0];
  const user = data?.[1];
  useDocumentTitle(
    group?.invitation === 'declined'
      ? copy.declined.pageTitle
      : user
        ? copy.title(user.name)
        : status === 'error'
          ? copy.unavailable.pageTitle
          : undefined,
  );

  const frame = (title, body, nav = true) => (
    <Screen>
      <StatusBar />
      <PageHeader title={title} onBack={() => navigate('/groups')} />
      {body}
      {nav && <BottomNav variant="groups" />}
    </Screen>
  );

  if (status === 'loading') return frame(' ', <LoadingState />);

  if (status === 'error') {
    if (error instanceof ApiError && UNAVAILABLE_CODES.includes(error.code)) {
      const text = copy.unavailable.reasons[error.code];
      return frame(
        copy.unavailable.pageTitle,
        <StateMessage mark="!" tone="sand" title={copy.unavailable.title} text={text}>
          <Button to="/groups">{copy.unavailable.toGroups}</Button>
          <Button to="/groups/new" variant="secondary">
            {copy.unavailable.create}
          </Button>
          <DemoControls context="invite" />
        </StateMessage>,
      );
    }
    return frame(' ', <ErrorState error={error} onRetry={reload} />);
  }

  // Someone who already joined goes straight to the group.
  if (group.viewerId) return <Navigate to={`/groups/${group.id}/invite`} replace />;

  const act = async (kind, task) => {
    setBusy(kind);
    setActionError(false);
    try {
      await task();
      return true;
    } catch (taskError) {
      if (taskError instanceof ApiError && UNAVAILABLE_CODES.includes(taskError.code)) {
        reload(); // The invitation just became unavailable: show why.
      } else {
        setActionError(true);
      }
      return false;
    } finally {
      setBusy(null);
    }
  };

  const onJoin = async () => {
    const ok = await act('join', () => joinGroup(group.id, group.code));
    if (ok) navigate(`/groups/${group.id}/invite`, { replace: true });
  };

  const onDecline = async () => {
    const ok = await act('decline', () => declineInvite(group.id, group.code));
    if (ok) setConfirmOpen(false);
  };

  // The person already declined this invitation.
  if (group.invitation === 'declined') {
    const d = copy.declined;
    return frame(
      d.pageTitle,
      <StateMessage mark="✕" title={d.title} text={d.text(group.name)}>
        <Button onClick={onJoin} disabled={busy === 'join'} aria-busy={busy === 'join' || undefined}>
          {busy === 'join' ? copy.joining : d.joinInstead}
        </Button>
        <Button to="/groups" variant="secondary">
          {d.back}
        </Button>
        {actionError && (
          <p className="field__error" role="alert">
            {copy.actionFailed}
          </p>
        )}
        <DemoControls context="invite" group={group} />
      </StateMessage>,
    );
  }

  const count = group.members.length;
  const summary = `${count} member${count === 1 ? '' : 's'} · ${count + 1} including you after joining`;

  return (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.title(user.name)} onBack={() => navigate('/groups')} />
      <main className="invitation">
        <article className="invite-card">
          <div className="invite-card__photo">
            <img src={INVITE_PHOTO.src} alt={INVITE_PHOTO.alt} />
          </div>
          <div className="invite-card__summary">
            <h2 className="invite-card__name">{group.name}</h2>
            <p className="invite-card__destination">{group.destination}</p>
            <div className="invite-card__meta">
              <span className="invite-card__meta-icon invite-card__meta-icon--calendar">
                <img src="/assets/f8248.svg" alt="Dates" />
              </span>
              <p className="invite-card__meta-text">{group.datesLabel}</p>
            </div>
            <p className="invite-card__members">{summary}</p>
          </div>
        </article>
        <section className="agreement">
          <h3 className="agreement__title">{copy.rightsTitle}</h3>
          <p className="agreement__text">{copy.rightsText}</p>
        </section>
        <BonusTeaser heading={COPY.bonus.heading} text={COPY.bonus.inviteText} />
        <div className="invitation__actions">
          <Button onClick={onJoin} disabled={busy !== null} aria-busy={busy === 'join' || undefined}>
            {busy === 'join' ? copy.joining : copy.join}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)} disabled={busy !== null}>
            {copy.decline}
          </Button>
          {actionError && !confirmOpen && (
            <p className="field__error" role="alert">
              {copy.actionFailed}
            </p>
          )}
        </div>
        <DemoControls context="invite" group={group} />
      </main>
      <BottomNav variant="groups" />
      <Sheet open={confirmOpen} onClose={closeConfirm} title={copy.sheet.title} titleId="decline-title">
        <p className="sheet__text">{copy.sheet.text}</p>
        <Button onClick={closeConfirm} data-autofocus>
          {copy.sheet.keep}
        </Button>
        <Button variant="secondary" onClick={onDecline} disabled={busy === 'decline'} aria-busy={busy === 'decline' || undefined}>
          {busy === 'decline' ? copy.sheet.confirming : copy.sheet.confirm}
        </Button>
        {actionError && (
          <p className="field__error" role="alert">
            {copy.actionFailed}
          </p>
        )}
      </Sheet>
    </Screen>
  );
}
