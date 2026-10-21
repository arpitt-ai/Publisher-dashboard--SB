/* Add Publisher.
   The form asks for exactly what is on the vendor's GST certificate, nothing else:
     Vendor name · address · city · pincode · state · GST registration number
   plus an optional MSME registration number (and, if one is entered, the MSME certificate is compulsory).
   Contacts, bank and commercial terms can be added later from the publisher's page.
   The same fields are used by the full "Add Publisher" page and by the quick-add window inside the order form. */

/* Form state with per-field errors. `validator(form)` returns { path: message }. */
function useDraft(initial, validator) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const ref = useRef(form);
  ref.current = form;
  const set = (path, value) => {
    setForm((f) => setPath(f, path, value));
    setErrors((e) => { if (!e[path]) return e; const n = { ...e }; delete n[path]; return n; });
  };
  const blur = (path) => {
    const err = validator(ref.current)[path];
    setErrors((e) => { const n = { ...e }; if (err) n[path] = err; else delete n[path]; return n; });
  };
  const field = (path, extra = {}) => ({ value: getPath(form, path), error: errors[path], name: path, onChange: (v) => set(path, v), onBlur: () => blur(path), ...extra });
  return { form, setForm, errors, setErrors, set, blur, field };
}

/* MSME number (optional). Once a number is typed, the certificate upload appears and becomes compulsory. */
function MsmeSection({ d, onFileUploaded }) {
  const { form, errors, setForm, set, field } = d;
  const number = form.msme.registrationNumber;
  return html`<div className="msme-block">
    <${TextField} label="MSME Registration Number" placeholder="UDYAM-XX-00-0000000" transform=${(v) => v.toUpperCase()}
      hint="Not mandatory. If you enter a number, you must also upload the MSME certificate."
      ...${field('msme.registrationNumber', { onChange: (v) => { set('msme.registrationNumber', v); setForm((f) => ({ ...f, msme: { ...f.msme, registrationNumber: v, registered: !!v.trim() } })); } })} />
    ${norm(number) && html`<div className="msme-upload" data-error=${errors['msme.document'] ? 'true' : undefined}>
      <${ComplianceDocuments} staged onlyMsme msmeRegistered docs=${form.complianceDocuments} onFileUploaded=${onFileUploaded}
        onChange=${(docs) => { setForm((f) => ({ ...f, complianceDocuments: docs })); d.setErrors((e) => { const n = { ...e }; delete n['msme.document']; return n; }); }} />
      ${errors['msme.document'] && html`<div className="field-error" role="alert"><${Icon} name="alert" size=${12} /><span>${errors['msme.document']}</span></div>`}
    </div>`}
  </div>`;
}

function AddPublisherFields({ d, onFileUploaded, autoFocus = true }) {
  const { form, set, field } = d;
  const g = upper(form.tax.gstin);
  const gstValid = RX.gstin.test(g);
  const gstState = gstValid ? GST_STATE_BY_CODE[g.slice(0, 2)] : '';
  const mismatch = gstState && norm(form.address.state) && gstState !== form.address.state;

  const onGstinBlur = () => {
    if (gstValid) {
      if (!norm(form.tax.pan)) set('tax.pan', g.slice(2, 12)); // a GSTIN contains the PAN
      if (gstState && !norm(form.address.state)) set('address.state', gstState); // and the state the vendor is registered in
    }
    d.blur('tax.gstin');
  };

  return html`<div className="form-grid">
    <${TextField} label="Vendor Name (as appearing in the GST Certificate)" required className="col-12" autoFocus=${autoFocus} ...${field('legalEntityName')} />
    <${TextAreaField} label="Vendor Address" required className="col-12" rows=${2} ...${field('address.line1')} />
    <${TextField} label="Vendor City" required className="col-4" ...${field('address.city')} />
    <${TextField} label="Vendor Pincode" required className="col-4" inputMode="numeric" maxLength=${6} transform=${(v) => v.replace(/\D/g, '')} placeholder="6 digits" ...${field('address.pinCode')} />
    <${SelectField} label="Vendor State Name" required className="col-4" placeholder="Select state" options=${INDIAN_STATES}
      hint=${mismatch ? html`<span className="hint-warn">The GST number says ${gstState}. Please check the state.</span>` : ''} ...${field('address.state')} />
    <${TextField} label="Vendor GST Registration Number" required className="col-12" placeholder="15 characters, e.g. 27AAACC1206D1ZM" maxLength=${15} transform=${(v) => v.toUpperCase()}
      hint=${gstState ? `Registered in ${gstState}` : ''} ...${field('tax.gstin', { onBlur: onGstinBlur })} />
    <div className="col-12"><${MsmeSection} d=${d} onFileUploaded=${onFileUploaded} /></div>
  </div>`;
}

