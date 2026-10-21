/* Value of the approved / sent documents in a campaign. */
const bookedValue = (docs) => docs.filter((d) => !d.archived && BOOKED_STATUSES.includes(d.status)).reduce((s, d) => s + toNum(d.commercial?.totalAmount), 0);

function CampaignsPage({ query }) {
  usePageMeta('Clients', []);
  const data = usePortalData();
  const [q, setQ] = useState(query.q || '');
  const [status, setStatus] = useState(CAMPAIGN_STATUSES.includes(query.status) ? query.status : '');
  const dq = useDeferredValue(q);
  const canEdit = can('campaign.edit');
  // Clients first; links that ask for a specific campaign status open the campaign list.
  const [view, setView] = useState(query.view === 'campaigns' || CAMPAIGN_STATUSES.includes(query.status) ? 'campaigns' : 'clients');

  const campaigns = data ? data.campaigns : [];
  const rows = useMemo(() => filterCampaigns(campaigns, { q: dq, status }), [campaigns, dq, status]);
  const docsByCampaign = useMemo(() => {
    const m = {};
    (data ? data.documents : []).forEach((d) => { (m[d.campaignId] = m[d.campaignId] || []).push(d); });
    return m;
  }, [data]);
  const clear = () => { setQ(''); setStatus(''); };

  const columns = [
    { key: 'name', header: 'Campaign', sticky: 'left', width: '200px', render: (c) => html`<${Link} to=${`/campaigns/${c.id}`} className="row-title">${c.name}</${Link}>${c.isDemo ? html` <${Tag} title="Created from sample data">Sample</${Tag}>` : ''}` },
    { key: 'client', header: 'Client', render: (c) => html`<span className="clamp" title=${c.client}>${c.client}</span>` },
    { key: 'owner', header: 'Owner', render: (c) => c.owner || '—' },
    { key: 'dates', header: 'Dates', render: (c) => html`<span className="nowrap">${c.startDate || c.endDate ? `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` : '—'}</span>` },
    { key: 'docs', header: 'Documents', align: 'right', render: (c) => (docsByCampaign[c.id] || []).filter((d) => !d.archived).length },
    { key: 'booked', header: 'Booked', align: 'right', render: (c) => html`<span className="nowrap">${fmtINR(bookedValue(docsByCampaign[c.id] || []))}</span>` },
    { key: 'status', header: 'Status', render: (c) => html`<${StatusBadge} status=${c.status} />` },
    { key: 'actions', header: 'Action', sticky: 'right', align: 'right', width: '150px', render: (c) => html`<div className="row-actions">
      <${Link} to=${`/campaigns/${c.id}`} className="btn btn-secondary btn-sm">View</${Link}>
      ${canEdit && html`<${Link} to=${`/campaigns/${c.id}/edit`} className="btn btn-secondary btn-sm">Edit</${Link}>`}
    </div>` },
  ];

  return html`<div className="page">
    <div className="page-actions">
      <p className="page-sub">${view === 'clients' ? 'Every client with ROs, POs or IOs. Open one to see all of its documents.' : 'Each campaign groups the ROs, POs and IOs for one client engagement.'}</p>
      ${canEdit && html`<${Link} to="/campaigns/new" className="btn btn-primary"><${Icon} name="plus" size=${15} /> New Campaign</${Link}>`}
    </div>
    <${Tabs} label="Campaign views" active=${view} onChange=${setView} tabs=${[
      { id: 'clients', label: 'Clients', count: data ? clientSummaries(data.documents).length : undefined },
      { id: 'campaigns', label: 'All campaigns', count: data ? campaigns.length : undefined },
    ]} />
    ${view === 'clients' ? html`<${ClientList} data=${data} />` : data && campaigns.length === 0
      ? html`<section className="card"><${EmptyState} icon="campaign" title="No campaigns yet" description="Create a campaign once, then reuse it on every order for that client."
          action=${canEdit && html`<${Link} to="/campaigns/new" className="btn btn-primary"><${Icon} name="plus" size=${15} /> New Campaign</${Link}>`} /></section>`
      : html`<section className="card">
        <div className="toolbar toolbar-row">
          <${SearchBar} className="toolbar-search" value=${q} onChange=${setQ} placeholder="Search by campaign, client or owner" />
          <div className="toolbar-inline"><${SelectField} label="Status" value=${status} onChange=${setStatus} placeholder="All" options=${CAMPAIGN_STATUSES} /></div>
        </div>
        <div className="table-meta">
          <span>${data ? `Showing ${rows.length} of ${campaigns.length} ${campaigns.length === 1 ? 'campaign' : 'campaigns'}` : 'Loading…'}</span>
          ${(q || status) && html`<button className="link-btn" onClick=${clear}>Clear search</button>`}
        </div>
        ${!data ? html`<${CenterSpinner} />`
          : rows.length === 0
            ? html`<${EmptyState} icon="search" title="No campaigns match your search" action=${html`<button className="btn btn-secondary" onClick=${clear}>Clear search</button>`} />`
            : html`<${DataTable} rows=${rows} columns=${columns} onRowClick=${(c) => navigate(`/campaigns/${c.id}`)} rowClass=${(c) => (['Completed', 'Cancelled'].includes(c.status) ? 'is-muted' : '')} />`}
      </section>`}
  </div>`;
}

