/* Add a publisher without leaving the order you are creating. It asks for the same vendor details as the
   Add Publisher page (see PublisherAdd.js); everything else can be added later from the Publishers screen. */
function QuickAddPublisherModal({ initialName = '', onCreated, onClose }) {
  const d = useDraft({ ...createEmptyPublisher(), legalEntityName: initialName }, validateNewPublisher);
  const [dupes, setDupes] = useState(null);
  const [saving, setSaving] = useState(false);
  const uploads = useRef(new Set());
  const done = useRef(false);
  const formRef = useRef(d.form);
  formRef.current = d.form;

  useEffect(() => () => { if (!done.current) fileService.deleteMany([...uploads.current]); }, []);

  async function save(force = false) {
    const res = await checkNewPublisher(formRef.current, { force });
    if (res.errors) { d.setErrors(res.errors); scrollToFirstError(); return; }
    if (res.dupes) { setDupes(res.dupes); return; }
    setSaving(true);
    const { ok, result } = await runAction({ loading: 'Adding publisher...', success: 'Publisher added.' }, () => publisherService.create(res.data));
    setSaving(false);
    if (!ok) return;
    done.current = true;
    onCreated(result);
  }

  return html`<${Modal} title="Add a new publisher" width=${640} onClose=${onClose}
    subtitle="Just the vendor's GST details. Your order stays exactly as it is. Contacts and bank details can be added later."
    footer=${html`<button type="button" className="btn btn-secondary" onClick=${onClose} disabled=${saving}>Cancel</button>
      <button type="button" className="btn btn-primary" onClick=${() => save(!!dupes)} disabled=${saving}>${dupes ? 'Add anyway' : 'Add Publisher'}</button>`}>
    ${dupes && html`<div className="notice notice-warn" role="alert"><${Icon} name="alert" size=${16} /><div>
      <strong>Is this one of these?</strong>
      <ul className="dupe-list" style=${{ marginTop: 8 }}>${dupes.map(({ publisher: p, reasons }) => html`<li key=${p.id} className="dupe-item">
        <div className="dupe-main"><div className="dupe-name">${p.publisherName}</div><div className="dupe-sub">${p.legalEntityName}</div>
          <div className="dupe-reasons">${reasons.map((r) => html`<span key=${r} className="tag tag-warn">${r}</span>`)}</div></div>
        <button type="button" className="btn btn-primary btn-sm" onClick=${() => onCreated(p, { existing: true })}>Use this one</button>
      </li>`)}</ul></div></div>`}
    <div style=${{ marginTop: dupes ? 14 : 0 }}>
      <${AddPublisherFields} d=${d} onFileUploaded=${(id) => uploads.current.add(id)} />
    </div>
  <//>`;
}
