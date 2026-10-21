/* Publisher add / edit form, split into tabs so nobody faces one long page.
   mode: 'create' | 'edit'. Files are staged in the form and saved when you press Save.
   Only four things are required: publisher name, legal company name, contact person and email. */

function DuplicateModal({ matches, onView, onContinue, onClose }) {
  return html`<${Modal} title="This publisher may already exist" width=${560} onClose=${onClose}
    subtitle="Something matches a publisher you already have. Using the existing one avoids duplicate records."
    footer=${html`<button type="button" className="btn btn-secondary" onClick=${onClose}>Go back</button>
      <button type="button" className="btn btn-primary" onClick=${onContinue}>Save anyway</button>`}>
    <ul className="dupe-list">
      ${matches.map(({ publisher: p, reasons }) => html`<li key=${p.id} className="dupe-item">
        <div className="dupe-main">
          <div className="dupe-name">${p.publisherName} <${StatusBadge} status=${p.status} /></div>
          <div className="dupe-sub">${p.legalEntityName}</div>
          <div className="dupe-sub mono">${[p.tax?.gstin, p.email].filter(Boolean).join(' · ')}</div>
          <div className="dupe-reasons">${reasons.map((r) => html`<span key=${r} className="tag tag-warn">${r}</span>`)}</div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick=${() => onView(p)}><${Icon} name="eye" size=${14} /> View existing</button>
      </li>`)}
    </ul>
  <//>`;
}

const PUBLISHER_TABS = [
  { id: 'basic', label: 'Basic Details', owns: (k) => ['publisherName', 'legalEntityName', 'companyType', 'vendorCategory', 'status'].includes(k) || k.startsWith('tax.') || k.startsWith('msme.') },
  { id: 'contact', label: 'Contact', owns: (k) => ['contactPerson', 'designation', 'email', 'phone', 'alternatePhone', 'website'].includes(k) || k.startsWith('additionalContacts') },
  { id: 'address', label: 'Address', owns: (k) => k.startsWith('address.') || k.startsWith('billingAddress.') },
  { id: 'commercial', label: 'Commercial Terms', owns: (k) => k.startsWith('commercial.') },
  { id: 'bank', label: 'Bank Details', owns: (k) => k.startsWith('banking.') },
  { id: 'documents', label: 'Documents', owns: () => false },
];

/* Street, city, state and PIN — used for both the registered and the billing address. */
function AddressFields({ prefix, field }) {
  return html`<div className="form-grid">
    <${TextField} label="Address line 1" className="col-6" ...${field(`${prefix}.line1`)} />
    <${TextField} label="Address line 2" className="col-6" ...${field(`${prefix}.line2`)} />
    <${TextField} label="City" className="col-3" ...${field(`${prefix}.city`)} />
    <${SelectField} label="State" className="col-3" placeholder="Select state" options=${INDIAN_STATES} ...${field(`${prefix}.state`)} />
    <${TextField} label="PIN code" className="col-3" inputMode="numeric" maxLength=${6} placeholder="6 digits" transform=${(v) => v.replace(/\D/g, '')} ...${field(`${prefix}.pinCode`)} />
    <${TextField} label="Country" className="col-3" ...${field(`${prefix}.country`)} />
  </div>`;
}

