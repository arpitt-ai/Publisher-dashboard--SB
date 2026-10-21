/* Subtle status badges: neutral chip + one small colour dot. The same word always has the same colour. */
const STATUS_TONES = {
  // publishers
  Active: 'green', Inactive: 'gray', 'Pending Verification': 'amber',
  // documents
  Draft: 'gray', 'Pending Approval': 'amber', Approved: 'green', Sent: 'blue', Acknowledged: 'indigo',
  Completed: 'green', Rejected: 'red', Cancelled: 'red', Archived: 'gray',
  // campaigns
  Planned: 'gray', 'In Progress': 'blue', 'On Hold': 'amber',
  // files
  Uploaded: 'green', Missing: 'amber',
};

function StatusBadge({ status }) {
  return html`<span className=${'badge tone-' + (STATUS_TONES[status] || 'gray')}><span className="badge-dot"></span>${status}</span>`;
}

/* Neutral pill for labels such as document type or "Sample". */
function Tag({ children, title }) {
  return html`<span className="tag" title=${title}>${children}</span>`;
}
