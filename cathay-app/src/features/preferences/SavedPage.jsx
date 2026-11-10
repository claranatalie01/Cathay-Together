import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ApiError, getCurrentUser, getPreferences } from '../../api';
import MemberRow from '../../components/domain/MemberRow';
import BottomNav from '../../components/layout/BottomNav';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StateMessage from '../../components/ui/StateMessage';
import { COPY } from '../../data/copy';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './SavedPage.css';

// After saving: what you liked, and who in the group is ready. Generate itinerary is Flow E.
export default function SavedPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const copy = COPY.prefs;
  const { status, data, error, reload } = useAsync(() => getPreferences(groupId), [groupId]);
  const { data: user } = useAsync(getCurrentUser, []);
  useDocumentTitle(copy.savedTitle);

  const frame = (body) => (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.savedTitle} onBack={() => navigate(`/groups/${groupId}/preferences/${data?.places?.[data.places.length - 1]?.id ?? ''}`)} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (status === 'loading') return frame(<LoadingState variant="detail" />);
  if (status === 'error') {
    if (error instanceof ApiError && error.code === 'no_suggestions') {
      return frame(
        <StateMessage mark="!" tone="sand" title={copy.noSuggestionsTitle} text={error.message}>
          <Button to={`/groups/${groupId}/details`}>Back to group</Button>
        </StateMessage>,
      );
    }
    return frame(<ErrorState error={error} onRetry={reload} />);
  }
  if (!data.saved) return <Navigate to={`/groups/${groupId}/preferences/${data.places[0].id}`} replace />;

  const liked = data.places.filter((place) => data.choices[place.id] === 'like');
  const waiting = data.readiness.filter((member) => !member.ready).map((member) => member.name);

  return frame(
    <main className="saved">
      <div className="saved__hero">
        <span className="saved__tick">
          <img src="/assets/c07aa.svg" alt="" />
        </span>
        <h2 className="saved__title">{copy.savedHeading}</h2>
        <p className="saved__text">
          {user ? copy.savedLead(user.name) : ''}
          <br />
          {copy.savedCounts(data.counts.total, data.counts.liked, data.counts.passed)}
        </p>
      </div>

      <section className="saved__section" aria-labelledby="liked-heading">
        <h3 className="saved__heading" id="liked-heading">
          {copy.likedHeading}
        </h3>
        {liked.length === 0 ? (
          <p className="saved__text">{copy.noLikes}</p>
        ) : (
          <ul className="saved__list">
            {liked.map((place) => (
              <li className="saved__place" key={place.id}>
                <img className="saved__thumb" src={place.thumb} alt={place.alt} />
                <div className="saved__info">
                  <p className="saved__name">{place.name}</p>
                  <p className="saved__meta">
                    {place.category} · {place.savedNote}
                  </p>
                </div>
                <img className="saved__heart" src="/assets/4714d.svg" alt="Liked" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="saved__section" aria-labelledby="ready-heading">
        <div className="saved__head">
          <h3 className="saved__heading" id="ready-heading">
            {copy.readiness}
          </h3>
          <Chip tone="tint">{copy.readyCount(data.readyCount, data.readiness.length)}</Chip>
        </div>
        <ul className="member-list">
          {data.readiness.map((member) => (
            <MemberRow key={member.userId} member={{ ...member, status: member.ready ? 'ready' : 'choosing' }} />
          ))}
        </ul>
        {waiting.length > 0 && <p className="saved__text">{copy.waiting(waiting.join(', '))}</p>}
      </section>

      <Button size="lg" to={`/groups/${groupId}/itinerary/building`}>
        {copy.generate}
      </Button>
    </main>,
  );
}
