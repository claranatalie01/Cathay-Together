import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ApiError, chooseSuggestion, getPreferences, savePreferences } from '../../api';
import SuggestionCard from '../../components/domain/SuggestionCard';
import BottomNav from '../../components/layout/BottomNav';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import ChoicePill from '../../components/ui/ChoicePill';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StateMessage from '../../components/ui/StateMessage';
import StepProgress from '../../components/ui/StepProgress';
import { useToast } from '../../components/ui/Toast';
import { COPY } from '../../data/copy';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './PreferencePage.css';

// One suggestion at a time (Food, Scenery, Culture, Shopping). Pass or Like is saved straight away,
// so leaving and coming back keeps the choice. The last card saves the preferences.
export default function PreferencePage() {
  const { groupId, category } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const copy = COPY.prefs;
  const { status, data, error, reload } = useAsync(() => getPreferences(groupId), [groupId]);
  const [latest, setLatest] = useState(null);
  const [busy, setBusy] = useState(false);
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
  const index = places.findIndex((place) => place.id === category);
  if (index === -1) return <Navigate to={`/groups/${groupId}/preferences/${places[0].id}`} replace />;
  const place = places[index];
  const choice = choices[place.id];
  const last = index === places.length - 1;
  const path = (id) => `/groups/${groupId}/preferences/${id}`;
  const back = index === 0 ? `/groups/${groupId}/details` : path(places[index - 1].id);

  const choose = async (next) => {
    if (busy) return;
    setBusy(true);
    try {
      setLatest(await chooseSuggestion(groupId, place.id, next));
    } catch {
      toast(copy.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const proceed = async () => {
    if (!last) {
      navigate(path(places[index + 1].id));
      return;
    }
    setBusy(true);
    try {
      await savePreferences(groupId);
      navigate(`/groups/${groupId}/preferences/saved`);
    } catch (saveError) {
      toast(saveError instanceof ApiError ? saveError.message : copy.saveFailed);
      setBusy(false);
    }
  };

  return frame(
    <main className="prefs">
      <StepProgress label={copy.eyebrow} current={index + 1} total={places.length} stepText={copy.step(index + 1, places.length)} />
      <SuggestionCard key={place.id} place={place} choice={choice} onChoose={choose} />
      <div className="prefs__choices" role="group" aria-label={`${place.name}: ${copy.pass} or ${copy.like}`}>
        <ChoicePill tone="pass" selected={choice === 'pass'} icon="/assets/9a5a4.svg" onClick={() => choose('pass')} disabled={busy}>
          ← {copy.pass}
        </ChoicePill>
        <ChoicePill tone="like" selected={choice === 'like'} icon="/assets/5ea58.svg" onClick={() => choose('like')} disabled={busy}>
          {copy.like} →
        </ChoicePill>
      </div>
      <Button size="lg" onClick={proceed} disabled={!choice || busy} aria-busy={busy || undefined}>
        {last ? (busy ? copy.saving : copy.save) : copy.next}
      </Button>
      {/* Only the useful hints stay: why Next is disabled, and the tally before saving. */}
      <p className={`prefs__hint${!choice || last ? '' : ' sr-only'}`} role="status">
        {!choice ? copy.chooseFirst : last ? copy.tally(counts.chosen, counts.total, counts.liked, counts.passed) : ''}
      </p>
    </main>,
    back,
  );
}
