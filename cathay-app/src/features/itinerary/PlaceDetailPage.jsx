import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, getStop } from '../../api';
import BottomNav from '../../components/layout/BottomNav';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StateMessage from '../../components/ui/StateMessage';
import IconHeading, { avatarTone } from '../../components/ui/IconHeading';
import StatTile from '../../components/ui/StatTile';
import { COPY } from '../../data/copy';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './PlaceDetailPage.css';

// One stop in detail: photo, text, budget and duration, a tip, and (for a voted place) every member's vote.
export default function PlaceDetailPage() {
  const { groupId, stopId } = useParams();
  const navigate = useNavigate();
  const copy = COPY.itin;
  const { status, data, error, reload } = useAsync(() => getStop(groupId, stopId), [groupId, stopId]);
  useDocumentTitle(data ? data.stop.name : copy.title);
  const back = `/groups/${groupId}/itinerary`;

  const frame = (title, body) => (
    <Screen>
      <StatusBar />
      <PageHeader title={title} onBack={() => navigate(back)} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (status === 'loading') return frame(copy.title, <LoadingState variant="detail" />);
  if (status === 'error') {
    if (error instanceof ApiError && error.code === 'stop_not_found') {
      return frame(
        copy.title,
        <StateMessage mark="!" tone="sand" title="Stop not found" text={error.message}>
          <Button to={back}>{copy.backToItinerary}</Button>
        </StateMessage>,
      );
    }
    return frame(copy.title, <ErrorState error={error} onRetry={reload} />);
  }

  const { stop, votes, day } = data;
  const liked = votes ? votes.filter((v) => v.choice === 'like').length : 0;
  return frame(
    copy.stopTitle(day.index, stop.slot),
    <main className="place">
      <img className="place__photo" src={stop.photo} alt={stop.alt} />
      <div className="place__head">
        <h2 className="place__name">{stop.name}</h2>
        <p className="place__area">
          <img src="/assets/ui-pin-teal.svg" alt="" />
          {stop.area}
        </p>
      </div>
      <p className="place__text">{stop.description}</p>
      <div className="place__tiles">
        <StatTile icon="/assets/ui-yen-sand.svg" tone="sand" value={stop.budget} label={copy.budget} />
        <StatTile icon="/assets/ui-clock-steel.svg" tone="steel" value={stop.durationBest} label={copy.durationBest} />
      </div>
      {stop.tip && (
        <section className="place__card" aria-labelledby="tip-heading">
          <IconHeading as="h3" icon="/assets/ui-sparkle.svg" tone="sand" id="tip-heading">
            {copy.goodToKnow}
          </IconHeading>
          <p className="place__text">{stop.tip}</p>
        </section>
      )}
      <section className="place__card" aria-labelledby="votes-heading">
        <IconHeading as="h3" icon={votes ? '/assets/4714d.svg' : '/assets/ui-sparkle.svg'} tone={votes ? 'teal' : 'sand'} id="votes-heading">
          {votes ? copy.votesTitle(liked, votes.length) : copy.suggested}
        </IconHeading>
        {votes ? (
          <ul className="place__votes">
            {votes.map((vote, i) => (
              <li key={vote.userId}>
                <span className={`place__avatar avatar-tone--${avatarTone(i)}`} aria-hidden="true">
                  {vote.initial}
                </span>
                <span className="place__voter">
                  {vote.name}
                  {vote.isViewer ? ' (you)' : ''}
                </span>
                <span className={`place__vote place__vote--${vote.choice ?? 'none'}`}>
                  <img src={vote.choice === 'like' ? '/assets/4714d.svg' : vote.choice === 'pass' ? '/assets/ui-x-grey.svg' : '/assets/ui-clock.svg'} alt="" />
                  {vote.choice === 'like' ? copy.liked : vote.choice === 'pass' ? copy.passed : copy.notVoted}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="place__text">{copy.suggestedNote}</p>
        )}
      </section>
      <Button size="lg" variant="secondary" to={back}>
        {copy.backToItinerary}
      </Button>
    </main>,
  );
}
