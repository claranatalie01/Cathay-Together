import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ApiError, getBooking, getGroup, getPreferences, markInviteCopied } from '../../api';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import PageHeader from '../../components/layout/PageHeader';
import BottomNav from '../../components/layout/BottomNav';
import MemberRow from '../../components/domain/MemberRow';
import NextStep from '../../components/domain/NextStep';
import TripContext from '../../components/domain/TripContext';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import Chip from '../../components/ui/Chip';
import StateMessage from '../../components/ui/StateMessage';
import { useToast } from '../../components/ui/Toast';
import { COPY } from '../../data/copy';
import { fallbackTo } from '../../data/photos';
import { groupPreferencePlaces } from '../../data/preferenceCategories';
import { TRIP_PHOTO } from '../../data/trip';
import { copyText } from '../../hooks/copyText';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { shortDate } from '../board/boardFormat';
import { memberSummary, orderedMembers } from './groupSelectors';
import './MembersPage.css';

// `details` is the Group details page of Flow D: the same page, with each member's status shown as
// Ready or Still picking, and the call to pick itinerary preferences at the end.
export default function MembersPage({ details = false }) {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { status, data: group, error, reload } = useAsync(() => getGroup(groupId), [groupId]);
  const prefs = useAsync(details ? () => getPreferences(groupId, { prepare: false }) : () => Promise.resolve(null), [groupId, details]);
  // The viewer's chosen flights, for the pay step. A member with none simply has no booking yet.
  const booking = useAsync(() => getBooking(groupId).catch(() => null), [groupId]);
  const [justCopied, setJustCopied] = useState(false);
  const resetTimer = useRef();
  const urlRef = useRef(null);
  const copy = COPY.members;

  useDocumentTitle(group ? group.name : status === 'loading' ? undefined : 'Group');
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const frame = (title, body) => (
    <Screen>
      <StatusBar />
      <PageHeader title={title} onBack={() => navigate(details ? `/groups/${groupId}/invite` : '/groups')} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (status === 'loading' || (details && (prefs.status === 'loading' || (prefs.status === 'success' && !prefs.data)))) return frame('Group', <LoadingState />);
  if (status === 'error') {
    if (error instanceof ApiError && error.status === 404) {
      return frame(
        copy.notFoundTitle,
        <StateMessage mark="!" tone="sand" title={copy.notFoundTitle} text={copy.notFoundText}>
          <Button to="/groups">{COPY.invite.declined.back}</Button>
        </StateMessage>,
      );
    }
    return frame('Group', <ErrorState error={error} onRetry={reload} />);
  }
  // Someone who has not joined yet is sent to the invitation first.
  if (!group.viewerId) return <Navigate to={`/invite/${group.code}`} replace />;

  if (details && prefs.status === 'error') {
    return frame(
      'Group',
      prefs.error instanceof ApiError && prefs.error.code === 'no_suggestions' ? (
        <StateMessage mark="!" tone="sand" title={COPY.prefs.noSuggestionsTitle} text={prefs.error.message}>
          <Button to={`/groups/${group.id}/invite`}>{COPY.invite.declined.back}</Button>
        </StateMessage>
      ) : (
        <ErrorState error={prefs.error} onRetry={prefs.reload} />
      ),
    );
  }
  const readyIds = new Set((prefs.data?.readiness ?? []).filter((m) => m.ready).map((m) => m.userId));
  const members = orderedMembers(group).map((member) => (details ? { ...member, status: readyIds.has(member.userId) ? 'ready' : 'choosing' } : member));
  const showRights = members.length > 1 || group.inviteCopied;
  const url = group.inviteUrl;

  const showCopied = () => {
    setJustCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setJustCopied(false), 4000);
    markInviteCopied(group.id).catch(() => {});
  };

  const onCopy = async () => {
    if (await copyText(url)) {
      showCopied();
      return;
    }
    // Clipboard blocked by the browser: select the link so it can be copied by hand.
    if (urlRef.current) {
      const range = document.createRange();
      range.selectNodeContents(urlRef.current);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
    toast(copy.copyFailed);
  };

  const onShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: group.name, text: `Join ${group.name} on Cathay Together`, url });
        return;
      } catch (shareError) {
        if (shareError?.name === 'AbortError') return;
      }
    }
    await onCopy();
  };

  const categories = details ? groupPreferencePlaces(prefs.data.places) : [];
  const preferencesPath = `/groups/${group.id}/preferences`;
  const preferencesEntry = prefs.data?.saved ? `${preferencesPath}/saved` : preferencesPath;
  // Where the viewer is in the journey (their own flight status, before it is relabelled Ready/Choosing).
  const flightStatus = group.members.find((m) => m.userId === group.viewerId)?.status;
  const viewer = members.find((m) => m.isViewer);
  const nextCopy = COPY.nextStep;
  const legs = [
    { label: nextCopy.outbound, leg: booking.data?.outbound },
    { label: nextCopy.return, leg: booking.data?.return },
  ].filter((item) => item.leg);
  const readyCount = members.filter((m) => m.status === 'ready').length;
  return frame(
    group.name,
    <main className="members gd">
      <TripContext
        photo={TRIP_PHOTO}
        title={group.destination}
        meta={[
          { icon: '/assets/ui-calendar-teal.svg', text: group.datesLabel },
          { icon: '/assets/ui-users-group.svg', text: memberSummary(members) },
        ]}
      />

      <section className="gd__card" aria-labelledby="members-heading">
        <div className="gd__head">
          <span className="gd__tile gd__tile--teal" aria-hidden="true">
            <img src="/assets/ui-users-group.svg" alt="" />
          </span>
          <h2 className="gd__title" id="members-heading">
            {copy.heading}
          </h2>
          {details && <Chip tone="tint">{COPY.prefs.readyOf(readyCount, members.length)}</Chip>}
        </div>
        <Link className="gd__link" to={`/groups/${group.id}/flights/search`}>
          <span className="gd__tile gd__tile--teal" aria-hidden="true">
            <img src="/assets/ui-plane-teal.svg" alt="" />
          </span>
          <span className="gd__link-text">{copy.pickFlightPlain}</span>
          <img className="gd__chevron" src="/assets/ui-chevron-teal.svg" alt="" />
        </Link>
        <Link className="gd__link" to={`/groups/${group.id}/board`}>
          <span className="gd__tile gd__tile--teal" aria-hidden="true">
            <img src="/assets/ui-list.svg" alt="" />
          </span>
          <span className="gd__link-text">{copy.viewFlights}</span>
          <img className="gd__chevron" src="/assets/ui-chevron-teal.svg" alt="" />
        </Link>
        {!details && flightStatus === 'booked' && (
        <Link className="gd__link" to={`/groups/${group.id}/details`}>
          <span className="gd__tile gd__tile--teal" aria-hidden="true">
            <img src="/assets/ui-heart-teal.svg" alt="" />
          </span>
          <span className="gd__link-text">{COPY.prefs.link}</span>
          <img className="gd__chevron" src="/assets/ui-chevron-teal.svg" alt="" />
        </Link>
      )}
      {showRights && (
          <p className="gd__note">
            <img src="/assets/ui-check-teal.svg" alt="" />
            {copy.equalRights}
          </p>
        )}
        <ul className="member-list">
          {members.map((member) => (
            <MemberRow key={member.userId} member={member} />
          ))}
        </ul>
      </section>

      {flightStatus !== 'booked' && flightStatus !== 'picked' && (
        <NextStep step={1}>
          <h3 className="next-step__title">{nextCopy.pickTitle}</h3>
          <p className="next-step__text">{nextCopy.pickText(viewer.airport.city, group.destination)}</p>
          <Button size="lg" to={`/groups/${group.id}/flights/search`}>
            {nextCopy.pickButton}
          </Button>
        </NextStep>
      )}
      {flightStatus === 'picked' && (
        <NextStep step={2}>
          <h3 className="next-step__title">{nextCopy.payTitle}</h3>
          {legs.length > 0 && (
            <ul className="next-step__flights">
              {legs.map(({ label, leg }) => (
                <li className="next-step__flight" key={label}>
                  <strong>
                    {leg.from} → {leg.to} · {leg.flightNo}
                  </strong>
                  <span>
                    {label} · {shortDate(leg.date)} · {leg.departTime} to {leg.arriveTime}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button size="lg" to={`/groups/${group.id}/board?sheet=book`}>
            {nextCopy.payButton}
          </Button>
          <p className="next-step__note">{nextCopy.payNote}</p>
        </NextStep>
      )}
      {details && flightStatus === 'booked' && (
        prefs.data.itineraryBuilt ? (
          <NextStep step={4}>
            <h3 className="next-step__title">{nextCopy.itineraryTitle}</h3>
            <p className="next-step__text">{nextCopy.itineraryText(readyCount)}</p>
            <Button size="lg" to={`/groups/${group.id}/itinerary`}>
              {COPY.prefs.viewItinerary}
            </Button>
            <Button size="lg" variant="secondary" to={preferencesEntry}>
              <img className="gd__button-icon" src="/assets/ui-heart-teal.svg" alt="" />
              {prefs.data.saved ? COPY.prefs.viewReadiness : COPY.prefs.start}
            </Button>
          </NextStep>
        ) : (
          <>
            <NextStep step={3}>
              <div className="gd__head">
                <span className="gd__tile gd__tile--teal" aria-hidden="true">
                  <img src="/assets/ui-heart-teal.svg" alt="" />
                </span>
                <h3 className="gd__callout-title">{COPY.prefs.calloutTitle}</h3>
              </div>
              <p className="gd__callout-text">{COPY.prefs.calloutShort}</p>
              <ul className="gd__photos">
                {categories.filter(({ places }) => places.length).map(({ id, places: [place] }) => (
                  <li key={id}>
                    <img src={place.thumb} alt="" referrerPolicy="no-referrer" onError={fallbackTo(place.category_key)} />
                    <span>{place.category.split(' & ')[0]}</span>
                  </li>
                ))}
              </ul>
              <p className="gd__callout-meta">{COPY.prefs.calloutMeta}</p>
            </NextStep>
            <Button size="lg" to={preferencesEntry}>
              <img className="gd__button-icon" src="/assets/ui-heart-light.svg" alt="" />
              {prefs.data.saved ? COPY.prefs.viewReadiness : COPY.prefs.start}
            </Button>
          </>
        )
      )}

      <section className="gd__card" aria-labelledby="invite-heading">
        <div className="gd__head">
          <span className="gd__tile gd__tile--teal" aria-hidden="true">
            <img src="/assets/ui-link-teal.svg" alt="" />
          </span>
          <h2 className="gd__title" id="invite-heading">
            {copy.inviteHeading}
          </h2>
          <button className="gd__share" type="button" onClick={onShare}>
            {COPY.prefs.share}
          </button>
        </div>
        <div className="invite-link">
          <p ref={urlRef} className={`invite-link__url${justCopied ? ' invite-link__url--copied' : ''}`}>
            {url}
            {justCopied && (
              <>
                {'        '}
                <span className="invite-link__copied">{copy.copied}</span>
              </>
            )}
          </p>
          <button
            className={`invite-link__copy${justCopied ? ' invite-link__copy--alt' : ''}`}
            type="button"
            onClick={onCopy}
            aria-label={copy.copyLabel}
          >
            <span className="invite-link__copy-elements">
              <img src={justCopied ? '/assets/c9816.svg' : '/assets/76582.svg'} alt="" />
            </span>
          </button>
        </div>
        <span className="sr-only" role="status">
          {justCopied ? copy.copiedAnnouncement : ''}
        </span>
      </section>

      <aside className="gd__friends">
        <span className="gd__tile gd__tile--peach" aria-hidden="true">
          <img src="/assets/ui-plane-peach.svg" alt="" />
        </span>
        <div className="gd__friends-text">
          <h3 className="guidance__title">{copy.guidanceTitle}</h3>
          <p className="guidance__text">{copy.guidanceText}</p>
        </div>
      </aside>

    </main>,
  );
}
