const LABEL = { source: 'Figma / prototype', proposal: 'Proposal', flag: 'Flagged' };

// Marks where a style comes from. Proposals are not in Figma and need approval.
export default function Badge({ kind }) {
  return <span className={`ds-badge ds-badge--${kind}`}>{LABEL[kind]}</span>;
}
