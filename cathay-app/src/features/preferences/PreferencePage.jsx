import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ApiError, chooseSuggestion, getPreferences, savePreferences } from '../../api';
import SuggestionCard from '../../components/domain/SuggestionCard';
import BottomNav from '../../components/layout/BottomNav';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StateMessage from '../../components/ui/StateMessage';
import StepProgress from '../../components/ui/StepProgress';
import { useToast } from '../../components/ui/Toast';
import { COPY } from '../../data/copy';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './PreferencePage.css';

// Reset the local draft when opening another trip, but keep it between cards.
export default function PreferencePage() {
  const { groupId } = useParams();
  return <PreferenceDeck key={groupId} />;
}

function PreferenceDeck() {
  const { groupId, category } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const copy = COPY.prefs;
  const { status, data, error, reload } = useAsync(() => getPreferences(groupId), [groupId]);
  const [latest, setLatest] = useState(null);
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const version = useRef(0);
  const focusNext = useRef(false);
  const mainRef = useRef(null);
  useEffect(() => () => { version.current += 1; }, [category]);
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    // AppShell focuses the heading after navigation. Continue keyboard swiping
    // from the next card once that route focus has run.
    const frame = requestAnimationFrame(() => mainRef.current?.querySelector('.suggestion, button')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [category]);
  const view = latest ?? data;
  useDocumentTitle(copy.title);

  const frame = (body, backTo) => (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.title} onBack={() => navigate(backTo ?? `/groups/${groupId}/details`)} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (status === 'error' && !view) {
    if (error instanceof ApiError && error.code === 'no_suggestions') {
      return frame(
        <StateMessage mark="!" tone="sand" title={copy.noSuggestionsTitle} text={error.message}>
          <Button to={`/groups/${groupId}/details`}>Back to group</Button>
        </StateMessage>,
      );
    }
    return frame(<ErrorState error={error} onRetry={reload} />);
  }
  if (!view) return frame(<LoadingState variant="detail" />);

  const { places, choices, counts } = view;
  const path = (id) => `/groups/${groupId}/preferences/${id}`;
  const unreviewed = places.find((place) => !choices[place.id]);
  if (category === 'review' && unreviewed) return <Navigate to={path(unreviewed.id)} replace />;

  const save = async () => {
    if (busy) return;
    const currentVersion = version.current;
    setBusy(true);
    try {
      await savePreferences(groupId);
      if (version.current === currentVersion) navigate(path('saved'), { replace: true });
    } catch (saveError) {
      toast(saveError instanceof ApiError ? saveError.message : copy.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  if (category === 'review') {
    return frame(
      <main className="prefs" ref={mainRef}>
        <StepProgress label={copy.eyebrow} current={places.length} total={places.length} stepText={copy.reviewed(places.length)} />
        <div className="prefs__review">
          <h2>{copy.reviewTitle}</h2>
          <p>{copy.savedCounts(counts.chosen, counts.liked, counts.passed)}</p>
        </div>
        <Button size="lg" onClick={save} disabled={busy} aria-busy={busy || undefined}>
          {busy ? copy.saving : copy.save}
        </Button>
      </main>,
      path(places.at(-1).id),
    );
  }

  const index = places.findIndex((place) => place.id === category);
  if (index === -1) return <Navigate to={path((unreviewed ?? places[0]).id)} replace />;
  const place = places[index];
  const back = index === 0 ? `/groups/${groupId}/details` : path(places[index - 1].id);

  const choose = async (choice, animation, byKeyboard) => {
    const currentVersion = version.current;
    try {
      const updated = await chooseSuggestion(groupId, place.id, choice);
      await animation;
      setLatest(updated);
      if (version.current !== currentVersion) return;
      setAnnouncement(copy.swipeResult(place.name, choice));
      const next = updated.places[index + 1] ?? updated.places.find(({ id }) => !updated.choices[id]);
      focusNext.current = byKeyboard;
      navigate(path(next?.id ?? 'review'));
    } catch {
      toast(copy.saveFailed);
    }
  };

  return frame(
    <main className="prefs" ref={mainRef}>
      <StepProgress label={copy.eyebrow} current={index + 1} total={places.length} stepText={copy.step(index + 1, places.length)} />
      <div className="prefs__stage">
        <SuggestionCard key={place.id} place={place} choice={choices[place.id]} onChoose={choose} describedBy="prefs-swipe-hint prefs-swipe-keys" />
      </div>
      <p id="prefs-swipe-hint" className="prefs__hint"><span>{copy.swipeLeft}</span><span>{copy.swipeRight}</span></p>
      <p id="prefs-swipe-keys" className="sr-only">{copy.swipeKeys}</p>
      <p className="sr-only" role="status">{announcement}</p>
    </main>,
    back,
  );
}
