/* Activity / audit views: compact feed, before→after change list, and the full table. */

const entityHref = (a) =>
  !a.entityId ? null : a.entityType === 'publisher' ? `/publishers/${a.entityId}` : a.entityType === 'document' ? `/documents/${a.entityId}` : a.entityType === 'campaign' ? `/campaigns/${a.entityId}` : null;

/* "Publisher Name: Times Digital → Times Digital India" */
function ChangeList({ changes }) {
  const [open, setOpen] = useState(false);
  if (!changes || !changes.length) return null;
  return html`<div className="changes">
    <button type="button" className="link-btn" onClick=${() => setOpen(!open)}>
      <${Icon} name=${open ? 'chevronDown' : 'chevronRight'} size=${12} /> ${plural(changes.length, 'change')}
    </button>
    ${open && html`<ul className="change-list">${changes.map((c) => html`<li key=${c.field}>
      <span className="change-label">${c.label}</span>
      <span className="change-from">${c.from}</span><${Icon} name="arrowRight" size=${12} /><span className="change-to">${c.to}</span>
    </li>`)}</ul>`}
  </div>`;
}

function ActionTag({ action }) {
  return html`<span className=${'tag tag-action tag-' + (AUDIT_ACTIONS[action]?.entity || 'x')}>${AUDIT_ACTIONS[action]?.label || action}</span>`;
}

/* "Arpit Sharma created RO-2026-014" with a detail line and date/time. */
function ActivityFeed({ entries, showChanges = true, linkEntities = true, emptyText = 'No activity yet.' }) {
  if (!entries.length) return html`<${EmptyState} compact icon="activity" title=${emptyText} />`;
  return html`<ul className="feed">
    ${entries.map((a) => {
      const href = linkEntities ? entityHref(a) : null;
      const at = a.entityLabel ? a.summary.indexOf(a.entityLabel) : -1;
      const linked = href && at >= 0;
      return html`<li key=${a.id} className="feed-item">
        <span className="feed-avatar" title=${actorName(a.performedBy)}>${initials(actorName(a.performedBy))}</span>
        <div className="feed-body">
          <div className="feed-line"><strong>${actorName(a.performedBy)}</strong> ${linked
            ? html`${lowerFirst(a.summary.slice(0, at))}<${Link} to=${href} className="feed-link">${a.entityLabel}</${Link}>${a.summary.slice(at + a.entityLabel.length)}`
            : lowerFirst(a.summary)}</div>
          ${a.detail && !a.changes && html`<div className="feed-detail">${a.detail}</div>`}
          ${showChanges && html`<${ChangeList} changes=${a.changes} />`}
          <div className="feed-time">${fmtDate(a.timestamp)} · ${fmtTime(a.timestamp)}</div>
        </div>
      </li>`;
    })}
  </ul>`;
}

/* Full table for the Activity page. */
function ActivityTable({ entries }) {
  return html`<${DataTable} rows=${entries} columns=${[
    { key: 'when', header: 'Date & Time', width: '150px', render: (a) => html`<div className="nowrap">${fmtDate(a.timestamp)}</div><div className="cell-sub">${fmtTime(a.timestamp)}</div>` },
    { key: 'user', header: 'User', width: '150px', render: (a) => html`<span className="user-cell"><span className="feed-avatar sm">${initials(actorName(a.performedBy))}</span>${actorName(a.performedBy)}</span>` },
    { key: 'action', header: 'Action', width: '170px', render: (a) => html`<${ActionTag} action=${a.action} />` },
    { key: 'entity', header: 'Entity', width: '170px', render: (a) => {
        const href = entityHref(a);
        return href ? html`<${Link} to=${href} className="text-link">${a.entityLabel}</${Link}>` : (a.entityLabel || '—');
      } },
    { key: 'details', header: 'Details', render: (a) => html`<div>${a.summary}</div>${a.detail && html`<div className="cell-sub">${a.detail}</div>`}<${ChangeList} changes=${a.changes} />` },
  ]} />`;
}
