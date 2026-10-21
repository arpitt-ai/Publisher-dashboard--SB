/* Generic data table.
   column: { key, header, render(row), align, width, p2, sticky: 'left' | 'right', className }
   `p2` (priority 2) columns are hidden on narrower screens unless `showAll` is on. */
function DataTable({ columns, rows, rowKey = (r) => r.id, onRowClick, showAll = false, rowClass }) {
  const cls = (c, tag) =>
    [c.p2 ? 'col-p2' : '', c.sticky === 'right' ? 'sticky-r' : '', c.sticky === 'left' ? 'sticky-l' : '', c.align ? 'ta-' + c.align : '', c.className || '', tag === 'th' ? 'th' : '']
      .filter(Boolean).join(' ');
  return html`<div className="table-wrap">
    <table className=${'table' + (showAll ? ' show-all' : '')}>
      <thead>
        <tr>${columns.map((c) => html`<th key=${c.key} className=${cls(c, 'th')} style=${c.width ? { width: c.width, minWidth: c.width } : null}>${c.header}</th>`)}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => html`<tr key=${rowKey(row)} className=${[onRowClick ? 'clickable' : '', rowClass ? rowClass(row) : ''].join(' ')}
          onClick=${onRowClick ? (e) => { if (!e.target.closest('button,a,input,select,label')) onRowClick(row); } : null}>
          ${columns.map((c) => html`<td key=${c.key} className=${cls(c, 'td')}>${c.render(row)}</td>`)}
        </tr>`)}
      </tbody>
    </table>
  </div>`;
}

/* A small icon-only action button with a tooltip. */
function RowAction({ icon, label, onClick, to, danger = false, disabled = false }) {
  const cls = 'icon-btn' + (danger ? ' icon-btn-danger' : '') + (disabled ? ' is-disabled' : '');
  if (to && !disabled) return html`<a className=${cls} href=${'#' + to} title=${label} aria-label=${label}><${Icon} name=${icon} size=${15} /></a>`;
  return html`<button className=${cls} title=${label} aria-label=${label} disabled=${disabled} onClick=${onClick}><${Icon} name=${icon} size=${15} /></button>`;
}
