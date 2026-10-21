/* Clients: every client that has an RO, PO or IO, with counts. Click one to see all of its documents. */

/* The list shown inside the Campaigns screen. */
function ClientList({ data }) {
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const all = useMemo(() => (data ? clientSummaries(data.documents, data.campaigns) : []), [data]);
  const rows = useMemo(() => all.filter((c) => matchesTerms(c.name, dq)), [all, dq]);
  const totals = rows.reduce((t, c) => ({ RO: t.RO + c.counts.RO, PO: t.PO + c.counts.PO, IO: t.IO + c.counts.IO, all: t.all + c.total }), { RO: 0, PO: 0, IO: 0, all: 0 });
  const count = (n) => html`<span className=${n ? '' : 'muted'}>${n}</span>`;

  const columns = [
    { key: 'client', header: 'Client', sticky: 'left', render: (c) => html`<${Link} to=${`/campaigns/client/${encodeURIComponent(c.key)}`} className="row-title">${c.name}</${Link}>` },
    { key: 'campaigns', header: 'Campaigns', align: 'right', render: (c) => c.campaigns },
    { key: 'ro', header: 'ROs', align: 'right', render: (c) => count(c.counts.RO) },
    { key: 'po', header: 'POs', align: 'right', render: (c) => count(c.counts.PO) },
    { key: 'io', header: 'IOs', align: 'right', render: (c) => count(c.counts.IO) },
    { key: 'total', header: 'Total documents', align: 'right', render: (c) => html`<strong>${c.total}</strong>` },
    { key: 'booked', header: 'Booked (approved or sent)', align: 'right', render: (c) => html`<span className="nowrap">${fmtINR(c.bookedValue)}</span>` },
    { key: 'action', header: 'Action', sticky: 'right', align: 'right', width: '110px', render: (c) => html`<${Link} to=${`/campaigns/client/${encodeURIComponent(c.key)}`} className="btn btn-secondary btn-sm">View all</${Link}>` },
  ];

  if (!data) return html`<section className="card"><${CenterSpinner} /></section>`;
  if (all.length === 0) {
    return html`<section className="card"><${EmptyState} icon="building" title="No clients yet" description="A client appears here as soon as you create an RO, PO or IO for it."
      action=${can('document.create') && html`<${Link} to="/documents/new?type=RO" className="btn btn-primary"><${Icon} name="plus" size=${15} /> Create RO</${Link}>`} /></section>`;
  }
  return html`<section className="card">
    <div className="toolbar toolbar-row">
      <${SearchBar} className="toolbar-search" value=${q} onChange=${setQ} placeholder="Search clients" />
    </div>
    <div className="table-meta">
      <span>${plural(rows.length, 'client')} · ${plural(totals.RO, 'RO')}, ${plural(totals.PO, 'PO')}, ${plural(totals.IO, 'IO')}</span>
      ${q && html`<button className="link-btn" onClick=${() => setQ('')}>Clear search</button>`}
    </div>
    ${rows.length === 0
      ? html`<${EmptyState} icon="search" title="No clients match your search" action=${html`<button className="btn btn-secondary" onClick=${() => setQ('')}>Clear search</button>`} />`
      : html`<${DataTable} rows=${rows} rowKey=${(c) => c.key} columns=${columns} onRowClick=${(c) => navigate(`/campaigns/client/${encodeURIComponent(c.key)}`)} />`}
  </section>`;
}

/* One client: all of its ROs, POs and IOs. */
function ClientPage({ params }) {
  const data = usePortalData();
  const [type, setType] = useState('');
  const key = params.key;
  const summary = data ? clientSummaries(data.documents, data.campaigns).find((c) => c.key === key) : null;
  const name = summary ? summary.name : 'Client';
  usePageMeta(name, [{ label: 'Campaigns', to: '/campaigns' }, { label: name }]);

  if (!data) return html`<div className="page"><${CenterSpinner} /></div>`;
  if (!summary) {
    return html`<div className="page"><section className="card"><${EmptyState} icon="building" title="No documents for this client" description="This client has no ROs, POs or IOs, or it was archived."
      action=${html`<${Link} to="/campaigns" className="btn btn-primary">Back to Campaigns</${Link}>`} /></section></div>`;
  }

  const mine = data.documents.filter((d) => !d.archived && clientKey(d.client?.name) === key).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const shown = type ? mine.filter((d) => d.documentType === type) : mine;
  const campaigns = data.campaigns.filter((c) => clientKey(c.client) === key);
  const tabs = [
    { id: '', label: 'All', count: summary.total },
    ...DOCUMENT_TYPE_LIST.filter((t) => t.enabled).map((t) => ({ id: t.code, label: `${t.code}s`, count: summary.counts[t.code] || 0 })),
  ];

  return html`<div className="page">
    <section className="card profile-head">
      <div className="profile-id">
        <span className="profile-mark">${initials(name)}</span>
        <div>
          <div className="profile-name"><h2>${name}</h2></div>
          <div className="profile-legal">${plural(summary.total, 'document')} across ${plural(summary.campaigns, 'campaign')}</div>
        </div>
      </div>
      ${can('document.create') && html`<div className="btn-row">
        <${Link} to="/documents/new?type=RO" className="btn btn-primary"><${Icon} name="filePlus" size=${15} /> Create RO</${Link}>
      </div>`}
    </section>

    <div className="kpi-grid kpi-grid-4">
      <${KPICard} label="ROs" value=${summary.counts.RO || 0} sub="Release Orders" icon="file" />
      <${KPICard} label="POs" value=${summary.counts.PO || 0} sub="Purchase Orders" icon="file" />
      <${KPICard} label="IOs" value=${summary.counts.IO || 0} sub="Insertion Orders" icon="file" />
      <${KPICard} label="Booked value" value=${fmtINR(summary.bookedValue)} sub="Approved or sent, incl. tax" icon="rupee" />
    </div>

    <section className="card">
      <div className="tabbar"><${Tabs} label="Document types" tabs=${tabs} active=${type} onChange=${setType} className="tabs-flush" /></div>
      ${shown.length === 0
        ? html`<${EmptyState} compact icon="file" title=${`No ${type}s for ${name} yet`} />`
        : html`<${DataTable} rows=${shown} columns=${[{ key: 'type', header: 'Type', width: '70px', render: (d) => html`<${Tag}>${d.documentType}</${Tag}>` }, ...documentColumns()]} onRowClick=${(d) => navigate(`/documents/${d.id}`)} rowClass=${(d) => (d.status === 'Cancelled' ? 'is-muted' : '')} />`}
    </section>

    ${campaigns.length > 0 && html`<section className="card">
      <header className="card-header"><h2 className="card-title">Campaigns</h2><span className="tag">${campaigns.length}</span></header>
      <div className="card-body no-pad"><ul className="mini-list">${campaigns.map((c) => html`<li key=${c.id}>
        <${Link} to=${`/campaigns/${c.id}`} className="mini-item">
          <span className="mini-main"><strong>${c.name}</strong><${StatusBadge} status=${c.status} /></span>
          <span className="mini-sub">${c.startDate || c.endDate ? `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` : 'No dates set'}</span>
        </${Link}></li>`)}</ul></div>
    </section>`}
  </div>`;
}
