function SettingsPage() {
  usePageMeta('Settings', []);
  const { data: stored } = useQuery(() => settingsService.get());
  const [s, setS] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const initialJson = useRef('');
  useEffect(() => { if (stored && !s) { setS(clone(stored)); initialJson.current = JSON.stringify(stored); } }, [stored]);

  if (!s) return html`<div className="page"><${CenterSpinner} /></div>`;
  const editable = can('settings.edit');
  const dirty = JSON.stringify(s) !== initialJson.current;
  const set = (path, v) => { setS((x) => setPath(x, path, v)); setErrors((e) => { const n = { ...e }; delete n[path]; return n; }); };
  const f = (path, extra = {}) => ({ value: getPath(s, path), error: errors[path], name: path, onChange: (v) => set(path, v), ...extra });

  const nextYear = new Date().getFullYear();
  const examples = DOCUMENT_TYPE_LIST.filter((t) => t.enabled).map((t) => formatDocumentNumber(t.code, nextYear, 14, { pattern: s.numbering.pattern || '', padding: Number(s.numbering.padding) || 3 }));

  async function save() {
    const errs = validateSettings(s);
    setErrors(errs);
    if (Object.keys(errs).length) { toast.error('Please fix the highlighted fields.'); scrollToFirstError(); return; }
    setSaving(true);
    const next = { ...s, numbering: { pattern: s.numbering.pattern, padding: Number(s.numbering.padding) }, defaults: { ...s.defaults, gstPercent: toNum(s.defaults.gstPercent) } };
    const { ok } = await runAction({ loading: 'Saving settings...', success: 'Settings saved.' }, () => settingsService.update(next));
    setSaving(false);
    if (ok) { setS(next); initialJson.current = JSON.stringify(next); }
  }

  return html`<div className="page page-form">
    ${!editable && html`<div className="notice notice-info"><${Icon} name="lock" size=${16} /><div>Only an Admin can change these settings. You can look at them, but not edit them.</div></div>`}
    <fieldset className="plain-fieldset" disabled=${!editable}>
    <div className="stack">
    <${FormSection} title="Your agency" description="These details are printed on every new document: the header, the agency block and the footer.">
      <div className="form-grid">
        <${TextField} label="Agency name" required className="col-6" ...${f('organization.name')} />
        <${TextField} label="Legal name (footer)" className="col-6" hint="Shown in capitals in the PDF footer." ...${f('organization.footerName')} />
        <${TextField} label="Address" className="col-6" ...${f('organization.address')} />
        <${TextField} label="Short address (footer)" className="col-6" ...${f('organization.footerAddress')} />
        <${TextField} label="GSTIN" className="col-4" hint="Its first two digits (your state) decide CGST + SGST or IGST." ...${f('organization.gstin')} />
        <${TextField} label="CIN" className="col-4" ...${f('organization.cin')} />
        <${TextField} label="Website" className="col-4" ...${f('organization.website')} />
        <${TextField} label="Contact person" className="col-4" ...${f('organization.contactPerson')} />
        <${TextField} label="Email" className="col-4" ...${f('organization.email')} />
        <${TextField} label="Accounts email" className="col-4" ...${f('organization.accountsEmail')} />
        <${TextField} label="Office cities (header strip)" className="col-12" ...${f('organization.cities')} />
      </div>
      <p className="hint hint-block">Documents you have already created keep the agency details they were made with.</p>
    <//>

    <${FormSection} title="Documents and approval" description="How new documents start out and how they are numbered.">
      <div className="form-grid">
        <${TextField} label="Usual GST rate" required className="col-4" suffix="%" inputMode="decimal" ...${f('defaults.gstPercent')} />
        <${TextField} label="Usual payment terms" className="col-8" hint="Printed on every document unless you change it on that order." ...${f('defaults.paymentTerms')} />
        <${Segmented} label="Does a document need approval before it is sent?" className="col-12" name="workflow.requireApproval" value=${s.workflow.requireApproval}
          hint=${s.workflow.requireApproval ? 'Draft, then Pending Approval, then Approved. An Admin or Approver approves it.' : 'Anyone who can create documents can approve them straight from Draft.'}
          onChange=${(v) => set('workflow.requireApproval', v)} options=${[{ value: true, label: 'Yes, needs approval' }, { value: false, label: 'No, approve directly' }]} />
        <${TextField} label="Numbering format" className="col-4" hint="Use {TYPE}, {YEAR} and {SEQ}." ...${f('numbering.pattern')} />
        <${TextField} label="Digits in the number" className="col-4" inputMode="numeric" hint="For example 3 gives 014." ...${f('numbering.padding')} />
        <div className="field col-4"><span className="label">The next numbers will look like</span><div className="numbering-preview mono">${examples.join('  ·  ')}</div>
          <div className="hint">Numbers never repeat, even after a document is cancelled. Changes apply to new documents only.</div></div>
      </div>
    <//>
    </div>
    </fieldset>

    <${RoleCard} />
    <${DataManagement} />

    <div className="form-footer">
      <span className="form-footer-note">${!editable ? 'View only.' : dirty ? 'You have unsaved changes.' : 'All settings are saved.'}</span>
      <div className="form-footer-actions">
        <button className="btn btn-secondary" disabled=${!editable || !dirty || saving} onClick=${() => { setS(clone(JSON.parse(initialJson.current))); setErrors({}); }}>Reset</button>
        <button className="btn btn-primary" disabled=${!editable || !dirty || saving} onClick=${save}>${saving ? html`<span className="spinner spinner-sm spinner-light"></span> Saving…` : 'Save Settings'}</button>
      </div>
    </div>
  </div>`;
}

