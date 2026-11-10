import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, createGroup } from '../../api';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import PageHeader from '../../components/layout/PageHeader';
import BottomNav from '../../components/layout/BottomNav';
import Button from '../../components/ui/Button';
import Field from '../../components/ui/Field';
import BonusTeaser from '../../components/domain/BonusTeaser';
import { COPY } from '../../data/copy';
import { DATE_OPTIONS, DEFAULT_GROUP_VALUES, DESTINATIONS, GROUP_NAME_MAX_LENGTH } from '../../data/trip';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './CreateGroupPage.css';

const FORM_ID = 'create-group-form';
const FIELD_ORDER = ['name', 'destination', 'dates'];

function validateField(field, values) {
  const text = COPY.createGroup.errors;
  const value = values[field].trim();
  if (field === 'name') return value ? '' : text.nameRequired;
  if (field === 'destination') {
    if (!value) return text.destinationRequired;
    const supported = DESTINATIONS.some((d) => d.toLowerCase() === value.toLowerCase()) || /^tokyo\b/i.test(value);
    return supported ? '' : text.destinationUnsupported;
  }
  if (!value) return text.datesRequired;
  const option = DATE_OPTIONS.find((d) => d.value === value);
  return option && option.available ? '' : text.datesUnavailable;
}

function validateAll(values) {
  const errors = {};
  FIELD_ORDER.forEach((field) => {
    const message = validateField(field, values);
    if (message) errors[field] = message;
  });
  return errors;
}

export default function CreateGroupPage() {
  const copy = COPY.createGroup;
  const navigate = useNavigate();
  const [values, setValues] = useState(DEFAULT_GROUP_VALUES);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useDocumentTitle(copy.title);

  const update = (field) => (event) => {
    const next = { ...values, [field]: event.target.value };
    setValues(next);
    // Clear a shown error as soon as the value becomes valid.
    if (errors[field] && !validateField(field, next)) {
      setErrors(({ [field]: _removed, ...rest }) => rest);
    }
  };

  const check = (field) => () => {
    const message = validateField(field, values);
    setErrors((prev) => {
      const { [field]: _old, ...rest } = prev;
      return message ? { ...rest, [field]: message } : rest;
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const found = validateAll(values);
    setErrors(found);
    setFormError('');
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) {
      document.getElementById(`field-${first}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      // Typed variations of a supported destination are stored in their canonical form.
      const group = await createGroup({ ...values, destination: DESTINATIONS[0] });
      navigate(`/groups/${group.id}/invite`);
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        setErrors(error.fields);
        const field = FIELD_ORDER.find((name) => error.fields[name]);
        if (field) document.getElementById(`field-${field}`)?.focus();
      } else {
        setFormError(copy.failed);
      }
      setSubmitting(false);
    }
  };

  const describe = (field) => (errors[field] ? `field-${field}-error` : undefined);

  return (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.title} onBack={() => navigate('/groups')} />
      <main className="group-setup">
        <p className="group-setup__description">{copy.description}</p>
        <form className="trip-form" id={FORM_ID} noValidate onSubmit={onSubmit}>
          <Field id="field-name" label={copy.labels.name} error={errors.name}>
            <input
              className="field__text"
              id="field-name"
              name="name"
              type="text"
              autoComplete="off"
              maxLength={GROUP_NAME_MAX_LENGTH}
              required
              value={values.name}
              onChange={update('name')}
              onBlur={check('name')}
              aria-invalid={errors.name ? 'true' : undefined}
              aria-describedby={describe('name')}
            />
          </Field>
          <Field id="field-destination" label={copy.labels.destination} error={errors.destination}>
            <input
              className="field__text"
              id="field-destination"
              name="destination"
              type="text"
              autoComplete="off"
              required
              value={values.destination}
              onChange={update('destination')}
              onBlur={check('destination')}
              aria-invalid={errors.destination ? 'true' : undefined}
              aria-describedby={describe('destination')}
            />
          </Field>
          <Field
            id="field-dates"
            label={copy.labels.dates}
            error={errors.dates}
            icon="/assets/4341a.svg"
            disclosure="⌄"
          >
            <select
              className="field__text"
              id="field-dates"
              name="dates"
              required
              value={values.dates}
              onChange={update('dates')}
              onBlur={check('dates')}
              aria-invalid={errors.dates ? 'true' : undefined}
              aria-describedby={describe('dates')}
            >
              {DATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} disabled={!option.available}>
                  {option.label}
                  {option.available ? '' : ' (not in demo)'}
                </option>
              ))}
            </select>
          </Field>
        </form>
        <p className="group-setup__agreement">{copy.agreement}</p>
        <BonusTeaser heading={COPY.bonus.heading} text={COPY.bonus.createText} />
        {formError && (
          <p className="field__error" role="alert">
            {formError}
          </p>
        )}
        <Button type="submit" form={FORM_ID} disabled={submitting} aria-busy={submitting || undefined}>
          {submitting ? copy.submitting : copy.submit}
        </Button>
      </main>
      <BottomNav variant="groups" />
    </Screen>
  );
}
