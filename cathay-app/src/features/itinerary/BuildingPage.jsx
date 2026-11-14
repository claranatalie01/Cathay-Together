import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, buildItinerary, getItinerary, getPreferences } from '../../api';
import TripContext from '../../components/domain/TripContext';
import BottomNav from '../../components/layout/BottomNav';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import IconHeading, { avatarTone } from '../../components/ui/IconHeading';
import LoadingState from '../../components/ui/LoadingState';
import { COPY } from '../../data/copy';
import { TRIP_PHOTO } from '../../data/trip';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './BuildingPage.css';

const BUILD_MS = 3000; // a visible build, like the prototype

// Builds the itinerary from everyone's saved preferences, then opens it. A plan that already
// exists opens straight away, so edits are never overwritten. If someone has not finished
// picking, it says who we are waiting for.
export default function BuildingPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const copy = COPY.itin;
  const prefs = useAsync(() => getPreferences(groupId, { prepare: false }), [groupId]);
  const [failure, setFailure] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useDocumentTitle(copy.title);

  const ready = prefs.data && prefs.data.readiness.every((m) => m.ready);
  const canOpen = ready || prefs.data?.itineraryBuilt;
  useEffect(() => {
    if (!canOpen) return undefined;
    let cancelled = false;
    setFailure(null);
    (async () => {
      try {
        try {
          await getItinerary(groupId);
          if (!cancelled) navigate(`/groups/${groupId}/itinerary`, { replace: true });
          return;
        } catch (notBuilt) {
          if (!(notBuilt instanceof ApiError && notBuilt.code === 'itinerary_not_built')) throw notBuilt;
        }
        await Promise.all([buildItinerary(groupId), new Promise((resolve) => setTimeout(resolve, BUILD_MS))]);
        if (!cancelled) navigate(`/groups/${groupId}/itinerary`, { replace: true });
      } catch (error) {
        if (!cancelled) setFailure(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canOpen, groupId, navigate, attempt]);

  const frame = (body) => (
    <Screen>
      <StatusBar />
      <PageHeader title="Tokyo together" onBack={() => navigate(`/groups/${groupId}/preferences/saved`)} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (prefs.status === 'loading') return frame(<LoadingState variant="detail" />);
  if (prefs.status === 'error') return frame(<ErrorState error={prefs.error} onRetry={prefs.reload} />);
  const { group, readiness } = prefs.data;
  const waiting = readiness.filter((m) => !m.ready).map((m) => m.name);

  return frame(
    <main className="building">
      <TripContext
        photo={TRIP_PHOTO}
        title={group.destination}
        dates={group.datesLabel}
        meta={[
          { icon: '/assets/ui-calendar.svg', text: group.datesLabel },
          { icon: '/assets/ui-users.svg', text: COPY.prefs.members(readiness.length) },
        ]}
      />
      <section className="building__status" aria-live="polite">
        {failure ? (
          <>
            <h2 className="building__title">{copy.buildFailed}</h2>
            {failure instanceof ApiError && <p className="building__text">{failure.message}</p>}
            <Button onClick={() => setAttempt((n) => n + 1)}>{copy.retry}</Button>
          </>
        ) : waiting.length ? (
          <>
            <h2 className="building__title">{copy.waiting(waiting.join(', '))}</h2>
            <Button variant="secondary" to={`/groups/${groupId}/details`}>
              {copy.backToGroup}
            </Button>
          </>
        ) : (
          <>
            <span className="building__ring" aria-hidden="true">
              <img src="/assets/ui-plane-dark.svg" alt="" />
            </span>
            <h2 className="building__title">{copy.buildingTitle}</h2>
            <p className="building__text">{copy.buildingText(4)}</p>
          </>
        )}
      </section>
      <section className="building__votes" aria-labelledby="votes-heading">
        <IconHeading icon="/assets/ui-users-group.svg" tone="teal" id="votes-heading">
          Group votes
        </IconHeading>
        <ul>
          {readiness.map((member) => (
            <li className={member.ready ? 'is-done' : ''} key={member.userId}>
              <span className={`building__avatar avatar-tone--${avatarTone(member.userId)}`} aria-hidden="true">
                {member.initial}
              </span>
              <span className="building__who">{member.ready ? copy.finishedPicking(member.name) : `${member.name} is still picking`}</span>
              <img src={member.ready ? '/assets/ui-check-teal.svg' : '/assets/ui-clock.svg'} alt="" />
            </li>
          ))}
        </ul>
        {!waiting.length && <p className="building__text">{copy.allFinished(readiness.length)}</p>}
      </section>
    </main>,
  );
}
