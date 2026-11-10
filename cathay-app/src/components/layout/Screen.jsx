// The 440px phone-sized page container every screen sits in.
export default function Screen({ className = '', children }) {
  return <div className={`screen ${className}`.trim()}>{children}</div>;
}
