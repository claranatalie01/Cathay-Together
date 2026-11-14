import { useState } from 'react';
import BonusTeaser from '../components/domain/BonusTeaser';
import GroupCard from '../components/domain/GroupCard';
import MemberRow from '../components/domain/MemberRow';
import SectionHeading from '../components/domain/SectionHeading';
import TripContext from '../components/domain/TripContext';
import BottomNav from '../components/layout/BottomNav';
import PageHeader from '../components/layout/PageHeader';
import Screen from '../components/layout/Screen';
import StatusBar from '../components/layout/StatusBar';
import ComparisonTable from '../components/domain/ComparisonTable';
import FareCard from '../components/domain/FareCard';
import FlightCard from '../components/domain/FlightCard';
import PhotoHeader from '../components/domain/PhotoHeader';
import Price from '../components/ui/Price';
import SegmentedControl from '../components/ui/SegmentedControl';
import Timeline from '../components/domain/Timeline';
import Countdown from '../components/ui/Countdown';
import Dialog from '../components/ui/Dialog';
import ChoicePill from '../components/ui/ChoicePill';
import Slider from '../components/ui/Slider';
import StepProgress from '../components/ui/StepProgress';
import NextStep from '../components/domain/NextStep';
import StatTile from '../components/ui/StatTile';
import ItineraryStop from '../components/domain/ItineraryStop';
import TravelConnector from '../components/domain/TravelConnector';
import SuggestionCard from '../components/domain/SuggestionCard';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import Field from '../components/ui/Field';
import LoadingState from '../components/ui/LoadingState';
import Sheet from '../components/ui/Sheet';
import CalendarSheet from '../components/ui/CalendarSheet';
import StateMessage from '../components/ui/StateMessage';
import { useToast } from '../components/ui/Toast';
import { pickPhoto } from '../data/photos';
import { TRIP_PHOTO } from '../data/trip';
import '../features/board/BoardPage.css';
import Badge from './Badge';
import { CHECKLIST, PLANNED } from './catalog';

function Block({ id, title, figma, proposal, rule, children }) {
  return (
    <section className="ds-block" aria-labelledby={id}>
      <div className="ds-block__head">
        <h3 className="ds-block__title" id={id}>
          {title}
        </h3>
        {figma && <Badge kind="source" />}
        {proposal && <Badge kind="proposal" />}
      </div>
      {figma && <p className="ds-block__text">Figma: {figma}</p>}
      {proposal && <p className="ds-block__text">Proposal: {proposal}</p>}
      {rule && <p className="ds-block__rule">Rule: {rule}</p>}
      {children}
    </section>
  );
}

const Spec = ({ label, children }) => (
  <div className="ds-spec">
    <span className="ds-spec__label">{label}</span>
    {children}
  </div>
);

const SAMPLE_MEMBERS = [
  { userId: 'gaudi', name: 'Gaudi', initial: 'G', airport: { code: 'SIN', city: 'Singapore' }, status: 'booked', isCreator: true },
  { userId: 'clara', name: 'Clara', initial: 'C', airport: { code: 'HKG', city: 'Hong Kong' }, status: 'picked', isViewer: true },
  { userId: 'c', name: 'Mei', initial: 'M', airport: { code: 'TPE', city: 'Taipei' }, status: 'browsing' },
];

const noop = () => {};

const SAMPLE_FLIGHT = { id: 'f1', flightNo: 'CX548', from: 'HKG', to: 'HND', departTime: '08:55', arriveTime: '13:45', duration: '3h 50m', operatedBy: null, seatsLeft: 9, lowest: false, priceFrom: 6691 };
const SAMPLE_FARES = [
  { id: 'light', name: 'Light', tagline: 'Good value', recommended: false, price: 6691, rows: { seat: 'For a fee', baggage: '1×23kg', changeFee: 1200, cancelFee: 1400 } },
  { id: 'essential', name: 'Essential', tagline: null, recommended: true, price: 7141, rows: { seat: 'Free (Regular)', baggage: '2×23kg', changeFee: 1000, cancelFee: 1200 } },
];
const SAMPLE_TABLE = [
  { group: 'Free seat select', rows: [{ label: 'Regular seat', values: { light: false, essential: true, flex: true } }] },
  { group: 'Flexibility', rows: [{ label: 'Flight change fee', values: { light: 1200, essential: 1000, flex: 0 } }] },
];

