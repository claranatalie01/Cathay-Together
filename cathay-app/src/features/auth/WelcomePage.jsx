import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getHomeAirports, saveProfile } from '../../api';
import { distanceKm } from '../../algorithms/travel.js';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import Field from '../../components/ui/Field';
import LoadingState from '../../components/ui/LoadingState';
import { COPY } from '../../data/copy';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './WelcomePage.css';

const FORM_ID = 'welcome-form';

// Only return to a page inside this app.
function safeNext(value) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/welcome') ? value : '/groups';
}

function WelcomeForm({ airports, next }) {
  const copy = COPY.welcome;
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [airport, setAirport] = useState('');
  const [query, setQuery] = useState('');
  const [nearest, setNearest] = useState('');
  const [locating, setLocating] = useState(false);
  const [locateMessage, setLocateMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Search by city or code. The nearest airport, when known, is listed first.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return airports
      .filter((a) => !q || a.city.toLowerCase().includes(q) || a.code.toLowerCase().includes(q))
      .sort((a, b) => (b.code === nearest) - (a.code === nearest));
  }, [airports, query, nearest]);

  // The position is compared with the airport list here, in the browser. It is never sent anywhere.
  const locate = () => {
    if (!navigator.geolocation) {
      setLocateMessage(copy.locateDenied);
      return;
    }
    setLocating(true);
    setLocateMessage('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here = { lat: coords.latitude, lon: coords.longitude };
        const closest = airports.reduce((best, a) => (distanceKm(here, a) < distanceKm(here, best) ? a : best), airports[0]);
        setNearest(closest.code);
        setAirport(closest.code);
        setErrors(({ airport: _removed, ...rest }) => rest);
        setLocating(false);
      },
      () => {
        setLocateMessage(copy.locateDenied);
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const found = {};
    if (!name.trim()) found.name = copy.errors.nameRequired;
    if (!airport) found.airport = copy.errors.airportRequired;
    setErrors(found);
    setFormError('');
    if (found.name) return document.getElementById('field-name')?.focus();
    if (found.airport) return document.getElementById('field-airport-search')?.focus();
    setSubmitting(true);
    try {
      await saveProfile({ name: name.trim(), airport });
      navigate(next, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.fields) setErrors(error.fields);
      else setFormError(copy.failed);
      setSubmitting(false);
    }
  };

  return (
    <main className="welcome">
      <p className="welcome__description">{copy.description}</p>
      <form className="trip-form welcome__form" id={FORM_ID} noValidate onSubmit={onSubmit}>
        <Field id="field-name" label={copy.labels.name} error={errors.name}>
          <input
            className="field__text"
            id="field-name"
            name="name"
            type="text"
            autoComplete="given-name"
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={errors.name ? 'true' : undefined}
            aria-describedby={errors.name ? 'field-name-error' : undefined}
          />
        </Field>
        <Field id="field-airport-search" label={copy.labels.airport} error={errors.airport}>
          <input
            className="field__text"
            id="field-airport-search"
            type="search"
            placeholder={copy.search}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-invalid={errors.airport ? 'true' : undefined}
            aria-describedby={errors.airport ? 'field-airport-search-error' : undefined}
          />
        </Field>
        <fieldset className="welcome__airports">
          <legend className="welcome__legend">{copy.labels.airport}</legend>
          {shown.length === 0 && <p className="welcome__none">{copy.noMatch}</p>}
          {shown.map((a) => (
            <label className="welcome__airport" key={a.code}>
              <input type="radio" name="airport" value={a.code} checked={airport === a.code} onChange={() => setAirport(a.code)} />
              <span className="welcome__city">{a.city}</span>
              <span className="welcome__code">{a.code}</span>
              {a.code === nearest && <span className="welcome__badge">{copy.suggested}</span>}
            </label>
          ))}
        </fieldset>
      </form>
      <div className="welcome__locate">
        <Button variant="secondary" onClick={locate} disabled={locating} aria-busy={locating || undefined}>
          {locating ? copy.locating : copy.locate}
        </Button>
        <p className="welcome__note">{copy.locateNote}</p>
        {locateMessage && (
          <p className="field__error" role="alert">
            {locateMessage}
          </p>
        )}
      </div>
      {formError && (
        <p className="field__error" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" form={FORM_ID} disabled={submitting} aria-busy={submitting || undefined}>
        {submitting ? copy.submitting : copy.submit}
      </Button>
      <p className="welcome__note">{copy.changeLater}</p>
    </main>
  );
}

// First sign-in: the person's name and home airport. PROPOSAL: not in the real-app screenshots;
// built from the sign-in and Create group patterns.
export default function WelcomePage() {
  const copy = COPY.welcome;
  const [searchParams] = useSearchParams();
  const list = useAsync(() => getHomeAirports(), []);
  useDocumentTitle(copy.title);

  return (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.title} />
      {list.status === 'loading' && <LoadingState variant="list" />}
      {list.status === 'error' && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.status === 'success' && <WelcomeForm airports={list.data} next={safeNext(searchParams.get('next'))} />}
    </Screen>
  );
}
