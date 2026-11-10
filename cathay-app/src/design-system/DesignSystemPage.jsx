import { useDocumentTitle } from '../hooks/useDocumentTitle';
import Badge from './Badge';
import { ChecklistSection, ComponentSections, PlannedSection } from './ComponentSections';
import { ColourSection, SpaceSection, TypographySection } from './FoundationSections';
import IconSection from './IconSection';
import './DesignSystemPage.css';

const SECTIONS = [
  ['ds-colour', 'Colour'],
  ['ds-type', 'Typography'],
  ['ds-space', 'Spacing and effects'],
  ['ds-icons', 'Icons'],
  ['ds-components', 'Components'],
  ['ds-planned', 'Not built yet'],
  ['ds-checklist', 'Checklist'],
];

// Living style guide. Everything here is read from tokens.css or rendered with the
// real components, so it cannot drift. The demo panel is intentionally not part of it.
export default function DesignSystemPage() {
  useDocumentTitle('Design system');
  return (
    <div className="ds">
      <header className="ds-header">
        <p className="ds-header__eyebrow">Cathay Together</p>
        <h1 className="ds-header__title">Design system</h1>
        <p className="ds-header__text">
          Every screen follows this guide. Rules and the token mapping are in <code>docs/design-system.md</code>.
        </p>
        <p className="ds-legend">
          <Badge kind="source" /> from Figma or the prototype <Badge kind="proposal" /> not in Figma, needs approval{' '}
          <Badge kind="flag" /> contrast or duplicate finding
        </p>
        <nav aria-label="Style guide sections">
          <ul className="ds-nav">
            {SECTIONS.map(([id, label]) => (
              <li key={id}><a href={`#${id}`}>{label}</a></li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="ds-main">
        <ColourSection />
        <TypographySection />
        <SpaceSection />
        <IconSection />
        <ComponentSections />
        <PlannedSection />
        <ChecklistSection />
      </main>
    </div>
  );
}
