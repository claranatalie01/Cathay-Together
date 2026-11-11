import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ApiError, getCurrentUser, isShared, signIn, signOut } from '../../api';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import PageHeader from '../../components/layout/PageHeader';
import BottomNav from '../../components/layout/BottomNav';
import Button from '../../components/ui/Button';
import Field from '../../components/ui/Field';
import LoadingState from '../../components/ui/LoadingState';
import StateMessage from '../../components/ui/StateMessage';
import { COPY } from '../../data/copy';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useSession } from '../../hooks/useSession';
import './SignInPage.css';

const FORM_ID = 'sign-in-form';
const FIELD_ORDER = ['email', 'password'];

function validateField(field, values) {
  const text = COPY.signIn.errors;
  if (field === 'email') return values.email.trim() ? '' : text.emailRequired;
  return values.password ? '' : text.passwordRequired;
}

// Only return to a page inside this app: a path that starts with one slash.
function safeNext(value) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/sign-in') ? value : '/groups';
}

// Shown once signed in: the name and airport come from the person's row in the database.
function SignedIn({ next }) {
  const copy = COPY.signIn;
  const user = useAsync(() => getCurrentUser(), []);
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    setLeaving(true);
    try {
      await signOut();
    } finally {
      setLeaving(false);
    }
  };
  const signOutButton = (
    <Button variant="secondary" onClick={leave} disabled={leaving} aria-busy={leaving || undefined}>
      {copy.signOut}
    </Button>
  );

  if (user.status === 'loading') return <LoadingState variant="list" />;
  if (user.status === 'error') {
    const text = user.error instanceof ApiError && user.error.status < 500 ? user.error.message : copy.unreachable;
    return (
      <StateMessage role="alert" mark="!" tone="sand" title={copy.profileProblem} text={text}>
        <Button onClick={user.reload}>{copy.retry}</Button>
        {signOutButton}
      </StateMessage>
    );
  }
  const { name, initial, airport } = user.data;
  return (
    <StateMessage mark={initial} title={copy.signedInTitle(name)} text={copy.signedInText(airport.city, airport.code)}>
      <Button to={next}>{copy.continue}</Button>
      {signOutButton}
    </StateMessage>
  );
}

function SignInForm() {
  const copy = COPY.signIn;
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const update = (field) => (event) => {
    const next = { ...values, [field]: event.target.value };
    setValues(next);
    // Clear a shown error as soon as the value becomes valid.
    if (errors[field] && !validateField(field, next)) {
      setErrors(({ [field]: _removed, ...rest }) => rest);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const found = {};
    FIELD_ORDER.forEach((field) => {
      const message = validateField(field, values);
      if (message) found[field] = message;
    });
    setErrors(found);
    setFormError('');
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) {
      document.getElementById(`field-${first}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      // On success the session changes and this form is replaced by the signed-in view.
      await signIn({ email: values.email.trim(), password: values.password });
    } catch (error) {
      setFormError(error instanceof ApiError && error.status < 500 ? error.message : copy.unreachable);
      setSubmitting(false);
    }
  };

  const describe = (field) => (errors[field] ? `field-${field}-error` : undefined);

  return (
    <main className="sign-in">
      <p className="sign-in__description">{copy.description}</p>
      <form className="trip-form sign-in__form" id={FORM_ID} noValidate onSubmit={onSubmit}>
        <Field id="field-email" label={copy.labels.email} error={errors.email}>
          <input
            className="field__text"
            id="field-email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            required
            value={values.email}
            onChange={update('email')}
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={describe('email')}
          />
        </Field>
        <Field id="field-password" label={copy.labels.password} error={errors.password}>
          <input
            className="field__text"
            id="field-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={values.password}
            onChange={update('password')}
            aria-invalid={errors.password ? 'true' : undefined}
            aria-describedby={describe('password')}
          />
        </Field>
      </form>
      {formError && (
        <p className="field__error" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" form={FORM_ID} disabled={submitting} aria-busy={submitting || undefined}>
        {submitting ? copy.submitting : copy.submit}
      </Button>
    </main>
  );
}

// Sign-in screen for the shared backend. PROPOSAL: the real app's sign-in screen is not in the
// screenshots, so this reuses the Create group form pattern (white card, underlined fields).
export default function SignInPage() {
  const copy = COPY.signIn;
  const [searchParams] = useSearchParams();
  const { status, userId } = useSession();
  useDocumentTitle(copy.title);

  // The mock backend has no sign-in.
  if (!isShared) return <Navigate to="/groups" replace />;

  return (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.title} />
      {status === 'loading' && <LoadingState variant="list" />}
      {status === 'signedOut' && <SignInForm />}
      {/* The key reloads the profile if a different person signs in. */}
      {status === 'signedIn' && <SignedIn key={userId} next={safeNext(searchParams.get('next'))} />}
      <BottomNav variant="groups" />
    </Screen>
  );
}
