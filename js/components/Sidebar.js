/* Six sections, always in the same order, always with a text label next to the icon. */
const NAV = [
  { label: 'Dashboard', icon: 'dashboard', to: '/', active: (p) => p === '/' },
  { label: 'Publishers', icon: 'building', to: '/publishers', active: (p) => p.startsWith('/publishers') },
  { label: 'Campaigns', icon: 'campaign', to: '/campaigns', active: (p) => p.startsWith('/campaigns') },
  { label: 'Orders & Documents', icon: 'file', to: '/documents', active: (p) => p.startsWith('/documents') },
  { label: 'Reports', icon: 'chart', to: '/reports', active: (p) => p.startsWith('/reports') },
  { label: 'Settings', icon: 'settings', to: '/settings', active: (p) => p.startsWith('/settings') || p.startsWith('/activity') },
];

function Sidebar({ path, open, onClose }) {
  return html`<${Fragment}>
    ${open && html`<div className="sidebar-scrim" onClick=${onClose}></div>`}
    <aside className=${'sidebar' + (open ? ' is-open' : '')} aria-label="Main menu">
      <div className="sidebar-brand">
        <span className="brand-mark"><img src=${LOGO_SIDEBAR_DATA_URI} alt="" /></span>
        <span className="brand-name">Vendor Portal<small>Orders, publishers, campaigns</small></span>
      </div>
      <nav className="sidebar-nav">
        ${NAV.map((n) => {
          const on = n.active(path);
          return html`<${Link} key=${n.to} to=${n.to} onClick=${onClose} aria-current=${on ? 'page' : undefined}
            className=${'nav-link' + (on ? ' is-active' : '')}><${Icon} name=${n.icon} size=${18} /><span className="nav-label">${n.label}</span></${Link}>`;
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="dev-pill"><span className="dev-dot"></span> Test mode</div>
        <div className="sidebar-foot-note">Sign-in is not set up yet. Work is recorded as ${currentUser.get().name}.</div>
      </div>
    </aside>
  <//>`;
}
