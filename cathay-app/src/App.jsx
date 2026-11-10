import { useEffect, useRef } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import ComingSoonPage from './features/ComingSoonPage';
import NotFoundPage from './features/NotFoundPage';
import { ResetPage } from './demo';
import DesignSystemPage from './design-system/DesignSystemPage';
import GroupsPage from './features/groups/GroupsPage';
import CreateGroupPage from './features/groups/CreateGroupPage';
import InvitePage from './features/groups/InvitePage';
import MembersPage from './features/groups/MembersPage';
import BuildingPage from './features/itinerary/BuildingPage';
import ItineraryPage from './features/itinerary/ItineraryPage';
import PlaceDetailPage from './features/itinerary/PlaceDetailPage';
import PreferencePage from './features/preferences/PreferencePage';
import SavedPage from './features/preferences/SavedPage';
import BoardPage from './features/board/BoardPage';
import ConfirmedPage from './features/board/ConfirmedPage';
import PaymentPage from './features/board/PaymentPage';
import FareSelectPage from './features/flights/FareSelectPage';
import FlightResultsPage from './features/flights/FlightResultsPage';
import FlightSearchPage from './features/flights/FlightSearchPage';

// Dark canvas around the phone-sized screens. After each navigation the page
// scrolls to the top and the new page title receives focus, so keyboard and
// screen-reader users land at the start of the new page.
function AppShell() {
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (first.current) {
      first.current = false;
      return;
    }
    document.querySelector('[data-page-title]')?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="app">
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Style guide: its own wide page, no phone frame and no demo panel. */}
        <Route path="design-system" element={<DesignSystemPage />} />
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/groups/new" replace />} />
          <Route path="reset" element={<ResetPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="groups/new" element={<CreateGroupPage />} />
          <Route path="groups/:groupId/invite" element={<MembersPage key="members" />} />
          <Route path="invite/:code" element={<InvitePage />} />
          <Route path="groups/:groupId/details" element={<MembersPage key="details" details />} />
          <Route path="groups/:groupId/preferences/saved" element={<SavedPage />} />
          <Route path="groups/:groupId/preferences/:category" element={<PreferencePage />} />
          <Route path="groups/:groupId/itinerary/building" element={<BuildingPage />} />
          <Route path="groups/:groupId/itinerary/places/:stopId" element={<PlaceDetailPage />} />
          <Route path="groups/:groupId/itinerary" element={<ItineraryPage />} />
          <Route path="groups/:groupId/board" element={<BoardPage />} />
          <Route path="groups/:groupId/payment" element={<PaymentPage />} />
          <Route path="groups/:groupId/confirmed" element={<ConfirmedPage />} />
          <Route path="groups/:groupId/flights/search" element={<FlightSearchPage />} />
          <Route path="groups/:groupId/flights/outbound" element={<FlightResultsPage direction="outbound" />} />
          <Route path="groups/:groupId/flights/return" element={<FlightResultsPage direction="return" />} />
          <Route path="groups/:groupId/flights/:direction/:flightId/fares" element={<FareSelectPage />} />
          {/* Later review rounds replace these placeholders. */}
          <Route path="groups/:groupId/*" element={<ComingSoonPage later />} />
          <Route path="coming-soon/:tab" element={<ComingSoonPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
