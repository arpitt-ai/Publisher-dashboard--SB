/* Toasts — the existing bottom-right pattern, extended with loading / success / error states. */
const toast = (() => {
  let items = [];
  let counter = 0;
  const timers = {};
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f(items));

  function dismiss(id) {
    clearTimeout(timers[id]);
    items = items.filter((t) => t.id !== id);
    emit();
  }

  /* Passing an existing `id` updates that toast in place (e.g. loading → success). */
  function push(type, message, id) {
    if (id != null && items.some((t) => t.id === id)) {
      items = items.map((t) => (t.id === id ? { ...t, type, message } : t));
    } else {
      id = ++counter;
      items = [...items, { id, type, message }];
    }
    emit();
    clearTimeout(timers[id]);
    if (type !== 'loading') timers[id] = setTimeout(() => dismiss(id), type === 'error' ? 5500 : 2800);
    return id;
  }

  return {
    loading: (m, id) => push('loading', m, id),
    success: (m, id) => push('success', m, id),
    error: (m, id) => push('error', m, id),
    info: (m, id) => push('info', m, id),
    dismiss,
    subscribe: (f) => { listeners.add(f); f(items); return () => listeners.delete(f); },
  };
})();

function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => toast.subscribe(setItems), []);
  return html`<div className="toast-host" role="status" aria-live="polite">
    ${items.map((t) => html`<div key=${t.id} className=${'toast toast-' + t.type}>
      ${t.type === 'loading' ? html`<span className="spinner spinner-sm"></span>`
        : t.type === 'success' ? html`<${Icon} name="checkCircle" size=${16} />`
        : t.type === 'error' ? html`<${Icon} name="alert" size=${16} />`
        : html`<${Icon} name="info" size=${16} />`}
      <span>${t.message}</span>
      ${t.type !== 'loading' && html`<button className="toast-x" aria-label="Dismiss" onClick=${() => toast.dismiss(t.id)}><${Icon} name="x" size=${13} /></button>`}
    </div>`)}
  </div>`;
}