/* Checks the form, then looks for duplicates. Resolves to { errors } | { dupes } | { data } (data = ready for publisherService.create). */
async function checkNewPublisher(form, { force = false } = {}) {
  const errors = validateNewPublisher(form);
  if (Object.keys(errors).length) return { errors };
  const gstin = upper(form.tax.gstin);
  const data = {
    ...form,
    publisherName: norm(form.publisherName) || norm(form.legalEntityName), // shown name defaults to the vendor name; change it later in Edit
    tax: { ...form.tax, gstin, pan: form.tax.pan || gstin.slice(2, 12) },
  };
  if (!force) {
    const found = await publisherService.findDuplicates(data);
    if (found.length) return { dupes: found };
  }
  return { data };
}

/* ── The full page ── */
function PublisherAddForm({ onSaved, onCancel }) {
  const d = useDraft(createEmptyPublisher(), validateNewPublisher);
  const [saving, setSaving] = useState(false);
  const [dupes, setDupes] = useState(null);
  const initialJson = useRef(JSON.stringify(d.form));
  const sessionUploads = useRef(new Set());
  const saved = useRef(false);
  const formRef = useRef(d.form);
  formRef.current = d.form;

  // Files uploaded here but never saved are removed if the user leaves.
  useEffect(() => () => { if (!saved.current) fileService.deleteMany([...sessionUploads.current]); }, []);

  async function submit(force = false) {
    const res = await checkNewPublisher(formRef.current, { force });
    if (res.errors) {
      d.setErrors(res.errors);
      toast.error(`Please fix ${plural(Object.keys(res.errors).length, 'highlighted field')} before saving.`);
      scrollToFirstError();
      return;
    }
    if (res.dupes) { setDupes(res.dupes); return; }
    setDupes(null);
    setSaving(true);
    const { ok, result } = await runAction({ loading: 'Saving publisher...', success: 'Publisher added.', error: 'Could not save the publisher.' }, () => publisherService.create(res.data));
    setSaving(false);
    if (!ok) return;
    const keep = new Set(result.complianceDocuments.map((x) => x.fileId));
    fileService.deleteMany([...sessionUploads.current].filter((id) => !keep.has(id))); // drop files replaced while filling in the form
    saved.current = true;
    onSaved(result);
  }

  async function cancel() {
    if (JSON.stringify(formRef.current) !== initialJson.current) {
      const ok = await confirmDialog({ title: 'Leave without saving?', message: 'What you entered will be lost.', confirmLabel: 'Leave', cancelLabel: 'Keep editing', danger: true });
      if (!ok) return;
    }
    onCancel();
  }

  return html`<form className="publisher-form" noValidate onSubmit=${(e) => { e.preventDefault(); submit(); }}>
    <p className="form-note"><span className="req">*</span> means required. You can add contacts, bank details and commercial terms later from the publisher’s page.</p>
    <${FormSection} title="Vendor details" description="Enter these exactly as they appear on the vendor’s GST certificate.">
      <${AddPublisherFields} d=${d} onFileUploaded=${(id) => sessionUploads.current.add(id)} />
    <//>
    <div className="form-footer">
      <span className="form-footer-note">Will be added by ${currentUser.get().name}.</span>
      <div className="form-footer-actions">
        <button type="button" className="btn btn-ghost" onClick=${cancel} disabled=${saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled=${saving}>${saving ? html`<span className="spinner spinner-sm spinner-light"></span> Saving…` : 'Add Publisher'}</button>
      </div>
    </div>
    ${dupes && html`<${DuplicateModal} matches=${dupes} onClose=${() => setDupes(null)}
      onView=${(p) => { saved.current = false; navigate(`/publishers/${p.id}`); }}
      onContinue=${() => submit(true)} />`}
  </form>`;
}