function PublisherForm({ mode, initial, onSaved, onCancel, initialTab = 'basic' }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(() => withDefaults(initial, createEmptyPublisher()));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [dupes, setDupes] = useState(null);
  const limited = !can('publisher.edit'); // e.g. Finance: may update bank details only
  const tabsAvailable = limited ? PUBLISHER_TABS.filter((t) => t.id === 'bank') : PUBLISHER_TABS;
  const [tab, setTab] = useState(limited ? 'bank' : initialTab);
  const [moreTax, setMoreTax] = useState(() => !!(initial.tax && (initial.tax.cin || initial.tax.tan)));
  const [replacingAccount, setReplacingAccount] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;
  const initialJson = useRef(JSON.stringify(withDefaults(initial, createEmptyPublisher())));
  const sessionUploads = useRef(new Set());
  const saved = useRef(false);

  const mayEditBank = can('bank.edit');
  const mayViewBank = can('bank.view');
  const accountLocked = !mayViewBank && !!form.banking.accountNumber && !replacingAccount; // masked unless the role may see it

  // Files uploaded during this session but never saved are cleaned up if the user leaves.
  useEffect(() => () => { if (!saved.current) fileService.deleteMany([...sessionUploads.current]); }, []);

  const isDirty = () => JSON.stringify(formRef.current) !== initialJson.current;

  const set = (path, value) => {
    setForm((f) => setPath(f, path, value));
    setErrors((e) => { if (!e[path]) return e; const n = { ...e }; delete n[path]; return n; });
  };
  const blur = (path) => {
    const err = validatePublisher(formRef.current)[path];
    setErrors((e) => { const n = { ...e }; if (err) n[path] = err; else delete n[path]; return n; });
  };
  const field = (path, extra = {}) => ({
    value: getPath(form, path), error: errors[path], name: path,
    onChange: (v) => set(path, v), onBlur: () => blur(path), ...extra,
  });

  const onGstinBlur = () => {
    const g = upper(formRef.current.tax.gstin);
    if (RX.gstin.test(g) && !norm(formRef.current.tax.pan)) set('tax.pan', g.slice(2, 12)); // a GSTIN contains the PAN
    blur('tax.gstin');
  };

  const errorTabs = new Set(PUBLISHER_TABS.filter((t) => Object.keys(errors).some(t.owns)).map((t) => t.id));

  async function submit(force = false) {
    const all = validatePublisher(form);
    const errs = limited ? Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('banking.'))) : all;
    setErrors(errs);
    const keys = Object.keys(errs);
    if (keys.length) {
      const firstTab = PUBLISHER_TABS.find((t) => keys.some(t.owns));
      if (firstTab) setTab(firstTab.id);
      toast.error(`Please fix ${plural(keys.length, 'highlighted field')} before saving.`);
      scrollToFirstError();
      return;
    }
    if (!force) {
      const identity = ['legalEntityName', 'email', 'tax.gstin', 'tax.pan', 'banking.accountNumber'];
      const before = JSON.parse(initialJson.current);
      const identityChanged = !isEdit || identity.some((p) => String(getPath(form, p) || '').trim().toLowerCase() !== String(getPath(before, p) || '').trim().toLowerCase());
      if (identityChanged) {
        const found = await publisherService.findDuplicates(form, form.id);
        if (found.length) { setDupes(found); return; }
      }
    }
    setDupes(null);
    setSaving(true);
    const { ok, result } = await runAction(
      {
        loading: 'Saving publisher...',
        success: isEdit ? 'Publisher updated.' : 'Publisher added.',
        error: 'Could not save the publisher.',
      },
      () => (isEdit ? publisherService.update(form.id, form) : publisherService.create(form)),
    );
    setSaving(false);
    if (!ok) return;
    const finalIds = new Set(result.complianceDocuments.map((d) => d.fileId));
    fileService.deleteMany([...sessionUploads.current].filter((id) => !finalIds.has(id))); // drop replaced-in-session files
    saved.current = true;
    onSaved(result);
  }

  async function cancel() {
    if (isDirty()) {
      const ok = await confirmDialog({ title: 'Leave without saving?', message: 'Your changes on this form will be lost.', confirmLabel: 'Leave', cancelLabel: 'Keep editing', danger: true });
      if (!ok) return;
    }
    onCancel();
  }

  const setMsme = (registered) => {
    set('msme.registered', registered);
    if (!registered) set('msme.registrationNumber', '');
  };
  const contacts = form.additionalContacts || [];
  const setContacts = (next) => setForm((f) => ({ ...f, additionalContacts: next }));
  const tabIndex = tabsAvailable.findIndex((t) => t.id === tab);
  const isLast = tabIndex === tabsAvailable.length - 1;
  const modelChoice = PRICING_BY_CODE[form.commercial.pricingModel];

  const basicTab = html`<${FormSection} title="Basic details" description="Who they are and how they are registered.">
    <div className="form-grid">
      <${TextField} label="Publisher name" required className="col-6" placeholder="e.g. Times Digital" hint="The name your team uses every day." ...${field('publisherName')} autoFocus=${!isEdit} />
      <${TextField} label="Legal company name" required className="col-6" placeholder="As registered, e.g. Bennett Coleman & Co. Ltd." hint="Printed on documents." ...${field('legalEntityName')} />
      <${SelectField} label="Vendor category" className="col-4" placeholder="Select category" options=${VENDOR_CATEGORIES} ...${field('vendorCategory')} />
      <${SelectField} label="Status" className="col-4" options=${PUBLISHER_STATUSES} hint="Inactive publishers are hidden when creating new documents." ...${field('status')} />
      <${SelectField} label="Company type" className="col-4" placeholder="Select type" options=${COMPANY_TYPES} ...${field('companyType')} />
      <${TextField} label="GSTIN" className="col-6" placeholder="15 characters, e.g. 27AAACC1206D1ZM" maxLength=${15} transform=${(v) => v.toUpperCase()} ...${field('tax.gstin', { onBlur: onGstinBlur })} />
      <${TextField} label="PAN" className="col-6" placeholder="10 characters, e.g. AAACC1206D" hint="Filled in for you when you enter a valid GSTIN." maxLength=${10} transform=${(v) => v.toUpperCase()} ...${field('tax.pan')} />
      <${Segmented} label="MSME registered?" className="col-6" name="msme.registered" value=${form.msme.registered} onChange=${setMsme}
        options=${[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} />
      ${form.msme.registered && html`<${TextField} label="Udyam registration number" required className="col-6" placeholder="UDYAM-XX-00-0000000" transform=${(v) => v.toUpperCase()} ...${field('msme.registrationNumber')} />`}
    </div>
    <div className="more-block">
      <button type="button" className="link-btn" aria-expanded=${moreTax} onClick=${() => setMoreTax(!moreTax)}><${Icon} name=${moreTax ? 'chevronDown' : 'chevronRight'} size=${13} /> ${moreTax ? 'Hide' : 'Show'} CIN and TAN (optional)</button>
      ${moreTax && html`<div className="form-grid" style=${{ marginTop: 12 }}>
        <${TextField} label="CIN" className="col-6" placeholder="21 characters" maxLength=${21} transform=${(v) => v.toUpperCase()} ...${field('tax.cin')} />
        <${TextField} label="TAN" className="col-6" placeholder="e.g. BLRA12345B" maxLength=${10} transform=${(v) => v.toUpperCase()} ...${field('tax.tan')} />
      </div>`}
    </div>
  <//>`;

  const contactTab = html`<div className="stack">
    <${FormSection} title="Primary contact" description="The person your team deals with.">
      <div className="form-grid">
        <${TextField} label="Contact person" required className="col-6" ...${field('contactPerson')} />
        <${TextField} label="Designation" className="col-6" placeholder="e.g. Sales Manager" ...${field('designation')} />
        <${TextField} label="Email" required type="email" className="col-6" placeholder="name@company.com" ...${field('email')} />
        <${TextField} label="Phone" type="tel" className="col-3" placeholder="+91 98765 43210" ...${field('phone')} />
        <${TextField} label="Alternate phone" type="tel" className="col-3" ...${field('alternatePhone')} />
        <${TextField} label="Website" className="col-6" placeholder="www.example.com" ...${field('website')} />
      </div>
    <//>
    <${FormSection} title="Other contacts" description="Optional. For example accounts, creative or campaign teams."
      badge=${html`<button type="button" className="btn btn-secondary btn-sm" onClick=${() => setContacts([...contacts, { name: '', designation: '', email: '', phone: '' }])}><${Icon} name="plus" size=${14} /> Add contact</button>`}>
      ${contacts.length === 0
        ? html`<p className="muted">No other contacts yet.</p>`
        : html`<ul className="contact-list">${contacts.map((c, i) => html`<li key=${i} className="contact-item">
            <div className="form-grid">
              <${TextField} label="Name" className="col-3" ...${field(`additionalContacts.${i}.name`)} />
              <${TextField} label="Role" className="col-3" ...${field(`additionalContacts.${i}.designation`)} />
              <${TextField} label="Email" className="col-3" ...${field(`additionalContacts.${i}.email`)} />
              <${TextField} label="Phone" className="col-3" ...${field(`additionalContacts.${i}.phone`)} />
            </div>
            <button type="button" className="link-btn contact-remove" onClick=${() => setContacts(contacts.filter((_, j) => j !== i))}><${Icon} name="trash" size=${13} /> Remove this contact</button>
          </li>`)}</ul>`}
    <//>
  </div>`;

  const addressTab = html`<div className="stack">
    <${FormSection} title="Registered address" description="Printed on every document for this publisher.">
      <${AddressFields} prefix="address" field=${field} />
    <//>
    <${FormSection} title="Billing address" description="Where invoices should go, if different.">
      <${CheckField} label="Same as registered address" checked=${form.billingAddress.sameAsRegistered} onChange=${(v) => set('billingAddress.sameAsRegistered', v)} />
      ${!form.billingAddress.sameAsRegistered && html`<div style=${{ marginTop: 14 }}><${AddressFields} prefix="billingAddress" field=${field} /></div>`}
    <//>
  </div>`;

  const commercialTab = html`<${FormSection} title="Commercial terms" description="Optional. These fill in new orders for this publisher automatically; you can still change them on each order.">
    <div className="form-grid">
      <${SelectField} label="Usual pricing model" className="col-4" placeholder="Not set" options=${PRICING_MODELS.map((m) => ({ value: m.code, label: `${m.label} · ${m.hint}` }))} ...${field('commercial.pricingModel')} />
      <${TextField} label=${modelChoice ? `Agreed rate · ${modelChoice.rateLabel.replace(/^Rate /, '').toLowerCase()}` : 'Agreed rate'} className="col-4" prefix="₹" inputMode="decimal" transform=${(v) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')} ...${field('commercial.agreedRate')} />
      <${SelectField} label="Payment terms" className="col-4" placeholder="Use agency default" options=${paymentTermOptions(form.commercial.paymentTerms)} ...${field('commercial.paymentTerms')} />
      <${SelectField} label="GST rate" className="col-4" placeholder="Use agency default" options=${GST_SLABS.map((v) => ({ value: String(v), label: `${v}%` }))} ...${field('commercial.gstPercent')} />
      <${SelectField} label="How GST applies" className="col-8" options=${TAX_TREATMENTS} hint="Automatic compares your state with the publisher’s state. Choose another option only if you are sure." ...${field('commercial.taxTreatment')} />
      <${TextAreaField} label="Rate notes" className="col-12" rows=${3} placeholder="e.g. Homepage banner Rs 40 CPM, article page Rs 25 CPM" ...${field('commercial.rateNotes')} />
    </div>
  <//>`;

  const bankTab = html`<${FormSection} title="Bank details" description="Used by Finance for payments. Account numbers are hidden for most people."
    badge=${html`<span className="tag"><${Icon} name="lock" size=${12} /> Sensitive</span>`}>
    ${!mayEditBank && html`<div className="notice notice-info"><${Icon} name="info" size=${16} /><div>Your role (${currentUser.role()}) cannot change bank details. They are shown below with the account number hidden.</div></div>`}
    <div className="form-grid" style=${{ marginTop: mayEditBank ? 0 : 14 }}>
      <${TextField} label="Account holder name" className="col-6" disabled=${!mayEditBank} ...${field('banking.accountName')} />
      <${TextField} label="Bank name" className="col-6" disabled=${!mayEditBank} ...${field('banking.bankName')} />
      ${accountLocked
        ? html`<${TextField} label="Account number" className="col-4" readOnly value=${maskAccount(form.banking.accountNumber)} onChange=${() => {}}
            hint=${mayEditBank ? html`<button type="button" className="link-btn" onClick=${() => { setReplacingAccount(true); set('banking.accountNumber', ''); }}>Replace with a new number</button>` : 'Hidden for your role'} />`
        : html`<${TextField} label="Account number" className="col-4" disabled=${!mayEditBank} type=${showAccount || !form.banking.accountNumber ? 'text' : 'password'} inputMode="numeric" autoComplete="off"
            transform=${(v) => v.replace(/\D/g, '')} maxLength=${18} hint=${form.banking.accountNumber ? html`<button type="button" className="link-btn" onClick=${() => setShowAccount(!showAccount)}>${showAccount ? 'Hide' : 'Show'} number</button>` : '9 to 18 digits'} ...${field('banking.accountNumber')} />`}
      <${TextField} label="IFSC" className="col-4" disabled=${!mayEditBank} placeholder="e.g. HDFC0001234" maxLength=${11} transform=${(v) => v.toUpperCase()} ...${field('banking.ifsc')} />
      <${TextField} label="Branch" className="col-4" disabled=${!mayEditBank} ...${field('banking.branch')} />
    </div>
  <//>`;

  const documentsTab = html`<${FormSection} title="Documents" description="Upload once. The files stay with the publisher record."
    badge=${html`<span className="tag">${plural(form.complianceDocuments.length, 'file')}</span>`}>
    <${ComplianceDocuments} staged docs=${form.complianceDocuments} msmeRegistered=${form.msme.registered}
      onFileUploaded=${(id) => sessionUploads.current.add(id)}
      onChange=${(docs) => setForm((f) => ({ ...f, complianceDocuments: docs }))} />
  <//>`;

  const body = { basic: basicTab, contact: contactTab, address: addressTab, commercial: commercialTab, bank: bankTab, documents: documentsTab }[tab];

  return html`<form className="publisher-form" noValidate onSubmit=${(e) => { e.preventDefault(); submit(); }}>
    ${limited
      ? html`<div className="notice notice-info"><${Icon} name="info" size=${16} /><div>Your role (${currentUser.role()}) can update bank details only. Everything else on this publisher stays as it is.</div></div>`
      : html`<p className="form-note"><span className="req">*</span> means required. Everything else can be added later.</p>`}
    <${Tabs} label="Publisher sections" active=${tab} onChange=${setTab} tabs=${tabsAvailable.map((t) => ({ id: t.id, label: t.label, alert: errorTabs.has(t.id) }))} />
    <div role="tabpanel" aria-labelledby=${'tab-' + tab}>${body}</div>

    <div className="form-footer">
      <span className="form-footer-note">${isEdit ? 'Changes are recorded in the activity log.' : `Will be added by ${currentUser.get().name}.`}</span>
      <div className="form-footer-actions">
        <button type="button" className="btn btn-ghost" onClick=${cancel} disabled=${saving}>Cancel</button>
        ${!isLast && html`<button type="button" className="btn btn-secondary" onClick=${() => { setTab(tabsAvailable[tabIndex + 1].id); window.scrollTo({ top: 0 }); }}>Next: ${tabsAvailable[tabIndex + 1].label} <${Icon} name="arrowRight" size=${15} /></button>`}
        <button type="submit" className="btn btn-primary" disabled=${saving}>${saving ? html`<span className="spinner spinner-sm spinner-light"></span> Saving…` : isEdit ? 'Save Changes' : 'Add Publisher'}</button>
      </div>
    </div>

    ${dupes && html`<${DuplicateModal} matches=${dupes} onClose=${() => setDupes(null)}
      onView=${(p) => { saved.current = false; navigate(`/publishers/${p.id}`); }}
      onContinue=${() => submit(true)} />`}
  </form>`;
}