const SAMPLE_PLACE = { id: 'food', category: 'Food', name: 'Tsukiji Outer Market', area: 'Tsukiji · Chuo City', description: 'Taste fresh seafood bowls and warm tamagoyaki as you wander Tokyo’s lively market lanes.', budget: '¥2,000–3,500', duration: '1–1.5 hrs', bestTime: 'Morning', tip: 'Go before 10am; some stalls are cash-only.', photo: '/assets/ab624.png', alt: 'Seafood rice bowl at Tsukiji Outer Market' };

function PreferenceBlock() {
  const [choice, setChoice] = useState('like');
  return (
    <Block id="ds-prefs" title="Itinerary preferences: suggestion card and progress" figma="from the original Cathay Together prototype." proposal="hover and pressed states; the Choosing member chip." rule="Swipe the card or use the arrow keys while it has focus. Right likes and left passes.">
      <div className="ds-specs">
        <Spec label="Next step card"><NextStep step={2}><p className="next-step__title">Your flight is picked. Review and pay</p></NextStep></Spec>
        <Spec label="Step progress"><StepProgress label="Tokyo · Your picks" current={2} total={4} stepText="2 of 4" /></Spec>
        <Spec label="Choice pills">
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <ChoicePill tone="pass" selected={choice === 'pass'} icon="/assets/9a5a4.svg" onClick={() => setChoice('pass')}>← Pass</ChoicePill>
            <ChoicePill tone="like" selected={choice === 'like'} icon="/assets/5ea58.svg" onClick={() => setChoice('like')}>Like →</ChoicePill>
          </div>
        </Spec>
        <Spec label="Suggestion card (swipe right to like, left to pass)"><SuggestionCard place={SAMPLE_PLACE} choice="like" onChoose={noop} /></Spec>
        <Spec label="Suggestion card (passed)"><SuggestionCard place={SAMPLE_PLACE} choice="pass" onChoose={noop} /></Spec>
      </div>
    </Block>
  );
}

const SAMPLE_STOP = { id: 's1', kind: 'place', source: 'voted', slot: 'Morning', name: 'Sensō-ji & Asakusa', minutes: 120, durationLabel: '1.5–2 hrs', costLabel: '¥0 entry · ¥1,000 extras', description: 'Temple courtyards & Nakamise small shops.', thumb: '/assets/71254.png', alt: 'Senso-ji temple', liked: 2, total: 3 };

function ItineraryBlock() {
  return (
    <Block id="ds-itinerary" title="Itinerary: stops, connector, stat tiles" figma="from the original Cathay Together prototype." proposal="the connector, the stat tiles and the edit buttons are new (the prototype draws them as fixed positions)." rule="A voted stop shows its real vote count; a stop that was not voted on says Suggested and never shows a count. Booked flights are fixed and cannot be moved.">
      <div className="ds-specs">
        <Spec label="Stat tiles">
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            <StatTile icon="/assets/ui-pin-teal.svg" tone="teal" value="7 places" label="1 voted · 6 suggested" />
            <StatTile icon="/assets/ui-yen-sand.svg" tone="sand" value="¥12,000" label="Est. / person" />
          </div>
        </Spec>
        <Spec label="Booked flight, arrival"><ItineraryStop stop={{ id: 'a', kind: 'flight-arrival', from: 'HKG', to: 'HND', date: '2026-11-07', flightNo: 'CX500', departTime: '11:20', arriveTime: '16:10' }} /></Spec>
        <Spec label="Booked flight, departure"><ItineraryStop stop={{ id: 'd', kind: 'flight-departure', from: 'HND', to: 'HKG', date: '2026-11-10', flightNo: 'CX6321', departTime: '15:35', arriveTime: '18:25' }} /></Spec>
        <Spec label="Travel connector"><TravelConnector minutes={60} text="by train · airport to city" /></Spec>
        <Spec label="Voted stop"><ItineraryStop stop={SAMPLE_STOP} to="/design-system" /></Spec>
        <Spec label="Suggested stop"><ItineraryStop stop={{ ...SAMPLE_STOP, source: 'suggested', name: 'Neighbourhood ramen', durationLabel: undefined, minutes: 60, costLabel: '¥1,500' }} to="/design-system" /></Spec>
        <Spec label="Edit mode"><ItineraryStop stop={SAMPLE_STOP} editing canUp={false} canDown onUp={noop} onDown={noop} onRemove={noop} /></Spec>
      </div>
    </Block>
  );
}

