import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSearchForm } from '../../api';
import BottomNav from '../../components/layout/BottomNav';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import PhotoHeader from '../../components/domain/PhotoHeader';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import Field from '../../components/ui/Field';
import LoadingState from '../../components/ui/LoadingState';
import Slider from '../../components/ui/Slider';
import Tabs from '../../components/ui/Tabs';
import { COPY } from '../../data/copy';
import { WING_PHOTO } from '../../data/photos';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './FlightSearchPage.css';

// "Book a trip": the signed-in member's own airport to the group's destination, on the group's
// dates. Route, dates and passengers come from the API; only trip type and cabin can change.
export default function FlightSearchPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const copy = COPY.flights.search;
  const { status, data: form, error, reload } = useAsync(() => getSearchForm(groupId), [groupId]);
  const [trip, setTrip] = useState('return');
  const [cabin, setCabin] = useState('economy');
  const [windowHours, setWindowHours] = useState(null);
  useDocumentTitle(copy.title);

  const frame = (body, header = <PhotoHeader className="photo-header--book" photo={WING_PHOTO} title={copy.title} onBack={() => navigate(`/groups/${groupId}/invite`)} />) => (
    <Screen>
      <StatusBar />
      {header}
      {body}
      <BottomNav variant="book" />
    </Screen>
  );

  if (status === 'loading') return frame(<LoadingState variant="detail" />);
  if (status === 'error') return frame(<ErrorState error={error} onRetry={reload} />);

  const timing = COPY.flights.timing;
  const hours = windowHours ?? form.groupWindow.hours;
  const onSubmit = (event) => {
    event.preventDefault();
    navigate(`/groups/${groupId}/flights/outbound?cabin=${cabin}&trip=${trip}&window=${hours}`);
  };

  return frame(
    <main className="book">
      <form className="book__card" onSubmit={onSubmit} aria-label={copy.title}>
        <Tabs
          label={copy.tabsLabel}
          value={trip}
          onChange={setTrip}
          tabs={[
            { id: 'return', label: copy.tabs.return },
            { id: 'oneway', label: copy.tabs.oneway },
          ]}
        />
        <div className="book__route">
          <div className="book__place">
            <span className="book__place-label">{copy.from}</span>
            <span className="book__code">{form.origin.code}</span>
            <span className="book__city">{form.origin.city}</span>
          </div>
          <span className="book__swap" aria-hidden="true">
            <img src="/assets/ui-swap.svg" alt="" />
          </span>
          <div className="book__place book__place--end">
            <span className="book__place-label">{copy.to}</span>
            <span className="book__code">{form.destination.code}</span>
            <span className="book__city">{form.destination.city}</span>
          </div>
        </div>
        <div className={`book__dates${trip === 'oneway' ? ' book__dates--single' : ''}`}>
          <Field id="depart" label={copy.departing}>
            <input className="field__text" id="depart" readOnly value={form.departLabel} />
          </Field>
          {trip === 'return' && (
            <Field id="return" label={copy.returning}>
              <input className="field__text book__end" id="return" readOnly value={form.returnLabel} />
            </Field>
          )}
        </div>
        <p className="book__note">{copy.datesNote}</p>
        <Field id="cabin" label={copy.cabinLabel} disclosure={<img src="/assets/ui-chevron-down.svg" alt="" />}>
          <select className="field__text" id="cabin" value={cabin} onChange={(event) => setCabin(event.target.value)}>
            {form.cabins.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}, {form.passengers}
              </option>
            ))}
          </select>
        </Field>
        <Slider
          id="timing-window"
          label={timing.sliderLabel}
          valueText={timing.sliderValue(hours)}
          help={timing.sliderHelp}
          min={form.groupWindow.min}
          max={form.groupWindow.max}
          step={form.groupWindow.step}
          value={hours}
          onChange={setWindowHours}
        />
        <Button type="submit">{copy.submit}</Button>
      </form>
    </main>,
  );
}
