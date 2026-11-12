import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, getBoard, getBooking, startBooking } from '../../api';
import MemberRow from '../../components/domain/MemberRow';
import Timeline from '../../components/domain/Timeline';
import TripContext from '../../components/domain/TripContext';
import BottomNav from '../../components/layout/BottomNav';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import SegmentedControl from '../../components/ui/SegmentedControl';
import { useToast } from '../../components/ui/Toast';
import { COPY } from '../../data/copy';
import { TRIP_PHOTO } from '../../data/trip';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { BookSheet } from './BookingOverlays';
import { formatGap } from './boardFormat';
import './BoardPage.css';

// The group board: everyone's chosen flights as a list or two hourly timelines, plus the viewer's
// next step (pick flights, book now, or view the booking). The view and any open sheet live in the URL.
export default function BoardPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const copy = COPY.board;
  const view = params.get('view') === 'timeline' ? 'timeline' : 'list';
  const sheet = params.get('sheet');
  const [busy, setBusy] = useState(false);

  const { status, data: board, error, reload } = useAsync(() => getBoard(groupId), [groupId]);
  const booking = useAsync(() => getBooking(groupId), [groupId]);
  useDocumentTitle(board ? board.group.name : 'Board');

  const frame = (title, body) => (
    <Screen>
      <StatusBar />
      <PageHeader title={title} onBack={() => navigate(`/groups/${groupId}/invite`)} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (status === 'loading') return frame('Board', <LoadingState variant="detail" />);
  if (status === 'error') return frame('Board', <ErrorState error={error} onRetry={reload} />);

  const setParam = (changes, replace = false) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value === null ? next.delete(key) : next.set(key, value)));
    setParams(next, { replace });
  };

  const { summary, members, timeline, viewerAction } = board;
  const arrivalPoints = timeline.arrivals.points;
  const choosing = summary.members - summary.booked - summary.picked;
  const subline = copy.subline(summary.picked, choosing);
  const youIn = [...arrivalPoints, ...timeline.departures.points].some((p) => p.includesViewer);

  const confirmPay = async () => {
    setBusy(true);
    try {
      await startBooking(groupId);
      navigate(`/groups/${groupId}/payment`);
    } catch (startError) {
      toast(startError instanceof ApiError ? startError.message : COPY.booking.payFailed);
    } finally {
      setBusy(false);
    }
  };

  return frame(
    board.group.name,
    <>
      <main className="board">
        {view === 'list' && (
          <TripContext
            photo={TRIP_PHOTO}
            title={board.group.destination}
            meta={[
              { icon: '/assets/ui-calendar.svg', text: board.group.datesLabel },
              { icon: '/assets/ui-users.svg', text: copy.members(summary.members) },
            ]}
          />
        )}
        <section className="board__summary" aria-label="Status">
          <p className="board__headline">{copy.headline(summary.booked, summary.members)}</p>
          {summary.booked > 0 && (
            <Chip tone="sand">
              <img src="/assets/ui-check-circle-sand.svg" alt="" />
              {copy.booked(summary.booked)}
            </Chip>
          )}
          {subline && <p className="board__subline">{subline}</p>}
        </section>
        <SegmentedControl
          name="board-view"
          label={copy.viewLabel}
          value={view}
          onChange={(id) => setParam({ view: id === 'list' ? null : id }, true)}
          options={[
            { id: 'list', label: copy.list, icon: '/assets/ui-list.svg', iconSelected: '/assets/ui-list-light.svg' },
            { id: 'timeline', label: copy.timeline, icon: '/assets/ui-timeline.svg', iconSelected: '/assets/ui-timeline-light.svg' },
          ]}
        />
        <section className="board__flights" aria-label={copy.title}>
          {view === 'list' ? (
            <>
              {arrivalPoints.length > 1 && (
                <p className="board__spread">
                  <img src="/assets/ui-users-group.svg" alt="" />
                  <span>
                    {timeline.arrivals.spanMinutes === 0 ? (
                      copy.spreadSame
                    ) : (
                      <>
                        {copy.spreadWithin} <strong>{formatGap(timeline.arrivals.spanMinutes)}</strong>
                      </>
                    )}
                  </span>
                </p>
              )}
              <ul className="board__list">
                {members.map((member) => (
                  <MemberRow
                    key={member.userId}
                    member={{ ...member, isCreator: false }}
                    destination={board.destination.code}
                    flights={member.hasFlights ? { arrive: member.arrive, leave: member.leave } : null}
                  />
                ))}
              </ul>
            </>
          ) : (
            <Timeline
              columns={[
                { id: 'arrivals', title: copy.arrivals, dateLabel: timeline.arrivals.dateLabel, icon: '/assets/ui-plane-arrival.svg', tone: 'arrive', points: timeline.arrivals.points, spanLabel: timeline.arrivals.spanMinutes ? formatGap(timeline.arrivals.spanMinutes) : null },
                { id: 'departures', title: copy.departures, dateLabel: timeline.departures.dateLabel, icon: '/assets/ui-plane-departure.svg', tone: 'depart', points: timeline.departures.points, spanLabel: timeline.departures.spanMinutes ? formatGap(timeline.departures.spanMinutes) : null },
              ]}
              legend={youIn ? copy.legend : null}
            />
          )}
        </section>
        <div className="board__action">
          {viewerAction === 'book' && <Button size="lg" onClick={() => setParam({ sheet: 'book' })}>{copy.bookNow}</Button>}
          {viewerAction === 'booked' && <Button size="lg" variant="secondary" to={`/groups/${groupId}/confirmed`}>{copy.viewBooking}</Button>}
          {viewerAction === 'pick' && <Button size="lg" to={`/groups/${groupId}/flights/search`}>{copy.pickFlights}</Button>}
        </div>
      </main>
      <BookSheet open={sheet === 'book'} onClose={() => setParam({ sheet: null })} booking={booking.data} loadState={booking} busy={busy} onConfirm={confirmPay} />
    </>,
  );
}
