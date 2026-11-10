import './TravelConnector.css';

// Travel between two stops: a dashed line, a train icon and "60 min by train · airport to city".
export default function TravelConnector({ minutes, text }) {
  return (
    <p className="travel">
      <span className="travel__line" aria-hidden="true" />
      <img src="/assets/ui-train.svg" alt="" />
      <span>
        {minutes} min {text}
      </span>
      <span className="travel__line" aria-hidden="true" />
    </p>
  );
}
