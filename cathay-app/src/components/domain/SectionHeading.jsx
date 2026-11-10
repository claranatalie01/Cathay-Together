import './SectionHeading.css';

// Heading row with an optional action on the right (a link or a button).
export default function SectionHeading({ id, title, small = false, startAligned = false, action }) {
  return (
    <div className={`section-heading${startAligned ? ' section-heading--start' : ''}`}>
      <h2 className={`section-heading__title${small ? ' section-heading__title--small' : ''}`} id={id}>
        {title}
      </h2>
      {action}
    </div>
  );
}
