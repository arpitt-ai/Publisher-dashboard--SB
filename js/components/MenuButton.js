/* A "More" button that opens a short list of actions.
   items: [{ label, icon, onClick, to, danger, disabled, hidden, title }]. Closes on Escape, scroll or an outside click.
   The list is positioned with `fixed` so it is never clipped by a scrolling table. */
function MenuButton({ label = 'More', icon = 'dots', items, align = 'right', className = 'btn btn-secondary btn-sm', iconOnly = false }) {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const listRef = useRef(null);
  const visible = items.filter((i) => i && !i.hidden);
  const open = !!pos;

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setPos(null);
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target) && !(listRef.current && listRef.current.contains(e.target))) close(); };
    const onKey = (e) => { if (e.key === 'Escape') { close(); const b = ref.current && ref.current.querySelector('button'); if (b) b.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (!visible.length) return null;

  const toggle = (e) => {
    if (open) { setPos(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const height = visible.length * 36 + 12;
    const top = r.bottom + height > window.innerHeight - 8 ? Math.max(8, r.top - height - 4) : r.bottom + 4;
    setPos(align === 'right' ? { top, right: Math.max(8, window.innerWidth - r.right) } : { top, left: Math.max(8, r.left) });
  };
  const run = (item) => { setPos(null); if (item.onClick) item.onClick(); };

  return html`<div className="menu" ref=${ref}>
    <button type="button" className=${className} aria-haspopup="menu" aria-expanded=${open} aria-label=${iconOnly ? label : undefined} onClick=${toggle}>
      <${Icon} name=${icon} size=${15} />${!iconOnly && html` ${label}`}${!iconOnly && html`<${Icon} name="chevronDown" size=${13} />`}
    </button>
    ${open && ReactDOM.createPortal(html`<div className="menu-list" ref=${listRef} style=${{ position: 'fixed', ...pos }} role="menu">
      ${visible.map((i) => i.to && !i.disabled
        ? html`<a key=${i.label} role="menuitem" className=${'menu-item' + (i.danger ? ' is-danger' : '')} href=${'#' + i.to} onClick=${() => setPos(null)}><${Icon} name=${i.icon || 'chevronRight'} size=${15} /> ${i.label}</a>`
        : html`<button key=${i.label} type="button" role="menuitem" className=${'menu-item' + (i.danger ? ' is-danger' : '')} disabled=${i.disabled} title=${i.title} onClick=${() => run(i)}><${Icon} name=${i.icon || 'chevronRight'} size=${15} /> ${i.label}</button>`)}
    </div>`, document.body)}
  </div>`;
}