/* ── Create / edit ─────────────────────────────────────────── */
function CampaignForm({ mode, initial, publishers, onSaved, onCancel }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(() => withDefaults(initial, createEmptyCampaign()));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [moreClient, setMoreClient] = useState(() => !!(initial.clientDetails && Object.values(initial.clientDetails).some(Boolean)));
  const formRef = useRef(form);
  formRef.current = form;
  const initialJson = useRef(JSON.stringify(withDefaults(initial, createEmptyCampaign())));

  const set = (path, value) => {
    setForm((f) => setPath(f, path, value));
    setErrors((e) => { if (!e[path]) return e; const n = { ...e }; delete n[path]; return n; });
  };
  const blur = (path) => {
    const err = validateCampaign(formRef.current)[path];
    setErrors((e) => { const n = { ...e }; if (err) n[path] = err; else delete n[path]; return n; });
  };
  const field = (path, extra = {}) => ({ value: getPath(form, path), error: errors[path], name: path, onChange: (v) => set(path, v), onBlur: () => blur(path), ...extra });
  const pubById = useMemo(() => Object.fromEntries(publishers.map((p) => [p.id, p])), [publishers]);

  async function submit(e) {
    e.preventDefault();
    const errs = validateCampaign(form);
    setErrors(errs);
    if (Object.keys(errs).length) { toast.error('Please fix the highlighted fields.'); scrollToFirstError(); return; }
    if (!isEdit) {
      const dup = await campaignService.findByNameAndClient(form.name, form.client);
      if (dup && !(await confirmDialog({ title: 'This campaign already exists', message: `“${dup.name}” for ${dup.client} is already in your list. Create another one anyway?`, confirmLabel: 'Create anyway', cancelLabel: 'Go back' }))) return;
    }
    setSaving(true);
    const { ok, result } = await runAction(
      { loading: 'Saving campaign...', success: isEdit ? 'Campaign updated.' : 'Campaign created.' },
      () => (isEdit ? campaignService.update(form.id, form) : campaignService.create({ ...form, status: form.status || suggestCampaignStatus(form.startDate, form.endDate) })),
    );
    setSaving(false);
    if (ok) onSaved(result);
  }

  async function cancel() {
    if (JSON.stringify(formRef.current) !== initialJson.current && !(await confirmDialog({ title: 'Leave without saving?', message: 'Your changes will be lost.', confirmLabel: 'Leave', cancelLabel: 'Keep editing', danger: true }))) return;
    onCancel();
  }

  const available = publishers.filter((p) => canBookPublisher(p) && !form.publisherIds.includes(p.id));

  return html`<form className="publisher-form" noValidate onSubmit=${submit}>
    <p className="form-note"><span className="req">*</span> means required.</p>
    <${FormSection} title="Campaign details" description="Orders created for this campaign will fill these in for you.">
      <div className="form-grid">
        <${TextField} label="Campaign name" required className="col-6" placeholder="e.g. Diwali Mega Sale 2026" autoFocus=${!isEdit} ...${field('name')} />
        <${TextField} label="Client / advertiser" required className="col-6" placeholder="e.g. HDFC Bank" ...${field('client')} />
        <${TextField} label="Campaign owner" className="col-4" placeholder="Who looks after it" hint="Your team member responsible." ...${field('owner')} />
        <${TextField} label="Start date" type="date" className="col-4" ...${field('startDate')} />
        <${TextField} label="End date" type="date" className="col-4" ...${field('endDate', { onBlur: () => { blur('endDate'); blur('startDate'); } })} />
        <${TextField} label="Budget" className="col-4" prefix="₹" inputMode="decimal" transform=${(v) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')} hint="Optional" ...${field('budget')} />
        <${SelectField} label="Status" className="col-4" options=${CAMPAIGN_STATUSES} ...${field('status')} />
        <${TextAreaField} label="Notes" className="col-12" rows=${3} ...${field('notes')} />
      </div>
      <div className="more-block">
        <button type="button" className="link-btn" aria-expanded=${moreClient} onClick=${() => setMoreClient(!moreClient)}><${Icon} name=${moreClient ? 'chevronDown' : 'chevronRight'} size=${13} /> ${moreClient ? 'Hide' : 'Add'} client legal details (optional)</button>
        ${moreClient && html`<div className="form-grid" style=${{ marginTop: 12 }}>
          <${TextField} label="Client legal name" className="col-6" ...${field('clientDetails.legalEntity')} />
          <${TextField} label="Client GSTIN" className="col-6" maxLength=${15} transform=${(v) => v.toUpperCase()} ...${field('clientDetails.gstin')} />
          <${TextAreaField} label="Client address" className="col-12" rows=${2} ...${field('clientDetails.address')} />
        </div>`}
      </div>
    <//>

    <${FormSection} title="Publishers" description="Publishers working on this campaign. They are also added automatically when you create an order for them.">
      ${form.publisherIds.length === 0 ? html`<p className="muted">No publishers added yet.</p>` : html`<ul className="chip-list">${form.publisherIds.map((id) => html`<li key=${id} className="chip">
        ${pubById[id] ? pubById[id].publisherName : 'Removed publisher'}
        <button type="button" className="chip-x" aria-label=${`Remove ${pubById[id] ? pubById[id].publisherName : 'publisher'}`} onClick=${() => set('publisherIds', form.publisherIds.filter((x) => x !== id))}><${Icon} name="x" size=${12} /></button>
      </li>`)}</ul>`}
      <div style=${{ marginTop: 12, maxWidth: 520 }}>
        <${PublisherPicker} publishers=${available} placeholder="Add a publisher…" onSelect=${(p) => set('publisherIds', [...form.publisherIds, p.id])} />
      </div>
    <//>

    <div className="form-footer">
      <span className="form-footer-note">${isEdit ? 'Documents already issued keep the campaign details they were created with.' : ''}</span>
      <div className="form-footer-actions">
        <button type="button" className="btn btn-ghost" onClick=${cancel} disabled=${saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled=${saving}>${saving ? html`<span className="spinner spinner-sm spinner-light"></span> Saving…` : isEdit ? 'Save Changes' : 'Create Campaign'}</button>
      </div>
    </div>
  </form>`;
}

