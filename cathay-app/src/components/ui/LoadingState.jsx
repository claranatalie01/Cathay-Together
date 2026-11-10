import './LoadingState.css';

// Placeholder blocks shown while data loads. Announced once to screen readers.
export default function LoadingState({ variant = 'detail', as: Tag = 'main' }) {
  return (
    <Tag className={`loading loading--${variant}`} aria-busy="true">
      <span className="sr-only" role="status">
        Loading…
      </span>
      <div className="skeleton skeleton--card" />
      <div className="skeleton skeleton--line skeleton--short" />
      <div className="skeleton skeleton--row" />
      <div className="skeleton skeleton--row" />
      {variant === 'detail' && <div className="skeleton skeleton--card" />}
    </Tag>
  );
}
