function EmptyState({ icon = 'file', title, description, action, compact = false }) {
  return html`<div className=${'empty' + (compact ? ' empty-compact' : '')}>
    <div className="empty-icon"><${Icon} name=${icon} size=${22} /></div>
    <div className="empty-title">${title}</div>
    ${description && html`<div className="empty-desc">${description}</div>`}
    ${action && html`<div className="empty-action">${action}</div>`}
  </div>`;
}
