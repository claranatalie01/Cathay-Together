import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getPreferences } from '../../api';
import MemberRow from '../../components/domain/MemberRow';
import BottomNav from '../../components/layout/BottomNav';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import { COPY } from '../../data/copy';
import { fallbackTo } from '../../data/photos';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './SavedPage.css';

// After saving: what you liked, and who in the group is ready. Generate itinerary is Flow E.
export default function SavedPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const copy = COPY.prefs;
  const { status, data, error, reload } = useAsync(() => getPreferences(groupId, { prepare: false }), [groupId]);
  const root = `/groups/${groupId}/preferences`;
  useDocumentTitle(copy.savedTitle);

  const frame = (body) => (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.savedTitle} onBack={() => navigate(`/groups/${groupId}/details`)} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (status === 'loading') return frame(<LoadingState variant="detail" />);
  if (status === 'error') return frame(<ErrorState error={error} onRetry={reload} />);

  const liked = data.places.filter((place) => data.choices[place.id] === 'like');
  const waiting = data.readiness.filter((member) => !member.ready).map((member) => member.name);
  const params = new URLSearchParams(search);
  if (data.saved) params.set('edit', '1');
  const pickerPath = params.size ? `${root}?${params}` : root;

  return frame(
    <main className="saved">
      <section className="saved__section saved__readiness" aria-labelledby="ready-heading">
        <div className="saved__head">
          <h2 className="saved__heading" id="ready-heading">
            {COPY.members.heading}
          </h2>
          <Chip tone="tint">{copy.readyCount(data.readyCount, data.readiness.length)}</Chip>
        </div>
        <ul className="member-list">
          {data.readiness.map((member) => (
            <MemberRow key={member.userId} member={{ ...member, status: member.ready ? 'ready' : 'choosing' }} />
          ))}
        </ul>
      </section>

      <p className="saved__text" role="status">
        {waiting.length === 0 ? copy.allReady : data.saved ? copy.waiting(waiting.join(', ')) : copy.readinessUnlock}
      </p>
      {waiting.length === 0 ? (
        <Button size="lg" to={`/groups/${groupId}/itinerary/building`}>{copy.generate}</Button>
      ) : (
        <Button size="lg" disabled>{copy.generate}</Button>
      )}
      <Button variant="secondary" to={pickerPath}>{data.saved ? copy.edit : copy.continuePicking}</Button>

      <section className="saved__section" aria-labelledby="liked-heading">
        <h3 className="saved__heading" id="liked-heading">
          {copy.likedHeading}
        </h3>
        <p className="saved__text">{copy.deckCounts(data.counts.liked, data.counts.passed, data.counts.neutral)}</p>
        {liked.length === 0 ? (
          <p className="saved__text">{copy.noLikes}</p>
        ) : (
          <ul className="saved__list">
            {liked.map((place) => (
              <li className="saved__place" key={place.id}>
                <img className="saved__thumb" src={place.thumb} alt={place.alt} referrerPolicy="no-referrer" onError={fallbackTo(place.category_key)} />
                <div className="saved__info">
                  <p className="saved__name">{place.name}</p>
                  <p className="saved__meta">
                    {place.category}{place.savedNote && ` · ${place.savedNote}`}
                  </p>
                </div>
                <img className="saved__heart" src="/assets/4714d.svg" alt="Liked" />
              </li>
            ))}
          </ul>
        )}
      </section>

    </main>,
  );
}
