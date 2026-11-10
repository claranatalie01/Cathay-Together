import './ComparisonTable.css';

const isMoney = (label) => /fee/i.test(label);

function Cell({ value, label }) {
  if (value === true) return <img className="compare__badge" src="/assets/ui-check-badge.svg" alt="Included" />;
  if (value === false) return <img className="compare__badge" src="/assets/ui-cross-badge.svg" alt="Not included" />;
  if (typeof value === 'number') {
    if (isMoney(label)) return value === 0 ? <strong>Free</strong> : <span>HKD<strong>{value.toLocaleString('en-US')}</strong></span>;
    return <strong>{value.toLocaleString('en-US')}</strong>;
  }
  return <span>{value}</span>;
}

// Fare types side by side (real app, S9 / S11). `columns` are the fare ids shown, in order.
// Real <table>, so screen readers announce each value with its row and column.
export default function ComparisonTable({ columns, names, groups, caption }) {
  return (
    <table className="compare">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <td className="compare__corner" />
          {columns.map((id, i) => (
            <th scope="col" className={`compare__head compare__head--${id}${i % 2 ? ' is-b' : ''}`} key={id}>
              {names[id]}
            </th>
          ))}
        </tr>
      </thead>
      {groups.map((group) => (
        <tbody key={group.group}>
          <tr>
            <th scope="rowgroup" className="compare__group" colSpan={columns.length + 1}>
              {group.group}
            </th>
          </tr>
          {group.rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="compare__label">
                {row.label}
              </th>
              {columns.map((id) => (
                <td className={`compare__value compare__value--${id}`} key={id}>
                  <Cell value={row.values[id]} label={row.label} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}
