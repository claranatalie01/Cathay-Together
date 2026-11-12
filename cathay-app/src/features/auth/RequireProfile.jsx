import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ApiError, getCurrentUser } from '../../api';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import LoadingState from '../../components/ui/LoadingState';

// Sits inside RequireSession. A person who has signed in but has no profile yet (no name and
// home airport) is sent to the welcome screen, then returned to where they were going.
// Any other problem is left for the screen itself to report.
export default function RequireProfile() {
  const { pathname, search } = useLocation();
  const [state, setState] = useState('checking');

  useEffect(() => {
    let current = true;
    getCurrentUser().then(
      () => current && setState('ready'),
      (error) => current && setState(error instanceof ApiError && error.code === 'profile_not_found' ? 'needsProfile' : 'ready'),
    );
    return () => {
      current = false;
    };
  }, []);

  if (state === 'checking') {
    return (
      <Screen>
        <StatusBar />
        <LoadingState />
      </Screen>
    );
  }
  if (state === 'needsProfile') {
    return <Navigate to={`/welcome?next=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return <Outlet />;
}
