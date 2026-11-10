import { Link } from 'react-router-dom';
import './Button.css';

// Full-width action. Renders a router link when `to` is given, otherwise a <button>.
// size: 'md' (52, default), 'lg' (56: Continue, Express checkout) or 'sm' (38: Select in a fare card).
export default function Button({ to, variant = 'primary', size = 'md', type = 'button', className = '', children, ...rest }) {
  const classes = `button${variant === 'secondary' ? ' button--secondary' : ''}${size === 'md' ? '' : ` button--${size}`} ${className}`.trim();
  if (to) {
    return (
      <Link className={classes} to={to} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} type={type} {...rest}>
      {children}
    </button>
  );
}
