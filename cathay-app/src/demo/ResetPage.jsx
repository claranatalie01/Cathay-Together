import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { resetDemo } from './demoApi';

// Visit /reset to clear the saved demo data and start again.
export function ResetPage() {
  useEffect(() => {
    resetDemo();
  }, []);
  return <Navigate to="/groups/new" replace />;
}
