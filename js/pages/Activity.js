function ActivityPage() {
  usePageMeta('Activity log', [{ label: 'Settings', to: '/settings' }, { label: 'Activity log' }]);
  const { data: all } = useQuery(() => auditService.list());
  const [f, setF] = useState({ q: '', action: '', entityType: '', user: '', from: '', to: '' });
  const [limit, setLimit] = useState(50);
  const setKey = (k) => (v) => { setF((s) => ({ ...s, [k]: v })); setLimit(50); };
  const dq = useDeferredValue(f.q);

  const entries = all || [];
  const users = useMemo(() => {
    const m = new Map();
    entries.forEach((a) => a.performedBy && m.set(a.performedBy.id, a.performedBy.name));
    return [...m].map(([value, label]) => ({ value, label }));
  }, [entries]);
  const rows = useMemo(() => filterActivity(entries, { ...f, q: dq }), [entries, f, dq]);
  const hasFilters = Object.values(f).some(Boolean);
  const clear = () => { setF({ q: '', action: '', entityType: '', user: '', from: '', to: '' }); setLimit(50); };

  return html`<div className="page">
    <div className="page-actions"><p className="page-sub">A record of who did what, and when. Nothing here can be edited.</p></div>
    <section className="card">
      <div className="toolbar">
        <${SearchBar} className="toolbar-search" value=${f.q} onChange=${setKey('q')} placeholder="Search by user, document number, publisher or action…" />
        <div className="toolbar-filters wrap">
          <${SelectField} label="Action" value=${f.action} onChange=${setKey('action')} placeholder="All actions" options=${Object.entries(AUDIT_ACTIONS).map(([value, a]) => ({ value, label: a.label }))} />
          <${SelectField} label="Entity" value=${f.entityType} onChange=${setKey('entityType')} placeholder="All" options=${[{ value: 'publisher', label: 'Publishers' }, { value: 'campaign', label: 'Campaigns' }, { value: 'document', label: 'Documents' }]} />
          <${SelectField} label="User" value=${f.user} onChange=${setKey('user')} placeholder="Anyone" options=${users} />
          <${TextField} label="From" type="date" value=${f.from} onChange=${setKey('from')} />
          <${TextField} label="To" type="date" value=${f.to} onChange=${setKey('to')} />
        </div>
      </div>
      <div className="table-meta">
        <span>${all ? `Showing ${Math.min(limit, rows.length)} of ${rows.length} ${rows.length === 1 ? 'event' : 'events'}` : 'Loading…'}</span>
        ${hasFilters && html`<button className="link-btn" onClick=${clear}>Clear filters</button>`}
      </div>
      ${!all ? html`<${CenterSpinner} />`
        : entries.length === 0 ? html`<${EmptyState} icon="activity" title="No activity yet." description="Actions such as onboarding a publisher or creating a document will appear here." />`
        : rows.length === 0 ? html`<${EmptyState} icon="search" title="No activity matches your filters." action=${html`<button className="btn btn-secondary" onClick=${clear}>Clear filters</button>`} />`
        : html`<${ActivityTable} entries=${rows.slice(0, limit)} />
            ${rows.length > limit && html`<div className="load-more"><button className="btn btn-secondary" onClick=${() => setLimit(limit + 50)}>Show more</button></div>`}`}
    </section>
  </div>`;
}
