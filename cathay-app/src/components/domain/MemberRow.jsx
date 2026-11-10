import { MEMBER_STATUS } from '../../data/memberStatus';
import Chip from '../ui/Chip';
import './MemberRow.css';

// One member of a travel group: avatar, name, home airport and flight status.
// With `flights` ({ arrive, leave } or null) it becomes a card that also shows when this member
// lands in Tokyo and when they leave (the group board).
export default function MemberRow({ member, flights, destination }) {
  const status = MEMBER_STATUS[member.status];
  const name = `${member.name}${member.isViewer ? ' (you)' : ''}${member.isCreator ? ' · Creator' : ''}`;
  const origin = destination ? (
    <>
      {member.airport.code} <img className="member__plane" src="/assets/ui-plane-dark.svg" alt="" />
      <span className="sr-only">to</span> {destination}
    </>
  ) : (
    `${member.airport.code} · ${member.airport.city}`
  );
  const head = (
    <>
      <span className="member__avatar" aria-hidden="true">
        {member.initial}
      </span>
      <div className="member__details">
        <p className="member__name">{name}</p>
        <p className="member__origin">{origin}</p>
      </div>
      <Chip tone={status.tone}>
        {member.status === 'ready' && <img className="member__tick" src="/assets/ui-check-teal.svg" alt="" />}
        {status.label}
      </Chip>
    </>
  );
  if (flights === undefined) return <li className="member">{head}</li>;

  return (
    <li className="member member--card">
      <div className="member__head">{head}</div>
      {flights ? (
        <dl className="member__flights">
          {[
            ['arrive', 'Arrives', 'ui-plane-arrival.svg', flights.arrive],
            ['leave', 'Leaves', 'ui-plane-departure.svg', flights.leave],
          ].map(([key, verb, icon, leg]) => (
            <div className={`member__leg member__leg--${key}`} key={key}>
              <dt>
                <img src={`/assets/${icon}`} alt="" />
                {verb} {leg.dateLabel}
              </dt>
              <dd>
                <strong>{leg.time}</strong> {leg.airport} · {leg.flightNo}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="member__none">{member.status === 'invited' ? 'Invited. Flights appear after they join.' : 'No flights picked yet.'}</p>
      )}
    </li>
  );
}
