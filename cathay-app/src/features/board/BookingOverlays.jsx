import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import Price from '../../components/ui/Price';
import Sheet from '../../components/ui/Sheet';
import { getCurrentUser } from '../../api';
import { COPY } from '../../data/copy';
import { useAsync } from '../../hooks/useAsync';
import { shortDate } from './boardFormat';

// One chosen flight: icon, "11:20 to 15:15", date, flight number and airports.
// `compact` (payment and confirmed screens): "11:20 to 15:15" and "Sat 7 Nov · CX500" only.
export function TripLeg({ selection, direction, compact = false }) {
  const arrive = direction === 'outbound';
  if (compact) {
    return (
      <div className={`trip-leg trip-leg--${arrive ? 'arrive' : 'leave'}`}>
        <img className="trip-leg__icon" src={`/assets/ui-plane-${arrive ? 'arrival' : 'departure'}.svg`} alt="" />
        <p className="trip-leg__times">
          <strong>
            {selection.departTime} to {selection.arriveTime}
          </strong>
          <span>
            {shortDate(selection.date)} · {selection.flightNo}
          </span>
        </p>
      </div>
    );
  }
  return (
    <div className={`trip-leg trip-leg--${arrive ? 'arrive' : 'leave'}`}>
      <img className="trip-leg__icon" src={`/assets/ui-plane-${arrive ? 'arrival' : 'departure'}.svg`} alt="" />
      <p className="trip-leg__times">
        <strong>
          {selection.departTime} to {selection.arriveTime}
        </strong>
        <span>
          {arrive ? 'Outbound' : 'Return'} · {selection.fareName} · {selection.flightNo}
        </span>
        <span>
          {selection.from} to {selection.to}
        </span>
      </p>
      <Price amount={selection.price} className="trip-leg__price" />
    </div>
  );
}

// "Book now": the viewer's own two flights and what they cost. Confirm starts the payment hold.
// `loadState` is the booking's useAsync result: a failed load says so (with Retry), instead of
// pretending there is nothing to book.
export function BookSheet({ open, onClose, booking, loadState, busy, onConfirm }) {
  const copy = COPY.booking;
  const failed = loadState?.status === 'error' && !booking;
  const loading = loadState?.status === 'loading' && !booking;
  return (
    <Sheet open={open} onClose={onClose} title={copy.sheetTitle} titleId="book-title">
      {failed ? (
        <ErrorState error={loadState.error} onRetry={loadState.reload} />
      ) : loading ? (
        <LoadingState variant="detail" />
      ) : booking?.outbound && booking?.return ? (
        <>
          <WhoLine cabin={booking.outbound.cabinLabel} />
          <div className="booking__legs">
            <TripLeg selection={booking.outbound} direction="outbound" />
            <TripLeg selection={booking.return} direction="return" />
          </div>
          <p className="booking__total">
            <span>{copy.total}</span>
            <Price amount={booking.total} />
          </p>
          <p className="booking__note">{copy.individual}</p>
          <Button size="lg" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined} data-autofocus>
            {busy ? copy.starting : copy.confirmPay}
          </Button>
        </>
      ) : (
        <p className="booking__note">{copy.noTrip}</p>
      )}
    </Sheet>
  );
}

// "Clara (you) · 1 adult · Economy": whose booking this is. The name comes from the signed-in user.
export function WhoLine({ cabin }) {
  const { data: user } = useAsync(getCurrentUser, []);
  return (
    <p className="booking__who">
      {user ? <strong>{user.name} (you)</strong> : null}
      {user ? ' · ' : ''}
      {COPY.booking.onlyYou(cabin)}
    </p>
  );
}
