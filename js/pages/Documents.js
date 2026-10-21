/* Orders & Documents — every RO, PO and IO in one table. */
function DocumentsPage({ query }) {
  usePageMeta('Orders & Documents', []);
  const data = usePortalData();
  const [f, setF] = useState({
    q: query.q || '', type: DOCUMENT_TYPES[query.type] ? query.type : '', status: DOCUMENT_STATUSES.includes(query.status) ? query.status : '',
    publisherId: query.publisher || '', campaignId: query.campaign || '', client: '', from: '', to: '', includeArchived: false,
  });
  const [moreOpen, setMoreOpen] = useState(!!(query.publisher || query.campaign));
  const setKey = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const dq = useDeferredValue(f.q);

  const docs = data ? data.documents : [];
  const settings = data ? data.settings : null;
  const publishersById = useMemo(() => Object.fromEntries((data?.publishers || []).map((p) => [p.id, p])), [data]);
  const clients = useMemo(() => [...new Set(docs.map((d) => d.client?.name).filter(Boolean))].sort(), [docs]);
  const pubOptions = useMemo(() => {
    const m = new Map();
    docs.forEach((d) => m.set(d.publisherId, d.publisherSnapshot?.publisherName || publishersById[d.publisherId]?.publisherName || 'Unknown'));
    return [...m].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [docs, publishersById]);
  const campOptions = useMemo(() => (data?.campaigns || []).map((c) => ({ value: c.id, label: `${c.name} · ${c.client}` })).sort((a, b) => a.label.localeCompare(b.label)), [data]);

  const typeFree = { ...f, type: '' }; // tab counts ignore the type tab itself
  const counted = useMemo(() => filterDocuments(docs, { ...typeFree, q: dq }, publishersById), [docs, f.status, f.publisherId, f.campaignId, f.client, f.from, f.to, f.includeArchived, dq, publishersById]);
  const rows = f.type ? counted.filter((d) => d.documentType === f.type) : counted;
  const hasFilters = f.q || f.status || f.publisherId || f.campaignId || f.client || f.from || f.to || f.includeArchived;
  const clear = () => setF((s) => ({ ...s, q: '', status: '', publisherId: '', campaignId: '', client: '', from: '', to: '', includeArchived: false }));
  const liveTotal = docs.filter((d) => !d.archived).length;
  const booked = rows.filter((d) => BOOKED_STATUSES.includes(d.status)).reduce((s, d) => s + toNum(d.commercial?.totalAmount), 0);
  const countOf = (t) => (t ? counted.filter((d) => d.documentType === t).length : counted.length);
  const canCreate = can('document.create');

  const columns = [
    { key: 'num', header: 'Document Number', sticky: 'left', width: '150px', render: (d) => html`<${Link} to=${`/documents/${d.id}`} className="doc-num">${d.documentNumber}</${Link}>${d.archived ? html` <${Tag}>Archived</${Tag}>` : ''}` },
    { key: 'type', header: 'Type', width: '60px', render: (d) => html`<${Tag}>${d.documentType}</${Tag}>` },
    { key: 'campaign', header: 'Campaign', render: (d) => html`<span className="clamp" title=${d.campaign?.name}>${d.campaign?.name || '—'}</span>` },
    { key: 'pub', header: 'Publisher', render: (d) => html`<span className="clamp" title=${d.publisherSnapshot?.publisherName}>${d.publisherSnapshot?.publisherName || '—'}</span>` },
    { key: 'date', header: 'Date', render: (d) => html`<span className="nowrap">${fmtDate(d.issueDate)}</span>` },
    { key: 'amount', header: 'Amount', align: 'right', render: (d) => html`<span className="nowrap">${fmtINR(d.commercial?.totalAmount)}</span>` },
    { key: 'status', header: 'Status', render: (d) => html`<${StatusBadge} status=${d.status} />` },
    {
      key: 'actions', header: 'Actions', sticky: 'right', align: 'right', width: '230px',
      render: (d) => html`<div className="row-actions">
        <${Link} to=${`/documents/${d.id}`} className="btn btn-secondary btn-sm">View</${Link}>
        <button type="button" className="btn btn-secondary btn-sm" onClick=${() => documentActions.download(d)} title=${`Download ${d.documentNumber} as a PDF`}><${Icon} name="download" size=${14} /> PDF</button>
        <${MenuButton} label=${`More actions for ${d.documentNumber}`} iconOnly className="icon-btn" items=${[
          { label: 'Edit', icon: 'edit', to: `/documents/${d.id}/edit`, hidden: !canEditDocument(d) },
          { label: 'Preview PDF', icon: 'eye', onClick: () => documentActions.preview(d) },
          { label: 'View related documents', icon: 'link', to: `/documents/${d.id}?section=related` },
          ...(settings ? statusMenuItems(d, settings, null, { includePrimary: true }) : []),
          { label: 'Duplicate', icon: 'copy', hidden: !canCreate, onClick: () => documentActions.duplicate(d) },
          d.archived
            ? { label: 'Restore', icon: 'restore', hidden: !can('document.archive'), onClick: () => documentActions.restore(d) }
            : { label: 'Archive', icon: 'archive', danger: true, hidden: !can('document.archive'), onClick: () => documentActions.archive(d) },
        ]} />
      </div>`,
    },
  ];

  const tabs = [
    { id: '', label: 'All Documents', count: countOf('') },
    ...DOCUMENT_TYPE_LIST.filter((t) => t.enabled).map((t) => ({ id: t.code, label: `${t.code}s`, count: countOf(t.code) })),
  ];
  const campaignName = f.campaignId ? (data?.campaigns || []).find((c) => c.id === f.campaignId)?.name : '';

  return html`<div className="page">
    <div className="page-actions">
      <p className="page-sub">Every RO, PO and IO in one place. Search, download and keep track of where each one stands.</p>
      ${canCreate && html`<div className="btn-row">
        <${Link} to="/documents/new?type=PO" className="btn btn-secondary"><${Icon} name="filePlus" size=${15} /> Create PO / IO</${Link}>
        <${Link} to="/documents/new?type=RO" className="btn btn-primary"><${Icon} name="filePlus" size=${15} /> Create RO</${Link}>
      </div>`}
    </div>

    ${data && liveTotal === 0 && !f.includeArchived
      ? html`<section className="card"><${EmptyState} icon="file" title="No documents yet" description="Create your first RO, PO or IO. It takes about a minute."
          action=${canCreate && html`<${Link} to="/documents/new?type=RO" className="btn btn-primary"><${Icon} name="plus" size=${15} /> Create RO</${Link}>`} /></section>`
      : html`<section className="card">
        <div className="tabbar"><${Tabs} label="Document types" tabs=${tabs} active=${f.type} onChange=${setKey('type')} className="tabs-flush" /></div>
        <div className="toolbar">
          <div className="toolbar-row">
            <${SearchBar} className="toolbar-search" value=${f.q} onChange=${setKey('q')} placeholder="Search by document number, publisher or campaign" autoFocus />
            <button type="button" className=${'btn btn-secondary' + (moreOpen ? ' is-on' : '')} aria-expanded=${moreOpen} onClick=${() => setMoreOpen(!moreOpen)}><${Icon} name="columns" size=${15} /> More Filters</button>
          </div>
          <div className="toolbar-filters toolbar-filters-3">
            <${SelectField} label="Status" value=${f.status} onChange=${setKey('status')} placeholder="All statuses" options=${DOCUMENT_STATUSES} />
            <${TextField} label="Date from" type="date" value=${f.from} onChange=${setKey('from')} />
            <${TextField} label="Date to" type="date" value=${f.to} onChange=${setKey('to')} />
          </div>
          ${moreOpen && html`<div className="toolbar-filters toolbar-filters-3">
            <${SelectField} label="Publisher" value=${f.publisherId} onChange=${setKey('publisherId')} placeholder="All publishers" options=${pubOptions} />
            <${SelectField} label="Campaign" value=${f.campaignId} onChange=${setKey('campaignId')} placeholder="All campaigns" options=${campOptions} />
            <${SelectField} label="Client" value=${f.client} onChange=${setKey('client')} placeholder="All clients" options=${clients} />
            <div className="field"><span className="label">Archived</span><${CheckField} label="Include archived documents" checked=${f.includeArchived} onChange=${setKey('includeArchived')} /></div>
          </div>`}
        </div>
        <div className="table-meta">
          <span>${data ? `Showing ${rows.length} of ${liveTotal} ${liveTotal === 1 ? 'document' : 'documents'}` : 'Loading…'}${rows.length > 0 && booked > 0 ? ` · Approved or sent: ${fmtINR(booked)}` : ''}${campaignName ? ` · Campaign: ${campaignName}` : ''}</span>
          ${hasFilters && html`<button className="link-btn" onClick=${clear}>Clear search and filters</button>`}
        </div>
        ${!data ? html`<${CenterSpinner} />`
          : rows.length === 0
            ? html`<${EmptyState} icon="search" title="No documents match your search" description="Try a different number, publisher or campaign, or clear the filters."
                action=${html`<button className="btn btn-secondary" onClick=${clear}>Clear search and filters</button>`} />`
            : html`<${DataTable} rows=${rows} columns=${columns} onRowClick=${(d) => navigate(`/documents/${d.id}`)} rowClass=${(d) => (d.archived || d.status === 'Cancelled' ? 'is-muted' : '')} />`}
      </section>`}
  </div>`;
}
