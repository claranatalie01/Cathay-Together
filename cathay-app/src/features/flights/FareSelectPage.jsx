import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getFares, saveSelection } from '../../api';
import ComparisonTable from '../../components/domain/ComparisonTable';
import FareCard from '../../components/domain/FareCard';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import Price from '../../components/ui/Price';
import Sheet from '../../components/ui/Sheet';
import Tabs from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { COPY } from '../../data/copy';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useLastData } from '../../hooks/useLastData';
import './FareSelectPage.css';

// Fare types for one flight (Light, Essential, Flex). Choosing Light first offers the Essential
// upgrade in a sheet; "Fare comparison" opens the three-way table. The cabin and the open sheet
// live in the URL (?cabin=&sheet=), so Back closes a sheet and links can be shared.
export default function FareSelectPage() {
  const { groupId, flightId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const copy = COPY.flights.fares;
  const cabin = params.get('cabin') ?? undefined;
  const sheet = params.get('sheet');
  const [saving, setSaving] = useState(null);

  const { status, data, error, reload } = useAsync(() => getFares(groupId, flightId, { cabin }), [groupId, flightId, cabin]);
  const shown = useLastData(status, data);
  const direction = flightId.startsWith('return') ? 'return' : 'outbound';
  const title = direction === 'return' ? copy.titleReturn : copy.titleOutbound;
  useDocumentTitle(title);

  const resultsPath = `/groups/${groupId}/flights/${direction}?cabin=${shown?.cabin ?? cabin ?? 'economy'}${shown ? `&date=${shown.flight.date}` : ''}`;

  const frame = (body) => (
    <Screen>
      <StatusBar />
      <PageHeader title={title} onBack={() => navigate(resultsPath)} />
      {body}
    </Screen>
  );

  if (status === 'error') return frame(<ErrorState error={error} onRetry={reload} />);
  if (!shown) return frame(<LoadingState variant="list" />);

  const setSheet = (name) => {
    const next = new URLSearchParams(params);
    if (name) next.set('sheet', name);
    else next.delete('sheet');
    setParams(next, { replace: !name });
  };

  const choose = async (fareId) => {
    setSaving(fareId);
    try {
      await saveSelection(groupId, { flightId, cabin: shown.cabin, fare: fareId });
      if (direction === 'outbound') {
        toast(copy.pickedOutbound);
        navigate(`/groups/${groupId}/flights/return?cabin=${shown.cabin}`, { replace: true });
      } else {
        toast(copy.pickedReturn);
        navigate(`/groups/${groupId}/invite`, { replace: true });
      }
    } catch {
      toast(copy.saveFailed);
      setSaving(null);
    }
  };

  const onSelect = (fare) => (fare.id === 'light' ? setSheet('upgrade') : choose(fare.id));
  const names = Object.fromEntries(shown.fares.map((fare) => [fare.id, fare.name]));
  const light = shown.fares.find((f) => f.id === 'light');
  const essential = shown.fares.find((f) => f.id === 'essential');
  const { flight } = shown;
  const busy = saving !== null;

  return frame(
    <>
      <Tabs
        label={copy.cabinsLabel}
        tone="deep"
        value={shown.cabin}
        onChange={(id) => {
          const next = new URLSearchParams(params);
          next.set('cabin', id);
          setParams(next, { replace: true });
        }}
        tabs={shown.cabins.map((c) => ({ id: c.id, label: c.label, sub: c.delta ? copy.from(c.delta) : null }))}
      />
      <main className="fares" aria-busy={status === 'loading' || undefined}>
        <p className="sr-only">
          {flight.from} {flight.departTime} to {flight.to} {flight.arriveTime}, {flight.flightNo}
          {flight.via ? `, via Hong Kong, ${flight.via.layoverLabel} wait` : ''}
        </p>
        <div className="fares__list">
          {shown.fares.map((fare) => (
            <FareCard key={fare.id} fare={fare} onSelect={onSelect} onCompare={() => setSheet('compare')} disabled={busy} busy={saving === fare.id} />
          ))}
        </div>
      </main>

      <Sheet open={sheet === 'upgrade'} onClose={() => setSheet(null)} title={copy.upgradeTitle} titleId="upgrade-title">
        <p className="fares__sheet-text">{copy.upgradeText(essential.price - light.price)}</p>
        <ComparisonTable columns={['light', 'essential']} names={names} groups={shown.comparison} caption="Light and Essential fares compared" />
        <div className="fares__sheet-actions">
          <Button onClick={() => choose('essential')} disabled={busy} aria-busy={saving === 'essential' || undefined} data-autofocus>
            {copy.upgradeAction}
          </Button>
          <Button variant="secondary" onClick={() => choose('light')} disabled={busy} aria-busy={saving === 'light' || undefined}>
            {copy.keepLight}
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'compare'} onClose={() => setSheet(null)} title={copy.compareTitle} titleId="compare-title">
        <ComparisonTable columns={['light', 'essential', 'flex']} names={names} groups={shown.comparison} caption="Light, Essential and Flex fares compared" />
        <ul className="fares__picks">
          {shown.fares.map((fare) => (
            <li key={fare.id}>
              <Price amount={fare.price} />
              <Button size="sm" onClick={() => choose(fare.id)} disabled={busy} aria-busy={saving === fare.id || undefined} aria-label={`Select ${fare.name} fare`}>
                Select
              </Button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>,
  );
}
