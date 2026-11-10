import { Link } from 'react-router-dom';
import Chip from '../ui/Chip';
import './GroupCard.css';

// One row in the Travel Groups list.
export default function GroupCard({ to, photo, name, meta, status, chip, className = '' }) {
  return (
    <Link className={`group-card ${className}`.trim()} to={to}>
      <span className="group-card__thumb">
        <img src={photo.src} alt="" />
      </span>
      <span className="group-card__summary">
        <span className="group-card__name">{name}</span>
        <span className="group-card__meta">
          <img src="/assets/ui-calendar-teal.svg" alt="" />
          {meta}
        </span>
        <span className="group-card__status">
          <img src="/assets/ui-users-group.svg" alt="" />
          {status}
        </span>
      </span>
      <Chip tone={chip.tone}>{chip.label}</Chip>
    </Link>
  );
}