function FlightBookingBlock() {
  const [trip, setTrip] = useState('return');
  const [cabin, setCabin] = useState('economy');
  const [hours, setHours] = useState(1);
  return (
    <Block
      id="ds-flights"
      title="Flight booking: tabs, segments, cards, table"
      figma="not in the Figma file as built components."
      proposal="hover, pressed and focus states, the Flex strip colour, and the photo-header overlay. Everything else follows the real-app screenshots (S1, S5, S6, S9)."
      rule="Tabs choose a view; segments choose a cabin; a flight card is one link; fare cards show one fare each. Prices are always a Price (currency regular, amount bold)."
    >
      <div className="ds-specs">
        <Spec label="Tabs (brand)">
          <Tabs label="Trip type" value={trip} onChange={setTrip} tabs={[{ id: 'return', label: 'Return' }, { id: 'oneway', label: 'One way' }]} />
        </Spec>
        <Spec label="Tabs (deep, with sub-label, unavailable)">
          <Tabs label="Dates" tone="deep" value="b" onChange={noop} tabs={[{ id: 'a', label: 'Thu, 5 Nov', sub: 'Not available', disabled: true }, { id: 'b', label: 'Sat, 7 Nov', sub: 'HKD5,531' }]} />
        </Spec>
        <Spec label="Segmented control">
          <SegmentedControl name="ds-cabin" label="Cabin class" value={cabin} onChange={setCabin} options={[{ id: 'economy', label: 'Economy' }, { id: 'premium', label: 'Premium Econo…', sub: '+HKD8,931' }, { id: 'business', label: 'Business', sub: '+HKD13,101' }]} />
        </Spec>
        <Spec label="Slider"><Slider id="ds-slider" label="Group timing window" valueText={`Within ${hours} ${hours === 1 ? 'hour' : 'hours'}`} help="Show flights that land in Tokyo, and leave Tokyo, within this time of your friends." min={1} max={6} value={hours} onChange={setHours} /></Spec>
        <Spec label="Price"><Price amount={6691} /></Spec>
        <Spec label="Flight card"><FlightCard flight={SAMPLE_FLIGHT} to="/design-system" /></Spec>
        <Spec label="Recommended group flight"><FlightCard flight={SAMPLE_FLIGHT} match={{ tone: 'within', text: 'Recommended' }} gap="Land together" fareLabel="Your fare from" to="/design-system" /></Spec>
        <Spec label="Flight card, within the window"><FlightCard flight={SAMPLE_FLIGHT} match={{ tone: 'within', text: 'Within 1h of everyone' }} to="/design-system" /></Spec>
        <Spec label="Flight card, outside the window"><FlightCard flight={SAMPLE_FLIGHT} match={{ tone: 'outside', text: 'Outside your window +2h' }} to="/design-system" /></Spec>
        <Spec label="Flight card, hover"><FlightCard className="is-hover" flight={{ ...SAMPLE_FLIGHT, lowest: true, seatsLeft: null }} to="/design-system" /></Spec>
        <Spec label="Fare card, Light"><FareCard fare={SAMPLE_FARES[0]} onSelect={noop} onCompare={noop} /></Spec>
        <Spec label="Fare card, Essential"><FareCard fare={SAMPLE_FARES[1]} onSelect={noop} onCompare={noop} /></Spec>
        <Spec label="Button sizes">
          <Button size="lg">Continue (56)</Button>
          <Button size="sm">Select (38)</Button>
        </Spec>
        <Spec label="Peach chip"><Chip tone="peach">Recommended</Chip></Spec>
      </div>
      <div className="ds-frames">
        <Screen className="ds-frame ds-frame--short"><PhotoHeader titleAs="h4" titleId="ds-photo-title" photo={pickPhoto('Tokyo', 'tokyo-together')} eyebrow="Return" title="Hong Kong to Tokyo" subtitle="(Sat) 7 Nov - (Tue) 10 Nov" onBack={noop} onEdit={noop} /></Screen>
      </div>
      <div className="ds-specs">
        <Spec label="Comparison table"><ComparisonTable columns={['light', 'essential', 'flex']} names={{ light: 'Light', essential: 'Essential', flex: 'Flex' }} groups={SAMPLE_TABLE} caption="Sample comparison" /></Spec>
      </div>
    </Block>
  );
}

