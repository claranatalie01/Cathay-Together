import { useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { chooseSuggestion, getPreferences, savePreferences } from '../../api';
import SuggestionCard from '../../components/domain/SuggestionCard';
import BottomNav from '../../components/layout/BottomNav';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StepProgress from '../../components/ui/StepProgress';
import { useToast } from '../../components/ui/Toast';
import { COPY } from '../../data/copy';
import { fallbackTo } from '../../data/photos';
import { groupPreferencePlaces } from '../../data/preferenceCategories';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './PreferencePage.css';

const copy = COPY.prefs;

export default function PreferencePage() {
  const { groupId, step } = useParams();
  const navigate = useNavigate();
  const { key, search } = useLocation();
  const { status, data, error, reload } = useAsync(() => getPreferences(groupId), [groupId]);
  const root = `/groups/${groupId}/preferences`;
  const isDeck = step === 'swipe';
  useDocumentTitle(copy.title);

  const frame = (body) => (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.title} onBack={() => navigate(isDeck ? root + search : `/groups/${groupId}/details`)} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (step && !isDeck) return <Navigate to={root} replace />;
  if (status === 'error') return frame(<ErrorState error={error} onRetry={reload} />);
  if (!data || data.group.id !== groupId) return frame(<LoadingState variant="detail" />);

  const params = new URLSearchParams(search);
  const groups = groupPreferencePlaces(data.places);
  const reviewing = params.get('edit') === '1';
  const savedSelection = params.get('categories')?.split(',');
  const selected = groups.filter(({ id, places }) => places.length && (
    savedSelection?.includes(id) ?? (reviewing && !isDeck && places.some((place) => data.choices[place.id]))
  )).map(({ id }) => id);
  const savedPath = `${root}/saved${search}`;

  if (isDeck) {
    if (!selected.length) return <Navigate to={root} replace />;
    return frame(
      <ActivityDeck key={key} groups={groups} selected={selected} reviewing={reviewing} choices={data.choices} groupId={groupId} savedPath={savedPath} />,
    );
  }

  return frame(
    <CategoryPicker key={key} groups={groups} selected={selected} reviewing={reviewing} data={data} groupId={groupId} root={root} />,
  );
}

function deckFor(groups, selected, choices, reviewing) {
  return groups
    .filter(({ id }) => selected.includes(id))
    .flatMap(({ label, places }) => places
      .filter(({ id }) => reviewing || !choices[id])
      .map((place) => ({ ...place, category: label })));
}

function selectionQuery(selected, reviewing) {
  const params = new URLSearchParams();
  if (selected.length) params.set('categories', selected.join(','));
  if (reviewing) params.set('edit', '1');
  return params.size ? `?${params}` : '';
}

function CategoryPicker({ groups, selected, reviewing, data, groupId, root }) {
  const [selection, setSelection] = useState(selected);
  const { finishing, finish, mainRef } = useFinishPicking(groupId, selection);
  const navigate = useNavigate();
  const search = selectionQuery(selection, reviewing);
  const ideas = deckFor(groups, selection, data.choices, reviewing).length;
  const skip = () => finish(`${root}/saved${search}`);

  return (
    <main className="prefs" ref={mainRef}>
      <div className="prefs__intro">
        <p className="prefs__eyebrow">{copy.eyebrow(data.group.destination)}</p>
        <h2>{copy.explore}</h2>
        <p>{copy.selectCategories}</p>
      </div>
      <ul className="prefs__categories" aria-label={copy.categories}>
        {groups.map(({ id, label, places: [first] }) => {
          const checked = selection.includes(id);
          return (
            <li key={id}>
              <button
                className="prefs__category"
                type="button"
                aria-pressed={checked}
                disabled={!first || finishing}
                onClick={() => setSelection((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])}
              >
                {first && <img className="prefs__category-photo" src={first.thumb || first.photo} alt="" referrerPolicy="no-referrer" onError={fallbackTo(id)} />}
                <span className="prefs__category-check" aria-hidden="true">{checked && '✓'}</span>
                <strong>{label}</strong>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="prefs__finish">
        <Button
          size="lg"
          onClick={() => ideas ? navigate(`${root}/swipe${search}`) : void skip()}
          disabled={!selection.length || finishing}
          aria-busy={finishing || undefined}
        >
          {finishing ? copy.saving : copy.finish}
        </Button>
        <p role="status">{selection.length ? copy.categorySelection(selection.length, ideas) : copy.selectToSwipe}</p>
        <button className="prefs__skip" type="button" disabled={finishing} onClick={skip}>{copy.skipPreferences}</button>
      </div>
    </main>
  );
}

function ActivityDeck({ groups, selected, reviewing, choices, groupId, savedPath }) {
  // Freeze the queue for this visit so a swipe or background refresh can't shift card positions.
  const [deck] = useState(() => deckFor(groups, selected, choices, reviewing));
  const [index, setIndex] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const swipePending = useRef(false);
  const toast = useToast();
  const { finishing, finish, mainRef } = useFinishPicking(groupId, selected);
  const place = deck[index];
  const busy = swiping || finishing;

  const advance = async (byKeyboard) => {
    if (!mainRef.current?.isConnected) return;
    setIndex(index + 1);
    if (index + 1 >= deck.length) {
      await finish(savedPath);
    } else if (byKeyboard) {
      requestAnimationFrame(() => mainRef.current?.querySelector('.suggestion')?.focus());
    }
  };

  const choose = async (choice, animation, byKeyboard) => {
    if (busy || swipePending.current) return;
    swipePending.current = true;
    setSwiping(true);
    try {
      await chooseSuggestion(groupId, place.id, choice);
      await animation;
      if (!mainRef.current?.isConnected) return;
      setAnnouncement(copy.swipeResult(place.name, choice));
      await advance(byKeyboard);
    } catch {
      toast(copy.saveFailed);
    } finally {
      swipePending.current = false;
      setSwiping(false);
    }
  };

  return (
    <main className="prefs prefs--deck" ref={mainRef}>
      {place ? (
        <>
          <StepProgress label={copy.activityPicks} current={index + 1} total={deck.length} stepText={copy.step(index + 1, deck.length)} />
          <div className="prefs__stage">
            <SuggestionCard key={place.id} place={place} choice={choices[place.id]} onChoose={choose} disabled={busy} describedBy="prefs-swipe-hint prefs-swipe-keys" />
          </div>
          <p id="prefs-swipe-hint" className="prefs__hint"><span>{copy.swipeLeft}</span><span>{copy.swipeRight}</span></p>
          <p id="prefs-swipe-keys" className="sr-only">{copy.swipeKeys}</p>
          <button className="prefs__skip" type="button" disabled={busy} onClick={() => advance(true)}>
            {choices[place.id] ? copy.nextIdea : copy.skip}
          </button>
        </>
      ) : (
        <h2 className="prefs__deck-end">{copy.deckEnd}</h2>
      )}
      <Button variant="secondary" size="lg" disabled={busy} aria-busy={finishing || undefined} onClick={() => finish(savedPath)}>
        {finishing ? copy.saving : copy.doneSwiping}
      </Button>
      <p className="sr-only" role="status">{announcement}</p>
    </main>
  );
}

function useFinishPicking(groupId, categories) {
  const navigate = useNavigate();
  const toast = useToast();
  const mainRef = useRef(null);
  const pending = useRef(false);
  const [finishing, setFinishing] = useState(false);

  const finish = async (path) => {
    if (pending.current) return;
    pending.current = true;
    setFinishing(true);
    try {
      await savePreferences(groupId, categories);
      if (mainRef.current?.isConnected) navigate(path, { replace: true });
    } catch {
      if (mainRef.current?.isConnected) toast(copy.finishFailed);
    } finally {
      pending.current = false;
      setFinishing(false);
    }
  };

  return { finishing, finish, mainRef };
}