function NewCampaignPage() {
  usePageMeta('New Campaign', [{ label: 'Campaigns', to: '/campaigns' }, { label: 'New Campaign' }]);
  const { data: publishers } = useQuery(() => publisherService.list());
  const initial = useMemo(() => ({ ...createEmptyCampaign(), owner: currentUser.get().name }), []);
  if (!can('campaign.edit')) return html`<${NoPermission} what="create campaigns" back="/campaigns" />`;
  if (!publishers) return html`<div className="page"><${CenterSpinner} /></div>`;
  return html`<div className="page page-form"><${CampaignForm} mode="create" initial=${initial} publishers=${publishers}
    onSaved=${(c) => navigate(`/campaigns/${c.id}`)} onCancel=${() => navigate('/campaigns')} /></div>`;
}

function EditCampaignPage({ params }) {
  const { data: campaign, loading } = useQuery(() => campaignService.get(params.id), [params.id]);
  const { data: publishers } = useQuery(() => publisherService.list());
  usePageMeta(campaign ? `Edit ${campaign.name}` : 'Edit Campaign', [{ label: 'Campaigns', to: '/campaigns' }, { label: campaign ? campaign.name : 'Campaign', to: `/campaigns/${params.id}` }, { label: 'Edit' }]);
  const [frozen, setFrozen] = useState(null);
  useEffect(() => { if (campaign && !frozen) setFrozen(campaign); }, [campaign]);
  if (!can('campaign.edit')) return html`<${NoPermission} what="edit campaigns" back=${`/campaigns/${params.id}`} />`;
  if ((loading && !frozen) || !publishers) return html`<div className="page"><${CenterSpinner} /></div>`;
  if (!campaign && !frozen) return html`<div className="page"><section className="card"><${EmptyState} icon="campaign" title="Campaign not found" action=${html`<${Link} to="/campaigns" className="btn btn-primary">Back to Campaigns</${Link}>`} /></section></div>`;
  if (!frozen) return null;
  return html`<div className="page page-form"><${CampaignForm} mode="edit" initial=${frozen} publishers=${publishers}
    onSaved=${(c) => navigate(`/campaigns/${c.id}`)} onCancel=${() => navigate(`/campaigns/${frozen.id}`)} /></div>`;
}

