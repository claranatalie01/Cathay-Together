import './PageHeader.css';

// Back button + page title. The title is the page's <h1> and receives focus
// after each route change (see AppShell).
// `titleAs` lets the style guide show a header without a second page <h1>.
export default function PageHeader({ title, titleId = 'page-title', onBack, backLabel = 'Back', titleAs: Title = 'h1', backIcon = '/assets/ui-back.svg' }) {
  return (
    <header className="page-header">
      {onBack && (
        <button className="page-header__back" type="button" onClick={onBack} aria-label={backLabel}>
          <img src={backIcon} alt="" />
        </button>
      )}
      <Title className="page-header__title" id={titleId} tabIndex={-1} data-page-title>
        {title}
      </Title>
    </header>
  );
}
