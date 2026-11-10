import { ApiError } from '../../api';
import Button from './Button';
import StateMessage from './StateMessage';

const UNREACHABLE = 'We could not reach the service. Check your connection and try again.';

// Error message with a Retry action, for failed loads.
export default function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  const text = error instanceof ApiError && error.status < 500 ? error.message : UNREACHABLE;
  return (
    <StateMessage role="alert" mark="!" tone="sand" title={title} text={text}>
      <Button onClick={onRetry}>Retry</Button>
    </StateMessage>
  );
}
