import { useNavigate, useParams } from 'react-router-dom';
import Screen from '../components/layout/Screen';
import StatusBar from '../components/layout/StatusBar';
import PageHeader from '../components/layout/PageHeader';
import BottomNav from '../components/layout/BottomNav';
import { COPY } from '../data/copy';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import './Placeholder.css';

// Stand-in for screens that arrive in a later review round, and for the bottom
// tabs that have no designed screen.
export default function ComingSoonPage({ later = false }) {
  const navigate = useNavigate();
  const { tab } = useParams();
  const copy = COPY.comingSoon;
  const title = later ? copy.heading : (tab ?? 'Not in demo').replace(/-/g, ' ');
  useDocumentTitle(title);

  return (
    <Screen>
      <StatusBar />
      <PageHeader title={title} onBack={() => navigate(-1)} />
      <main className="placeholder">
        <p className="placeholder__text">{later ? copy.text : copy.otherTab}</p>
      </main>
      <BottomNav variant="groups" />
    </Screen>
  );
}