/* ── One campaign: who is on it and every document ─────────── */
function CampaignDetailPage({ params }) {
  const data = usePortalData();
  const campaign = data ? data.campaigns.find((c) => c.id === params.id) : null;
  usePageMeta(campaign ? campaign.name : 'Campaign', [{ label: 'Campaigns', to: '/campaigns' }, { label: campaign ? campaign.name : 'Campaign' }]);
  if (!data) return html`<div className="page"><${CenterSpinner} /></div>`;
  if (!campaign) {
    return html`<div className="page"><section className="card"><${EmptyState} icon="campaign" title="Campaign not found" description="It may have been removed."
      action=${html`<${Link} to="/campaigns" className="btn btn-primary">Back to Campaigns</${Link}>`} /></section></div>`;
  }

  const docs = data.documents.filter((d) => d.campaignId === campaign.id && !d.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pubById = Object.fromEntries(data.publishers.map((p) => [p.id, p]));
  const publisherIds = [...new Set([...campaign.publisherIds, ...docs.map((d) => d.publisherId)])];
  const booked = bookedValue(docs);
  const budget = toNum(campaign.budget);
  const canCreate = can('document.create');
  const pubRows = publisherIds.map((id) => {
    const mine = docs.filter((d) => d.publisherId === id);
    return { id, pub: pubById[id], name: pubById[id]?.publisherName || mine[0]?.publisherSnapshot?.publisherName || 'Removed publisher', count: mine.length, value: bookedValue(mine) };
  });

  return html`<div className="page">
    <section className="card profile-head">
      <div className="profile-id">
        <span className="profile-mark">${initials(campaign.name)}</span>
        <div>
          <div className="profile-name"><h2>${campaign.name}</h2><${StatusBadge} status=${campaign.status} />${campaign.isDemo && html`<${Tag} title="Created from sample data">Sample</${Tag}>`}</div>
          <div className="profile-legal">${campaign.client}${campaign.owner ? ` · Owner: ${campaign.owner}` : ''}</div>
          <div className="profile-attr">${campaign.startDate || campaign.endDate ? `${fmtDate(campaign.startDate)} – ${fmtDate(campaign.endDate)}` : 'No dates set'}</div>
        </div>
      </div>
      <div className="btn-row">
        ${can('campaign.edit') && html`<${Link} to=${`/campaigns/${campaign.id}/edit`} className="btn btn-secondary"><${Icon} name="edit" size=${15} /> Edit</${Link}>`}
        ${canCreate && html`<${Link} to=${`/documents/new?type=RO&campaign=${campaign.id}`} className="btn btn-primary"><${Icon} name="filePlus" size=${15} /> Create RO</${Link}>`}
        <${MenuButton} items=${[
          { label: 'Create PO', icon: 'filePlus', to: `/documents/new?type=PO&campaign=${campaign.id}`, hidden: !canCreate },
          { label: 'Create IO', icon: 'filePlus', to: `/documents/new?type=IO&campaign=${campaign.id}`, hidden: !canCreate },
        ]} />
      </div>
    </section>

    <div className="kpi-grid kpi-grid-4">
      <${KPICard} label="Booked value" value=${fmtINR(booked)} sub="Approved or sent, incl. tax" icon="rupee" />
      <${KPICard} label="Budget" value=${budget > 0 ? fmtINR(budget) : 'Not set'} sub=${budget > 0 ? `${Math.round((booked / budget) * 100)}% booked` : 'Add one when you edit'} icon="chart" />
      <${KPICard} label="Documents" value=${docs.length} sub=${`${docs.filter((d) => d.status === 'Pending Approval').length} waiting for approval`} icon="file" to=${`/documents?campaign=${campaign.id}`} />
      <${KPICard} label="Publishers" value=${pubRows.length} sub="Working on this campaign" icon="building" />
    </div>

    <section className="card">
      <header className="card-header"><h2 className="card-title">Documents</h2><span className="tag">${plural(docs.length, 'document')}</span></header>
      <div className="card-body no-pad">
        ${docs.length === 0
          ? html`<${EmptyState} compact icon="file" title="No documents for this campaign yet" action=${canCreate && html`<${Link} to=${`/documents/new?type=RO&campaign=${campaign.id}`} className="btn btn-primary"><${Icon} name="plus" size=${15} /> Create RO</${Link}>`} />`
          : html`<${DataTable} rows=${docs} columns=${[{ key: 'type', header: 'Type', width: '70px', render: (d) => html`<${Tag}>${d.documentType}</${Tag}>` }, ...documentColumns({ showCampaign: false })]} onRowClick=${(d) => navigate(`/documents/${d.id}`)} />`}
      </div>
    </section>

    <section className="card">
      <header className="card-header"><h2 className="card-title">Publishers</h2></header>
      <div className="card-body no-pad">
        ${pubRows.length === 0
          ? html`<${EmptyState} compact icon="building" title="No publishers yet" description="They appear here when you create an order for them, or add them in Edit." />`
          : html`<${DataTable} rows=${pubRows} columns=${[
              { key: 'name', header: 'Publisher', render: (r) => r.pub ? html`<${Link} to=${`/publishers/${r.id}`} className="row-title">${r.name}</${Link}>` : r.name },
              { key: 'status', header: 'Status', render: (r) => r.pub ? html`<${StatusBadge} status=${r.pub.status} />` : '—' },
              { key: 'count', header: 'Documents', align: 'right', render: (r) => r.count },
              { key: 'value', header: 'Booked', align: 'right', render: (r) => html`<span className="nowrap">${fmtINR(r.value)}</span>` },
            ]} />`}
      </div>
    </section>

    ${campaign.notes && html`<section className="card"><header className="card-header"><h2 className="card-title">Notes</h2></header><div className="card-body"><p className="pre-wrap">${campaign.notes}</p></div></section>`}
  </div>`;
}