function ButtonBlock() {
  return (
    <Block
      id="ds-button"
      title="Button"
      figma="primary and secondary, 52px full width."
      proposal="hover, pressed, focus, disabled and loading (Figma has none)."
      rule="One primary button per screen. Loading keeps the label, sets disabled and aria-busy. Disabled is only for actions that cannot run yet."
    >
      <div className="ds-specs">
        <Spec label="Primary"><Button>Create group</Button></Spec>
        <Spec label="Secondary"><Button variant="secondary">Back to groups</Button></Spec>
        <Spec label="Destructive"><Button variant="destructive">Delete group</Button></Spec>
        <Spec label="Hover"><Button className="is-hover">Create group</Button></Spec>
        <Spec label="Pressed"><Button className="is-pressed">Create group</Button></Spec>
        <Spec label="Focus"><Button className="is-focus">Create group</Button></Spec>
        <Spec label="Disabled"><Button disabled>Create group</Button></Spec>
        <Spec label="Loading"><Button disabled aria-busy="true">Creating…</Button></Spec>
        <Spec label="Secondary hover"><Button variant="secondary" className="is-hover">Back to groups</Button></Spec>
      </div>
    </Block>
  );
}

function ChipBlock() {
  return (
    <Block id="ds-chip" title="Chip" figma="neutral, tint, sand and primary tones." rule="Status only; chips are not interactive. Never rely on colour alone: the label carries the meaning.">
      <div className="ds-specs ds-specs--row">
        <Spec label="Neutral"><Chip>Browsing</Chip></Spec>
        <Spec label="Primary"><Chip tone="primary">Picked</Chip></Spec>
        <Spec label="Sand"><Chip tone="sand">Booked</Chip></Spec>
        <Spec label="Tint"><Chip tone="tint">Invited</Chip></Spec>
      </div>
    </Block>
  );
}

function FieldBlock() {
  return (
    <Block
      id="ds-field"
      title="Field"
      figma="default text field and select with icon."
      proposal="hover, focus, error and disabled. Error and focus keep the Figma border colour logic; a stronger border is a separate proposal."
      rule="Every field has a visible label. Errors appear under the field, use role=alert and are linked with aria-describedby."
    >
      <div className="ds-specs">
        <Spec label="Default">
          <Field id="ds-f1" label="Group name"><input className="field__text" id="ds-f1" defaultValue="Tokyo together" /></Field>
        </Spec>
        <Spec label="Hover">
          <Field id="ds-f2" label="Group name" valueClassName="is-hover"><input className="field__text" id="ds-f2" defaultValue="Tokyo together" /></Field>
        </Spec>
        <Spec label="Focus">
          <Field id="ds-f3" label="Group name" valueClassName="is-focus"><input className="field__text" id="ds-f3" defaultValue="Tokyo together" /></Field>
        </Spec>
        <Spec label="Error">
          <Field id="ds-f4" label="Group name" error="Enter a group name."><input className="field__text" id="ds-f4" aria-invalid="true" aria-describedby="ds-f4-error" /></Field>
        </Spec>
        <Spec label="Disabled">
          <Field id="ds-f5" label="Group name" disabled><input className="field__text" id="ds-f5" defaultValue="Tokyo together" disabled /></Field>
        </Spec>
        <Spec label="Select">
          <Field id="ds-f6" label="Dates" disclosure="▾">
            <select className="field__text" id="ds-f6" defaultValue="a"><option value="a">Nov 21–24, 2026</option></select>
          </Field>
        </Spec>
      </div>
    </Block>
  );
}

