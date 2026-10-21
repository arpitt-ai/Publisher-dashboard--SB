function ReportsPage({ query }) {
  usePageMeta('Reports', []);
  const data = usePortalData();
  const [id, setId] = useState(REPORTS.some((r) => r.id === query.report) ? query.report : 'campaigns');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const report = REPORTS.find((r) => r.id === id);

  const result = useMemo(() => (data ? reportService.build(id, data, { from, to }) : null), [data, id, from, to]);
  const dateError = from && to && to < from ? 'The end date cannot be before the start date.' : '';

  function exportCsv() {
    const stamp = todayISO();
    downloadCsv(`${report.label.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}-${stamp}.csv`, result.columns, result.rows);
    toast.success(`${plural(result.rows.length, 'row')} exported.`);
  }

  const columns = result ? result.columns.map((col, i) => ({
    key: String(i), header: col.header, align: col.kind === 'money' || col.kind === 'number' ? 'right' : undefined,
    render: (row) => html`<span className=${col.kind === 'money' ? 'nowrap' : ''}>${reportService.display(col, col.value(row))}</span>`,
  })) : [];

  return html`<div className="page">
    <div className="page-actions"><p className="page-sub">Five simple reports. Pick one, choose dates if you want, and download it as a CSV file for Excel.</p></div>

    <section className="card">
      <div className="report-picker" role="tablist" aria-label="Reports">
        ${REPORTS.map((r) => html`<button key=${r.id} id=${'report-' + r.id} type="button" role="tab" aria-selected=${id === r.id} className=${'report-opt' + (id === r.id ? ' is-active' : '')} onClick=${() => setId(r.id)}>${r.label}</button>`)}
      </div>
      <div className="toolbar toolbar-row">
        <div className="report-desc">${report.description}</div>
        <div className="toolbar-inline">
          <${TextField} label="From" type="date" value=${from} onChange=${setFrom} />
          <${TextField} label="To" type="date" value=${to} error=${dateError} onChange=${setTo} />
          ${(from || to) && html`<button type="button" className="link-btn" onClick=${() => { setFrom(''); setTo(''); }}>Clear dates</button>`}
          <button type="button" className="btn btn-primary" disabled=${!result || result.rows.length === 0 || !!dateError} onClick=${exportCsv}><${Icon} name="download" size=${15} /> Download CSV</button>
        </div>
      </div>
      <div className="table-meta"><span>${result ? plural(result.rows.length, 'row') : 'Loading…'}</span>
        ${result && result.totals && result.rows.length > 0 && html`<span>${Object.entries(result.totals).map(([k, v]) => `${k}: ${typeof v === 'number' && /value|Total|GST|Before|Amount/i.test(k) ? fmtINR(v) : fmtNum(v)}`).join(' · ')}</span>`}</div>
      ${!result ? html`<${CenterSpinner} />`
        : result.rows.length === 0
          ? html`<${EmptyState} icon="chart" title="Nothing to show" description=${from || to ? 'No records fall inside these dates. Try a wider range.' : 'There are no records for this report yet.'} />`
          : html`<${DataTable} rows=${result.rows} columns=${columns} rowKey=${(r) => (r.c && r.c.id) || (r.d && r.d.id) || r.id || r.month || r.type || JSON.stringify(r).slice(0, 40)} />`}
    </section>
  </div>`;
}
