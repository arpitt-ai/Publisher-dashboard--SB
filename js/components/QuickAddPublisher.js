/* Add a publisher without leaving the order you are creating. A small window asks only for the essentials;
   the rest can be filled in later from the Publishers screen. */
function QuickAddPublisherModal({ initialName = '', onCreated, onClose }) {
  const [form, setForm] = useState({ ...createEmptyPublisher(), publisherName: initialName, legalEntityName: initialName });
  const [errors, setErrors] = useState({});
  const [dupes, setDupes] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (path, value) => {
    setForm((f) => setPath(f, path, value));
    setErrors((e) => { if (!e[path]) return e; const n = { ...e }; delete n[path]; return n; });
    setDupes(null);
  };
  const field = (path, extra = {}) => ({ value: getPath(form, path), error: errors[path], name: path, onChange: (v) => set(path, v), ...extra });

  async function save(force = false) {
    const errs = validatePublisher(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const gstin = upper(form.tax.gstin);
    const data = { ...form, tax: { ...form.tax, pan: form.tax.pan || (RX.gstin.test(gstin) ? gstin.slice(2, 12) : '') } }; // a GSTIN contains the PAN
    if (!force) {
      const found = await publisherService.findDuplicates(data);
      if (found.length) { setDupes(found); return; }
    }
    setSaving(true);
    const { ok, result } = await runAction({ loading: 'Adding publisher...', success: 'Publisher added.' }, () => publisherService.create(data));
    setSaving(false);
    if (ok) onCreated(result);
  }

  return html`<${Modal} title="Add a new publisher" width=${600} onClose=${onClose}
    subtitle="Just the essentials. Your order stays exactly as it is. You can add GST, bank and address details later."
    footer=${html`<button type="button" className="btn btn-secondary" onClick=${onClose} disabled=${saving}>Cancel</button>
      <button type="button" className="btn btn-primary" onClick=${() => save(!!dupes)} disabled=${saving}>${dupes ? 'Add anyway' : 'Add Publisher'}</button>`}>
    ${dupes && html`<div className="notice notice-warn" role="alert"><${Icon} name="alert" size=${16} /><div>
      <strong>Is this one of these?</strong>
      <ul className="dupe-list" style=${{ marginTop: 8 }}>${dupes.map(({ publisher: p, reasons }) => html`<li key=${p.id} className="dupe-item">
        <div className="dupe-main"><div className="dupe-name">${p.publisherName}</div><div className="dupe-sub">${p.legalEntityName}</div>
          <div className="dupe-reasons">${reasons.map((r) => html`<span key=${r} className="tag tag-warn">${r}</span>`)}</div></div>
        <button type="button" className="btn btn-primary btn-sm" onClick=${() => onCreated(p, { existing: true })}>Use this one</button>
      </li>`)}</ul></div></div>`}
    <div className="form-grid" style=${{ marginTop: dupes ? 14 : 0 }}>
      <${TextField} label="Publisher name" required className="col-6" autoFocus ...${field('publisherName')} />
      <${TextField} label="Legal company name" required className="col-6" ...${field('legalEntityName')} />
      <${TextField} label="Contact person" required className="col-6" ...${field('contactPerson')} />
      <${TextField} label="Email" required type="email" className="col-6" ...${field('email')} />
      <${TextField} label="GSTIN" className="col-6" maxLength=${15} placeholder="Optional" transform=${(v) => v.toUpperCase()} ...${field('tax.gstin')} />
      <${TextField} label="Phone" type="tel" className="col-6" placeholder="Optional" ...${field('phone')} />
    </div>
  <//>`;
}
