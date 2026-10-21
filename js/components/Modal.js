/* Modal + promise-based confirm dialog. */
function Modal({ title, subtitle, onClose, children, footer, width = 520, persistent = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !persistent) onClose && onClose(); };
    document.addEventListener('keydown', onKey);
    const prevFocus = document.activeElement;
    if (ref.current) ref.current.focus();
    return () => { document.removeEventListener('keydown', onKey); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    // eslint-disable-next-line
  }, []);
  // Rendered through a portal so its buttons are never inside a page <form> in the DOM
  // (an untyped button in a form would submit it).
  return ReactDOM.createPortal(html`<div className="modal-overlay" onMouseDown=${(e) => { if (e.target === e.currentTarget && !persistent) onClose && onClose(); }}>
    <div className="modal" style=${{ maxWidth: width }} role="dialog" aria-modal="true" aria-label=${title} tabIndex="-1" ref=${ref}>
      <div className="modal-header">
        <div>
          <h3 className="modal-title">${title}</h3>
          ${subtitle && html`<div className="modal-sub">${subtitle}</div>`}
        </div>
        ${onClose && !persistent && html`<button type="button" className="icon-btn" aria-label="Close" onClick=${onClose}><${Icon} name="x" size=${16} /></button>`}
      </div>
      <div className="modal-body">${children}</div>
      ${footer && html`<div className="modal-footer">${footer}</div>`}
    </div>
  </div>`, document.body);
}

/* confirmDialog({ title, message, confirmLabel, danger }) -> Promise<boolean> */
const confirmStore = { current: null, listeners: new Set() };
function confirmDialog(opts) {
  return new Promise((resolve) => {
    confirmStore.current = { ...opts, resolve };
    confirmStore.listeners.forEach((f) => f(confirmStore.current));
  });
}

function ConfirmHost() {
  const [req, setReq] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const f = (r) => setReq(r);
    confirmStore.listeners.add(f);
    return () => confirmStore.listeners.delete(f);
  }, []);
  if (!req) return null;
  const close = (result) => {
    req.resolve(result);
    confirmStore.current = null;
    setReq(null);
    setBusy(false);
  };
  return html`<${Modal} title=${req.title || 'Are you sure?'} width=${440} onClose=${() => close(false)}
    footer=${html`<button type="button" className="btn btn-secondary" onClick=${() => close(false)}>${req.cancelLabel || 'Cancel'}</button>
      <button type="button" className=${'btn ' + (req.danger ? 'btn-danger' : 'btn-primary')} disabled=${busy} autoFocus onClick=${() => { setBusy(true); close(true); }}>${req.confirmLabel || 'Confirm'}</button>`}>
    <p className="modal-text">${req.message}</p>
  <//>`;
}
