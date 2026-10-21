/* Simple tabs. tabs: [{ id, label, count?, alert? }]. Left/Right arrow keys move between tabs. */
function Tabs({ tabs, active, onChange, label = 'Sections', className = '' }) {
  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.id);
    requestAnimationFrame(() => { const el = document.getElementById('tab-' + next.id); if (el) el.focus(); });
  };
  return html`<div className=${'tabs ' + className} role="tablist" aria-label=${label}>
    ${tabs.map((t, i) => html`<button key=${t.id} id=${'tab-' + t.id} type="button" role="tab" aria-selected=${active === t.id} tabIndex=${active === t.id ? 0 : -1}
      className=${'tab' + (active === t.id ? ' is-active' : '')} onClick=${() => onChange(t.id)} onKeyDown=${(e) => onKey(e, i)}>
      ${t.label}
      ${t.count != null && html`<span className="tab-count">${t.count}</span>`}
      ${t.alert && html`<span className="tab-alert" title="Needs attention" aria-label="Needs attention"></span>`}
    </button>`)}
  </div>`;
}