function CardBlock() {
  return (
    <Block id="ds-cards" title="Cards and rows" figma="trip context, group card, member row, bonus teaser, section heading." proposal="hover and pressed on the group card." rule="A whole card is one link; do not nest a second link or button inside it.">
      <div className="ds-specs">
        <Spec label="Group card"><GroupCard to="/groups" photo={TRIP_PHOTO} name="Tokyo together" meta="Nov 21–24, 2026" status="3 members" chip={{ tone: 'tint', label: 'Invited' }} /></Spec>
        <Spec label="Group card, hover"><GroupCard className="is-hover" to="/groups" photo={TRIP_PHOTO} name="Tokyo together" meta="Nov 21–24, 2026" status="3 members" chip={{ tone: 'tint', label: 'Invited' }} /></Spec>
        <Spec label="Group card, pressed"><GroupCard className="is-pressed" to="/groups" photo={TRIP_PHOTO} name="Tokyo together" meta="Nov 21–24, 2026" status="3 members" chip={{ tone: 'tint', label: 'Invited' }} /></Spec>
        <Spec label="Trip context"><TripContext photo={TRIP_PHOTO} title="Tokyo, Japan" dates="Nov 21–24, 2026" status="Group set up" /></Spec>
        <Spec label="Member rows"><ul className="ds-list">{SAMPLE_MEMBERS.map((member) => <MemberRow key={member.userId} member={member} />)}</ul></Spec>
        <Spec label="Section heading"><SectionHeading title="Members" action={<button className="section-heading__action" type="button">Share invite</button>} /></Spec>
        <Spec label="Bonus teaser"><BonusTeaser heading="Book together, earn more" text="Sample copy for the bonus teaser." /></Spec>
      </div>
    </Block>
  );
}

function LayoutBlock() {
  return (
    <Block id="ds-layout" title="Status bar, page header, bottom nav" figma="all three; bottom nav shows Travel Groups or Book active." proposal="hover and pressed on the back button and tabs (real pseudo-classes only; try them below)." rule="Every screen starts with status bar and page header. The page title is the h1 and takes focus after navigation.">
      <div className="ds-frames">
        <Screen className="ds-frame ds-frame--short"><StatusBar /><PageHeader title="Page title" titleAs="h4" titleId="ds-page-title" onBack={noop} /></Screen>
        <Screen className="ds-frame ds-frame--short"><BottomNav variant="groups" /></Screen>
      </div>
    </Block>
  );
}

function SheetBlock() {
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const toast = useToast();
  return (
    <Block id="ds-overlay" title="Sheet, state message, skeleton, toast" figma="sheet with handle; confirmation and building states." proposal="empty, error and unavailable messages, skeleton and toast." rule="Messages say what happened and what to do next. Sheets trap focus, close on Escape and return focus to the opener.">
      <div className="ds-frames">
        <Screen className="ds-frame">
          <div className="ds-frame__body">
            <Button variant="secondary" onClick={() => setOpen(true)}>Open sheet</Button>
          </div>
          <Sheet open={open} onClose={() => setOpen(false)} title="Sheet title" titleId="ds-sheet-title">
            <p className="sheet__text">Sheet body text explains the choice.</p>
            <Button onClick={() => setOpen(false)} data-autofocus>Confirm</Button>
          </Sheet>
        </Screen>
        <Screen className="ds-frame">
          <div className="ds-frame__body">
            <Button variant="secondary" onClick={() => setCalendarOpen(true)}>Open travel dates</Button>
          </div>
          <CalendarSheet
            open={calendarOpen}
            onClose={() => setCalendarOpen(false)}
            origin="HKG"
            destination="HND"
            currency="HKD"
            rangeText="Nov 21–24"
            startText="Sat 21 Nov 2026"
            endText="Tue 24 Nov 2026"
            windowInfo={{ start: '2026-11-21', end: '2026-11-24', fares: [{ date: '2026-11-21', priceFrom: 5531 }, { date: '2026-11-22', priceFrom: 5863 }, { date: '2026-11-23', priceFrom: 5697 }, { date: '2026-11-24', priceFrom: 5365 }] }}
          />
        </Screen>
        <Screen className="ds-frame"><StateMessage as="div" mark="!" tone="sand" title="Something went wrong" text="We could not reach the service. Check your connection and try again."><Button>Retry</Button></StateMessage></Screen>
        <Screen className="ds-frame"><StateMessage as="div" mark="✓" title="Invite sent" text="Your friends can join with the link." /></Screen>
        <Screen className="ds-frame"><LoadingState as="div" variant="list" /></Screen>
      </div>
      <div className="ds-specs">
        <Spec label="Toast"><Button variant="secondary" onClick={() => toast('Link copied')}>Show toast</Button></Spec>
      </div>
    </Block>
  );
}

