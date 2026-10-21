function KPICard({ label, value, sub, to, icon }) {
  const body = html`
    <div className="kpi-top"><span className="kpi-label">${label}</span>${icon && html`<span className="kpi-icon"><${Icon} name=${icon} size=${16} /></span>`}</div>
    <div className="kpi-value">${value}</div>
    ${sub && html`<div className="kpi-sub">${sub}</div>`}`;
  return to
    ? html`<a className="kpi kpi-link" href=${'#' + to}>${body}</a>`
    : html`<div className="kpi">${body}</div>`;
}