/* Test mode: switch role to see what each team member would see. Not a security control. */
function RoleCard() {
  const user = currentUser.get();
  return html`<${FormSection} title="Who is using the portal" description="Sign-in is not set up yet, so all work is recorded under one name. You can pretend to be another role to check what each person would see.">
    <div className="form-grid">
      <div className="field col-4"><span className="label">Signed in as</span><div className="numbering-preview">${user.name}</div></div>
      <${SelectField} label="Role (test mode)" className="col-4" options=${ROLES} value=${user.role} onChange=${(v) => storageService.set('role', v)} hint=${ROLE_HELP[user.role]} />
    </div>
    <div className="notice notice-warn" style=${{ marginTop: 14 }}><${Icon} name="alert" size=${16} /><div><strong>Roles are a guide, not security.</strong> Until real sign-in and a server are added, anyone with this browser can switch roles. Do not rely on them to protect sensitive data.</div></div>
    <p className="hint hint-block">The activity history is under <${Link} to="/activity" className="text-link">Activity log</${Link}>.</p>
  <//>`;
}

/* Sample data, backup and storage status. Sample records are flagged and can be removed without touching real ones. */
function DataManagement() {
  const pubs = useQuery(() => publisherService.list()).data || [];
  const docs = useQuery(() => documentService.list()).data || [];
  const sampleP = pubs.filter((p) => p.isDemo).length;
  const sampleD = docs.filter((d) => d.isDemo).length;
  const admin = can('data.manage');

  async function remove() {
    const ok = await confirmDialog({
      title: 'Remove sample data?', danger: true, confirmLabel: 'Remove sample data',
      message: `This removes ${plural(sampleP, 'sample publisher')} and ${plural(sampleD, 'sample document')}, plus their campaigns and activity. Records you created yourself are not touched (sample publishers that your own documents use are kept).`,
    });
    if (!ok) return;
    const { ok: done, result } = await runAction({ loading: 'Removing sample data...', success: 'Sample data removed.' }, () => seedService.removeSampleData());
    if (done && result.keptPublishers) toast.info(`${plural(result.keptPublishers, 'sample publisher')} kept because your documents use them.`);
  }
  async function restore() {
    await runAction({ loading: 'Restoring sample data...', success: 'Sample data restored.' }, () => seedService.restoreSampleData());
  }
  async function wipe() {
    const ok = await confirmDialog({
      title: 'Delete ALL data?', danger: true, confirmLabel: 'Delete everything',
      message: 'This permanently deletes every publisher, campaign, document, uploaded file and activity entry, and resets document numbering. This cannot be undone. Download a backup first if you might need anything.',
    });
    if (!ok) return;
    await runAction({ loading: 'Deleting all data...', success: 'All data deleted.' }, () => seedService.clearAll());
  }
  function backup() {
    const n = seedService.downloadBackup();
    toast.success(`Backup downloaded (${plural(n, 'record')}).`);
  }

  return html`<${FormSection} title="Data and backup" description="Everything is saved in this browser only. Nothing is sent to a server.">
    <div className="data-rows">
      <div className="data-row">
        <div><strong>Where your data lives</strong><div className="muted small">${storageService.isPersistent() ? 'This browser’s local storage. It stays after you close the tab, but it is not shared with colleagues or other browsers.' : 'This browser is blocking storage, so changes will be lost when you refresh.'}</div></div>
        <${StatusBadge} status=${storageService.isPersistent() ? 'Active' : 'Pending Verification'} />
      </div>
      <div className="data-row">
        <div><strong>Download a backup</strong><div className="muted small">A JSON file with every record. It includes bank details, so keep it safe. Uploaded files are not included.</div></div>
        <button className="btn btn-secondary btn-sm" disabled=${!admin} onClick=${backup}><${Icon} name="download" size=${14} /> Download backup</button>
      </div>
      <div className="data-row">
        <div><strong>Sample data</strong><div className="muted small">${sampleP || sampleD ? `${plural(sampleP, 'publisher')} and ${plural(sampleD, 'document')} from the first version, marked “Sample Data”.` : 'No sample records are present.'}</div></div>
        <div className="btn-row">
          <button className="btn btn-secondary btn-sm" disabled=${!admin} onClick=${restore}>Restore sample data</button>
          <button className="btn btn-danger-ghost btn-sm" disabled=${!admin || (!sampleP && !sampleD)} onClick=${remove}>Remove sample data</button>
        </div>
      </div>
      <div className="data-row">
        <div><strong>Delete all data</strong><div className="muted small">Start completely fresh, including document numbering.</div></div>
        <button className="btn btn-danger-ghost btn-sm" disabled=${!admin} onClick=${wipe}>Delete everything</button>
      </div>
    </div>
    ${!admin && html`<p className="hint hint-block">Only an Admin can use these.</p>`}
  <//>`;
}
