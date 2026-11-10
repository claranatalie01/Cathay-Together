import Badge from './Badge';
import { CONTRAST_PAIRS, TEXT_ROLES } from './catalog';
import { contrastRatio, isHex } from './contrast';
import { TOKENS, tokenSections, tokensIn, tokenValue } from './tokens';

const display = (name) => name.replace(/^--(color|text|space|radius)-/, '');
const groupTitle = (section) => {
  const rest = section.replace(/^Colour:?\s*/, '');
  return rest.charAt(0).toUpperCase() + rest.slice(1);
};

export function ColourSection() {
  return (
    <section className="ds-section" aria-labelledby="ds-colour">
      <h2 className="ds-section__title" id="ds-colour">
        Colour
      </h2>
      <p className="ds-section__text">
        Names say what a colour is for, not what it looks like. Notes in amber are contrast or
        near-duplicate findings; the values stay as designed until a change is approved.
      </p>
      {tokenSections('--color-').map((section) => (
        <div className="ds-group" key={section}>
          <h3 className="ds-group__title">{groupTitle(section)}</h3>
          <ul className="ds-swatches">
            {tokensIn('--color-')
              .filter((token) => token.section === section)
              .map((token) => (
                <li className="ds-swatch" key={token.name}>
                  <span className="ds-swatch__chip" style={{ background: `var(${token.name})` }} aria-hidden="true" />
                  <code className="ds-swatch__name">{token.name}</code>
                  <span className="ds-swatch__value">{token.value}</span>
                  {token.note && <span className="ds-swatch__note">{token.note.replace(/PROPOSAL:?\s*/, '')}</span>}
                  {token.status !== 'source' && <Badge kind={token.status} />}
                </li>
              ))}
          </ul>
        </div>
      ))}

      <div className="ds-group">
        <h3 className="ds-group__title">Contrast of pairs in use (measured live)</h3>
        <table className="ds-table">
          <thead>
            <tr>
              <th scope="col">Pair</th>
              <th scope="col">Use</th>
              <th scope="col">Ratio</th>
              <th scope="col">Needs</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {CONTRAST_PAIRS.map((pair) => {
              const fg = tokenValue(pair.fg);
              const bg = tokenValue(pair.bg);
              const ratio = isHex(fg) && isHex(bg) ? contrastRatio(fg, bg) : null;
              const pass = ratio !== null && ratio >= pair.min;
              return (
                <tr key={`${pair.fg}-${pair.bg}`}>
                  <td>
                    <code>{display(pair.fg)}</code> on <code>{display(pair.bg)}</code>
                  </td>
                  <td>{pair.use}</td>
                  <td>{ratio === null ? 'n/a' : `${ratio.toFixed(2)}:1`}</td>
                  <td>{pair.min}:1</td>
                  <td>
                    <span className={`ds-result ds-result--${pass ? 'pass' : 'fail'}`}>{pass ? 'Pass' : 'Fails'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TypographySection() {
  const styles = tokensIn('--text-').filter((token) => token.name.endsWith('-size'));
  return (
    <section className="ds-section" aria-labelledby="ds-type">
      <h2 className="ds-section__title" id="ds-type">
        Typography
      </h2>
      <p className="ds-section__text">
        Inter throughout. Each style pairs a size with the
        single-line leading Figma produces (&ldquo;normal&rdquo;, in whole pixels). Use the pair, never one alone.
      </p>
      <ul className="ds-type-list">
        {styles.map((token) => {
          const key = token.name.replace('--text-', '').replace('-size', '');
          const leading = tokenValue(`--text-${key}-leading`);
          return (
            <li className="ds-type-row" key={key}>
              <div className="ds-type-row__meta">
                <code>{key}</code>
                <span>
                  {token.value} / {leading ?? 'n/a'}
                </span>
                <span className="ds-type-row__role">{TEXT_ROLES[key]}</span>
                {token.status !== 'source' && <Badge kind={token.status} />}
              </div>
              <p
                className="ds-type-row__sample"
                style={{ fontSize: `var(${token.name})`, lineHeight: leading ? `var(--text-${key}-leading)` : undefined }}
              >
                Fly together to Tokyo
              </p>
            </li>
          );
        })}
      </ul>
      <div className="ds-group">
        <h3 className="ds-group__title">Weights</h3>
        <ul className="ds-weights">
          {tokensIn('--weight-').map((token) => (
            <li key={token.name} style={{ fontWeight: `var(${token.name})` }}>
              <code>{token.name}</code> {token.value}
            </li>
          ))}
        </ul>
      </div>
      <div className="ds-group">
        <h3 className="ds-group__title">Paragraph leading</h3>
        <p className="ds-section__text">
          Multi-line copy uses a ratio: <code>--leading-body</code> {tokenValue('--leading-body')},{' '}
          <code>--leading-tight</code> {tokenValue('--leading-tight')}, <code>--leading-heading</code>{' '}
          {tokenValue('--leading-heading')}. The <code>--leading-NN</code> tokens hold the whole-pixel values Figma
          uses where a size has a different leading.
        </p>
      </div>
    </section>
  );
}

export function SpaceSection() {
  const radius = tokensIn('--radius-');
  return (
    <section className="ds-section" aria-labelledby="ds-space">
      <h2 className="ds-section__title" id="ds-space">
        Spacing, radius and effects
      </h2>
      <div className="ds-group">
        <h3 className="ds-group__title">Spacing scale</h3>
        <ul className="ds-scale">
          {tokensIn('--space-')
            .filter((token) => !token.name.includes('optical'))
            .map((token) => (
              <li className="ds-scale__row" key={token.name}>
                <code>{display(token.name)}</code>
                <span className="ds-scale__bar" style={{ width: `var(${token.name})` }} aria-hidden="true" />
                <span>{token.value}</span>
              </li>
            ))}
        </ul>
        <p className="ds-section__text">
          Optical values Figma uses off the 4px grid are kept exactly:{' '}
          {tokensIn('--space-optical-')
            .map((token) => token.value)
            .join(', ')}
          . Prefer a scale step; use an optical value only to match a Figma measurement.
        </p>
      </div>
      <div className="ds-group">
        <h3 className="ds-group__title">Radius</h3>
        <ul className="ds-radii">
          {radius.map((token) => (
            <li className="ds-radius" key={token.name}>
              <span className="ds-radius__box" style={{ borderRadius: `var(${token.name})` }} aria-hidden="true" />
              <code>{display(token.name)}</code>
              <span>{token.value}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="ds-group">
        <h3 className="ds-group__title">Borders, focus, shadow, opacity</h3>
        <ul className="ds-effects">
          {tokensIn('--border-width-').map((token) => (
            <li className="ds-effect" key={token.name}>
              <span
                className="ds-effect__box"
                style={{ borderWidth: `var(${token.name})`, borderStyle: 'solid', borderColor: 'var(--color-border-brand)' }}
                aria-hidden="true"
              />
              <code>{token.name}</code> {token.value}
            </li>
          ))}
          <li className="ds-effect">
            <span
              className="ds-effect__box"
              style={{ outline: 'var(--focus-ring-width) solid var(--color-focus-ring)', outlineOffset: 'var(--focus-ring-offset)' }}
              aria-hidden="true"
            />
            <code>--focus-ring-*</code> <Badge kind="proposal" />
          </li>
          <li className="ds-effect">
            <span className="ds-effect__box" style={{ boxShadow: 'var(--shadow-card)' }} aria-hidden="true" />
            <code>--shadow-card</code> Figma &ldquo;XXS Shadow&rdquo;
          </li>
          {TOKENS.filter((token) => token.name.startsWith('--opacity-')).map((token) => (
            <li className="ds-effect" key={token.name}>
              <span className="ds-effect__box ds-effect__box--solid" style={{ opacity: `var(${token.name})` }} aria-hidden="true" />
              <code>{token.name}</code> {token.value} <Badge kind="proposal" />
            </li>
          ))}
        </ul>
        <p className="ds-section__text">
          Layout: screen <code>{tokenValue('--screen-width')}</code> wide with a <code>--space-xl</code> gutter. Below
          768px the screen fills the viewport; wider, it sits centred on the dark canvas.
        </p>
      </div>
    </section>
  );
}
