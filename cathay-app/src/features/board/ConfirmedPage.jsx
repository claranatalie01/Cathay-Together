import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getBooking, isShared } from '../../api';
import BottomNav from '../../components/layout/BottomNav';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import { COPY } from '../../data/copy';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { TripLeg, WhoLine } from './BookingOverlays';
import './BookingPages.css';

// The plain-text e-ticket, built from the booking (no real ticket is issued).
function ticketText(booking) {
  const leg = (label, s) => `${label}: ${s.from} to ${s.to}, ${s.date}, ${s.departTime} to ${s.arriveTime}, ${s.flightNo}, ${s.cabinLabel} ${s.fareName}`;
  return [
    'Cathay Together e-ticket (demo, not a real ticket)',
    `Booking reference: ${booking.ticket.reference}`,
    `E-ticket number: ${booking.ticket.ticketNumber}`,
    leg('Outbound', booking.outbound),
    leg('Return', booking.return),
    `Total paid: HKD ${booking.ticket.total.toLocaleString('en-US')}`,
  ].join('\n');
}

function downloadTicket(booking) {
  const url = URL.createObjectURL(new Blob([ticketText(booking)], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `e-ticket-${booking.ticket.reference}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function BonusMiles() {
  const copy = COPY.booking.bonusMiles;
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <section className="confirmed__miles" aria-label={copy.label}>
      <span className="confirmed__miles-icon">
        <img src="/assets/ui-asia-miles-teal.svg" alt="" />
      </span>
      <div>
        <p>{copy.lead}<strong>{copy.amount}</strong>{copy.detail}</p>
        <button type="button" className="confirmed__redeem" onClick={() => setShowFeedback(true)}>
          {copy.redeem}
        </button>
        <p className="confirmed__miles-status" role="status">{showFeedback && copy.feedback}</p>
      </div>
    </section>
  );
}

export default function ConfirmedPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const copy = COPY.booking;
  const { status, data: booking, error, reload } = useAsync(() => getBooking(groupId), [groupId]);
  useDocumentTitle(copy.confirmedTitle);

  const frame = (body) => (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.confirmedTitle} onBack={() => navigate(`/groups/${groupId}/board`)} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (status === 'loading') return frame(<LoadingState variant="detail" />);
  if (status === 'error') return frame(<ErrorState error={error} onRetry={reload} />);
  if (!booking.ticket) return <Navigate to={`/groups/${groupId}/board`} replace />;

  return frame(
    <main className="confirmed">
      <div className="confirmed__hero">
        <span className="confirmed__tick">
          <img src="/assets/ui-check-badge.svg" alt="" />
        </span>
        <h2 className="confirmed__title">{copy.going}</h2>
        <p className="confirmed__sub">{copy.success}</p>
      </div>
      <section className="payment__card" aria-label="E-ticket">
        <div className="confirmed__who">
          <Chip tone="sand">Booked</Chip>
          <WhoLine cabin={booking.outbound.cabinLabel} />
        </div>
        <dl className="confirmed__ids">
          <div>
            <dt>
              <img src="/assets/ui-ticket.svg" alt="" />
              {copy.reference}
            </dt>
            <dd>{booking.ticket.reference}</dd>
          </div>
        </dl>
        <TripLeg selection={booking.outbound} direction="outbound" compact />
        <TripLeg selection={booking.return} direction="return" compact />
      </section>
      {isShared && <BonusMiles key={`${groupId}:${booking.ticket.reference}`} />}
      <div className="payment__actions">
        <Button size="lg" variant="secondary" onClick={() => downloadTicket(booking)}>
          <img src="/assets/ui-download.svg" alt="" />
          {copy.download}
        </Button>
        <Button size="lg" variant="secondary" className="button--quiet" to={`/groups/${groupId}/board`}>
          <img src="/assets/ui-users-group.svg" alt="" />
          {COPY.board.viewAll}
        </Button>
        <Button size="lg" to={`/groups/${groupId}/details`}>
          {copy.backToGroup}
        </Button>
      </div>
    </main>,
  );
}
