import { Link, useParams } from 'react-router-dom';
import { NAV_ICONS_V2, NAV_LABELS_V2, NAV_TABS, NAV_VARIANTS, navPath } from '../../data/nav';
import './BottomNav.css';

// Five equal items, icon above label (real app). The active tab is teal and bold.
export default function BottomNav({ variant = 'groups' }) {
  const { groupId } = useParams();
  const config = NAV_VARIANTS[variant];
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {NAV_TABS.map((tab) => {
        const isActive = config.active === tab.key;
        return (
          <Link
            key={tab.key}
            className={`bottom-nav__tab${isActive ? ' bottom-nav__tab--active' : ''}`}
            to={navPath(tab.key, groupId)}
            aria-current={isActive ? 'page' : undefined}
          >
            <img className="bottom-nav__icon" src={`/assets/${NAV_ICONS_V2[tab.key][isActive ? 'on' : 'off']}`} alt="" />
            <span className="bottom-nav__label">{NAV_LABELS_V2[tab.key]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
