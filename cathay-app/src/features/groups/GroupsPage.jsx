import { useNavigate } from 'react-router-dom';
import { getGroups } from '../../api';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import PageHeader from '../../components/layout/PageHeader';
import BottomNav from '../../components/layout/BottomNav';
import GroupCard from '../../components/domain/GroupCard';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StateMessage from '../../components/ui/StateMessage';
import { DemoControls } from '../../demo';
import { COPY } from '../../data/copy';
import { photoFor } from '../../data/trip';
import { memberSummary } from './groupSelectors';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './GroupsPage.css';

// How one group appears in the list, depending on the signed-in person's role.
function describe(group) {
  const text = COPY.groups;
  const creator = group.members.find((m) => m.userId === group.creatorId);
  if (group.viewerRole === 'invitee') {
    const declined = group.invitation === 'declined';
    return {
      to: `/invite/${group.code}`,
      chip: declined ? text.chips.declined : text.chips.invitee,
      status: declined ? text.status.declined : text.status.invited(group.members.length, creator?.name ?? 'a friend'),
    };
  }
  return {
    to: `/groups/${group.id}/invite`,
    chip: group.viewerRole === 'creator' ? text.chips.creator : text.chips.member,
    status: memberSummary(group.members),
  };
}

export default function GroupsPage() {
  const navigate = useNavigate();
  const copy = COPY.groups;
  const { status, data: groups, error, reload } = useAsync(getGroups, []);
  useDocumentTitle(copy.title);

  const frame = (body) => (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.title} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (status === 'loading') return frame(<LoadingState variant="list" />);
  if (status === 'error') return frame(<ErrorState error={error} onRetry={reload} />);

  if (groups.length === 0) {
    return frame(
      <StateMessage mark="+" title={copy.emptyTitle} text={copy.emptyText}>
        <Button onClick={() => navigate('/groups/new')}>{copy.create}</Button>
        <DemoControls context="groups" />
      </StateMessage>,
    );
  }

  return frame(
    <main className="groups">
      <p className="groups__intro">{copy.intro}</p>
      <div className="gd__head groups__head">
        <span className="gd__tile gd__tile--teal" aria-hidden="true">
          <img src="/assets/ui-users-group.svg" alt="" />
        </span>
        <h2 className="gd__title">{copy.heading}</h2>
      </div>
      <ul className="groups__list">
        {groups.map((group) => {
          const info = describe(group);
          return (
            <li key={group.id}>
              <GroupCard
                to={info.to}
                photo={photoFor(group.destination, group.id)}
                name={group.name}
                meta={`${group.destination} · ${group.datesLabel}`}
                status={info.status}
                chip={info.chip}
              />
            </li>
          );
        })}
      </ul>
      <Button to="/groups/new" className="groups__create">
        {copy.create}
      </Button>
      <DemoControls context="groups" />
    </main>,
  );
}
