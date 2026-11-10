import './BonusTeaser.css';

export default function BonusTeaser({ heading, text }) {
  return (
    <aside className="teaser">
      <h2 className="teaser__heading">{heading}</h2>
      <p className="teaser__text">{text}</p>
    </aside>
  );
}
