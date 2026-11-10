import './Chip.css';

const TONE_CLASS = {
  neutral: '',
  primary: ' chip--primary',
  sand: ' chip--sand',
  tint: ' chip--tint',
  peach: ' chip--peach',
};

export default function Chip({ tone = 'neutral', children }) {
  return <span className={`chip${TONE_CLASS[tone] ?? ''}`}>{children}</span>;
}
