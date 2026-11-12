import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ApiError, getBooking, payBooking, releaseHold, startBooking } from '../../api';
import BottomNav from '../../components/layout/BottomNav';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import Countdown from '../../components/ui/Countdown';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import Price from '../../components/ui/Price';
import StateMessage from '../../components/ui/StateMessage';
import { useToast } from '../../components/ui/Toast';
import { COPY } from '../../data/copy';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { TripLeg, WhoLine } from './BookingOverlays';
import './BookingPages.css';

const HOLD_SECONDS = 20 * 60;

// Payment hold: a real 20-minute countdown and a simulated "Pay now". No card details are taken.
export default function PaymentPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const copy = COPY.booking;
  const { status, data: booking, error, reload } = useAsync(() => getBooking(groupId), [groupId]);
  const [busy, setBusy] = useState(null);
  useDocumentTitle(copy.paymentTitle);

  const frame = (body) => (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.paymentTitle} onBack={() => navigate(`/groups/${groupId}/board`)} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (status === 'loading') return frame(<LoadingState variant="detail" />);
  if (status === 'error') return frame(<ErrorState error={error} onRetry={reload} />);
  if (booking.ticket) return <Navigate to={`/groups/${groupId}/confirmed`} replace />;
  if (!booking.hold && !booking.holdExpired) return <Navigate to={`/groups/${groupId}/board`} replace />;

  if (!booking.hold) {
    const again = async () => {
      setBusy('again');
      try {
        await startBooking(groupId);
        await reload();
      } catch {
        toast(copy.payFailed);
      } finally {
        setBusy(null);
      }
    };
    return frame(
      <StateMessage as="main" role="alert" mark="!" tone="sand" title={copy.expiredTitle} text={copy.expiredText}>
        <Button onClick={again} disabled={busy !== null} aria-busy={busy === 'again' || undefined}>
          {copy.startAgain}
        </Button>
        <Button variant="secondary" to={`/groups/${groupId}/board`}>
          {copy.back}
        </Button>
      </StateMessage>,
    );
  }

  const pay = async () => {
    setBusy('pay');
    try {
      await payBooking(groupId);
      navigate(`/groups/${groupId}/confirmed`, { replace: true });
    } catch (payError) {
      if (payError instanceof ApiError && payError.code === 'hold_expired') reload();
      else toast(copy.payFailed);
      setBusy(null);
    }
  };

  const change = async () => {
    setBusy('change');
    try {
      await releaseHold(groupId);
      navigate(`/groups/${groupId}/flights/search`);
    } catch {
      toast(copy.payFailed);
      setBusy(null);
    }
  };

  return frame(
    <main className="payment">
      <section className="payment__card payment__card--timer">
        <Countdown expiresAt={booking.hold.expiresAt} totalSeconds={HOLD_SECONDS} onExpire={reload} label={copy.holdLabel} />
        <p className="payment__note">{copy.holdNote}</p>
      </section>
      <section className="payment__card" aria-label="Your trip">
        <WhoLine cabin={booking.outbound.cabinLabel} />
        <TripLeg selection={booking.outbound} direction="outbound" compact />
        <TripLeg selection={booking.return} direction="return" compact />
        <p className="booking__total">
          <span>{copy.total}</span>
          <Price amount={booking.total} />
        </p>
      </section>
      <div className="payment__actions">
        <Button size="lg" onClick={pay} disabled={busy !== null} aria-busy={busy === 'pay' || undefined}>
          {busy === 'pay' ? copy.paying : copy.payNow}
        </Button>
        <Button size="lg" variant="secondary" onClick={change} disabled={busy !== null}>
          {copy.changeFlight}
        </Button>
      </div>
    </main>,
  );
}
