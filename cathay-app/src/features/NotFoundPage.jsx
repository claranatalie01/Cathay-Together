import Screen from '../components/layout/Screen';
import StatusBar from '../components/layout/StatusBar';
import PageHeader from '../components/layout/PageHeader';
import BottomNav from '../components/layout/BottomNav';
import Button from '../components/ui/Button';
import { COPY } from '../data/copy';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import './Placeholder.css';

export default function NotFoundPage() {
  const copy = COPY.notFound;
  useDocumentTitle(copy.title);

  return (
    <Screen>
      <StatusBar />
      <PageHeader title={copy.title} />
      <main className="placeholder">
        <p className="placeholder__text">{copy.text}</p>
        <Button to="/groups/new">{copy.action}</Button>
      </main>
      <BottomNav variant="groups" />
    </Screen>
  );
}