const BOARD_MEMBER = { userId: 'gaudi', name: 'Gaudi', initial: 'G', airport: { code: 'HKG', city: 'Hong Kong' }, status: 'booked', isViewer: false };
const BOARD_FLIGHTS = { arrive: { dateLabel: 'Sat 7 Nov', time: '16:10', airport: 'HND', flightNo: 'CX500' }, leave: { dateLabel: 'Tue 10 Nov', time: '15:35', airport: 'HND', flightNo: 'CX6321' } };
const TL_COLUMNS = [
  { id: 'a', title: 'Arrivals', dateLabel: 'Sat 7 Nov', icon: '/assets/ui-plane-arrival.svg', tone: 'arrive', spanLabel: '40m', points: [{ time: '16:10', minutes: 970, names: ['Gaudi'], includesViewer: false }, { time: '16:50', minutes: 1010, names: ['You'], includesViewer: true }] },
  { id: 'd', title: 'Departures', dateLabel: 'Tue 10 Nov', icon: '/assets/ui-plane-departure.svg', tone: 'depart', spanLabel: '55m', points: [{ time: '15:35', minutes: 935, names: ['Gaudi'], includesViewer: false }, { time: '16:30', minutes: 990, names: ['You'], includesViewer: true }] },
];

function BoardBlock() {
  const [open, setOpen] = useState(false);
  return (
    <Block id="ds-board" title="Group board: member card, timeline, countdown, dialog" proposal="timeline, countdown ring, dialog, and the teal / steel-blue direction colours (the member card follows the prototype board)." rule="Direction is carried by the icon and label as well as colour. Show a time once; share a marker when times match.">
      <div className="ds-specs">
        <Spec label="Member card"><ul className="ds-list"><MemberRow member={BOARD_MEMBER} destination="HND" flights={BOARD_FLIGHTS} /></ul></Spec>
        <Spec label="Member card, no flights"><ul className="ds-list"><MemberRow member={{ ...BOARD_MEMBER, name: 'Clara', initial: 'C', status: 'invited', airport: { code: 'SHA', city: 'Shanghai' } }} destination="HND" flights={null} /></ul></Spec>
        <Spec label="Timeline"><Timeline columns={TL_COLUMNS} legend="Filled dot: your flight." /></Spec>
        <Spec label="Countdown"><Countdown expiresAt={Date.now() + 19 * 60 * 1000} totalSeconds={1200} /></Spec>
        <Spec label="Countdown, under 5 minutes"><Countdown expiresAt={Date.now() + 4 * 60 * 1000} totalSeconds={1200} /></Spec>
        <Spec label="Dialog"><Button variant="secondary" onClick={() => setOpen(true)}>Open dialog</Button></Spec>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Your fare has increased" titleId="ds-dialog-title">
        <p className="booking__note">Review the new total before paying.</p>
        <Button onClick={() => setOpen(false)} data-autofocus>Accept new price</Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>Back</Button>
      </Dialog>
    </Block>
  );
}

export function ComponentSections() {
  return (
    <section className="ds-section" aria-labelledby="ds-components">
      <h2 className="ds-section__title" id="ds-components">Components</h2>
      <p className="ds-section__text">
        These are the real components the screens use. States named Hover, Pressed and Focus are shown with
        mirror classes (<code>is-hover</code>, <code>is-pressed</code>, <code>is-focus</code>); the real
        pseudo-classes behave the same, so hover and Tab to the plain examples to see them.
      </p>
      <ButtonBlock />
      <ChipBlock />
      <FieldBlock />
      <CardBlock />
      <FlightBookingBlock />
      <PreferenceBlock />
      <ItineraryBlock />
      <BoardBlock />
      <LayoutBlock />
      <SheetBlock />
    </section>
  );
}

export function PlannedSection() {
  return (
    <section className="ds-section" aria-labelledby="ds-planned">
      <h2 className="ds-section__title" id="ds-planned">Defined in Figma, not built yet</h2>
      <p className="ds-section__text">Built from this guide when the screen that needs them arrives.</p>
      <table className="ds-table">
        <thead><tr><th scope="col">Component</th><th scope="col">Variants</th><th scope="col">Note</th></tr></thead>
        <tbody>{PLANNED.map(([name, variants, note]) => <tr key={name}><td>{name}</td><td>{variants}</td><td>{note}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

export function ChecklistSection() {
  return (
    <section className="ds-section" aria-labelledby="ds-checklist">
      <h2 className="ds-section__title" id="ds-checklist">Checklist for every screen</h2>
      <ol className="ds-checklist">{CHECKLIST.map((item) => <li key={item}>{item}</li>)}</ol>
    </section>
  );
}
