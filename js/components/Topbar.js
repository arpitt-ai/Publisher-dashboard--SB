/* Top bar: breadcrumb + page title on the left, the signed-in (test) user on the right.
   The user menu is a placeholder — there is no authentication in this version. */
function Topbar({ onMenu }) {
  const { title, crumbs } = usePageMetaValue();
  const user = currentUser.get();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, []);

  return html`<header className="topbar">
    <button className="icon-btn topbar-menu" aria-label="Open menu" onClick=${onMenu}><${Icon} name="menu" size=${20} /></button>
    <div className="topbar-title">
      ${crumbs.length > 0 && html`<nav className="breadcrumb" aria-label="Breadcrumb">
        ${crumbs.map((c, i) => html`<${Fragment} key=${i}>
          ${i > 0 && html`<${Icon} name="chevronRight" size=${12} />`}
          ${c.to ? html`<${Link} to=${c.to}>${c.label}</${Link}>` : html`<span aria-current="page">${c.label}</span>`}
        <//>`)}
      </nav>`}
      <h1 className="page-title">${title}</h1>
    </div>
    <div className="usermenu" ref=${ref}>
      <button className="user-chip" aria-haspopup="true" aria-expanded=${open} onClick=${() => setOpen(!open)}>
        <span className="avatar">${initials(user.name)}</span>
        <span className="user-text"><strong>${user.name}</strong><small>${user.role}</small></span>
        <${Icon} name="chevronDown" size=${14} />
      </button>
      ${open && html`<div className="popover" role="menu">
        <div className="popover-user">
          <span className="avatar avatar-lg">${initials(user.name)}</span>
          <div><strong>${user.name}</strong><div className="popover-email">${user.role}</div></div>
        </div>
        <div className="popover-note"><${Icon} name="info" size=${14} /> Sign-in is not set up yet, so everything is recorded under this name. You can try other roles in Settings.</div>
        <${Link} to="/settings" className="popover-link" onClick=${() => setOpen(false)}><${Icon} name="settings" size=${14} /> Settings</${Link}>
      </div>`}
    </div>
  </header>`;
}
