import './Price.css';

// "HKD6,691": currency in regular weight, amount in bold (real app, S5 / S6).
// Reads as one phrase to screen readers ("HKD 6,691").
export default function Price({ amount, currency = 'HKD', className = '' }) {
  return (
    <span className={`price ${className}`.trim()}>
      <span className="price__currency">{currency}</span>
      <span className="price__amount">{amount.toLocaleString('en-US')}</span>
    </span>
  );
}
