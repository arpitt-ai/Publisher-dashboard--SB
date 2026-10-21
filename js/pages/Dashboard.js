function CenterSpinner() {
  return html`<div className="center-spinner"><span className="spinner"></span></div>`;
}

function StatCard({ label, value, sub, to, icon }) {
  return html`<${KPICard} label=${label} value=${value} sub=${sub} to=${to} icon=${icon} />`;
}

function AttentionRow({ doc, hint }) {
  return html`<li className="attn-row">
    <div className="attn-main">
      <${Link} to=${`/documents/${doc.id}`} className="doc-num">${doc.documentNumber}</${Link}>
      <span className="attn-text"><strong>${doc.publisherSnapshot?.publisherName || 'Unknown publisher'}</strong> · ${doc.campaign?.name || 'No campaign'}</span>
    </div>
    <div className="attn-side"><span className="nowrap">${fmtINR(doc.commercial?.totalAmount)}</span><${Link} to=${`/documents/${doc.id}`} className="btn btn-secondary btn-sm">${hint}</${Link}></div>
  </li>`;
}

function DashboardPage() {
  usePageMeta('Dashboard', []);
  const data = usePortalData();
  if (!data) return html`<div className="page"><${CenterSpinner} /></div>`;

  const n = dashboardNumbers(data);
  const firstName = currentUser.get().name.split(' ')[0];
  const canCreate = can('document.create');
  const isEmpty = data.publishers.length === 0 && data.documents.length === 0;

  return html`<div className="page">
    <section className="welcome">
      <div>
        <h2 className="welcome-title">Welcome back, ${firstName}</h2>
        <p className="page-sub">${fmtDate(todayISO())} · Here is what is happening and what needs you.</p>
      </div>
      <div className="btn-row">
        ${can('publisher.edit') && html`<${Link} to="/publishers/new" className="btn btn-secondary"><${Icon} name="plus" size=${15} /> Add Publisher</${Link}>`}
        ${canCreate && html`<${Link} to="/documents/new?type=RO" className="btn btn-primary"><${Icon} name="filePlus" size=${15} /> Create RO</${Link}>`}
        ${canCreate && html`<${Link} to="/documents/new?type=PO" className="btn btn-secondary"><${Icon} name="filePlus" size=${15} /> Create PO / IO</${Link}>`}
        <${Link} to="/documents" className="btn btn-secondary"><${Icon} name="file" size=${15} /> View All Documents</${Link}>
      </div>
    </section>

    ${isEmpty && html`<section className="card"><${EmptyState} icon="building" title="Let’s get started" description="Add your first publisher, then create an RO, PO or IO for it."
      action=${can('publisher.edit') && html`<${Link} to="/publishers/new" className="btn btn-primary"><${Icon} name="plus" size=${15} /> Add Publisher</${Link}>`} /></section>`}

    <div className="kpi-grid">
      <${StatCard} label="Active Publishers" value=${n.activePublishers} sub=${`of ${data.publishers.length} publishers`} icon="building" to="/publishers?status=Active" />
      <${StatCard} label="Campaigns in Progress" value=${n.campaignsInProgress} sub=${`of ${data.campaigns.length} campaigns`} icon="campaign" to="/campaigns?status=In%20Progress" />
      <${StatCard} label="Pending Approval" value=${n.pending.length} sub=${n.pending.length ? 'Waiting for an approver' : 'Nothing waiting'} icon="clock" to="/documents?status=Pending%20Approval" />
      <${StatCard} label="Total Booking Value" value=${fmtINR(n.bookingValue)} sub=${`${plural(n.bookedCount, 'approved or sent document')}, incl. tax`} icon="rupee" to="/reports?report=monthly" />
    </div>

    <div className="dash-grid">
      <section className="card">
        <header className="card-header"><h2 className="card-title">Needs your attention</h2>
          ${n.pending.length > 0 && html`<${Link} to="/documents?status=Pending%20Approval" className="text-link">See all</${Link}>`}</header>
        <div className="card-body no-pad">
          ${n.pending.length + n.rejected.length + n.drafts.length === 0
            ? html`<${EmptyState} compact icon="checkCircle" title="You are all caught up" description="No documents are waiting for approval, and there are no drafts to finish." />`
            : html`<ul className="attn-list">
                ${n.pending.slice(0, 5).map((d) => html`<${AttentionRow} key=${d.id} doc=${d} hint=${can('document.approve') ? 'Review' : 'View'} />`)}
                ${n.pending.length > 5 && html`<li className="attn-more"><${Link} to="/documents?status=Pending%20Approval" className="text-link">+${n.pending.length - 5} more waiting for approval</${Link}></li>`}
                ${n.rejected.length > 0 && html`<li className="attn-note"><${StatusBadge} status="Rejected" /> <${Link} to="/documents?status=Rejected" className="text-link">${plural(n.rejected.length, 'document')} sent back</${Link}> — open it to see the reason and fix it.</li>`}
                ${n.drafts.length > 0 && html`<li className="attn-note"><${StatusBadge} status="Draft" /> <${Link} to="/documents?status=Draft" className="text-link">${plural(n.drafts.length, 'draft')}</${Link}> to finish and submit.</li>`}
              </ul>`}
        </div>
      </section>

      <section className="card">
        <header className="card-header"><h2 className="card-title">Coming up in the next 30 days</h2><${Link} to="/campaigns" className="text-link">All campaigns</${Link}></header>
        <div className="card-body no-pad">
          ${n.upcoming.length === 0
            ? html`<${EmptyState} compact icon="calendar" title="Nothing starts or ends soon" description="Campaign start and end dates will show here." />`
            : html`<ul className="mini-list">${n.upcoming.slice(0, 6).map((u) => html`<li key=${u.campaign.id + u.kind}>
                <${Link} to=${`/campaigns/${u.campaign.id}`} className="mini-item">
                  <span className="mini-main"><strong>${u.campaign.name}</strong><span className=${'tag ' + (u.kind === 'Starts' ? 'tag-accent' : '')}>${u.kind} ${fmtDate(u.date)}</span></span>
                  <span className="mini-sub">${u.campaign.client}</span>
                </${Link}></li>`)}</ul>`}
        </div>
      </section>
    </div>

    <section className="card">
      <header className="card-header"><h2 className="card-title">Recently updated documents</h2><${Link} to="/documents" className="text-link">View all</${Link}></header>
      <div className="card-body no-pad">
        ${n.recent.length === 0
          ? html`<${EmptyState} compact icon="file" title="No documents yet" action=${canCreate && html`<${Link} to="/documents/new?type=RO" className="btn btn-primary"><${Icon} name="plus" size=${15} /> Create RO</${Link}>`} />`
          : html`<${DataTable} rows=${n.recent} columns=${documentColumns({ updated: true })} onRowClick=${(d) => navigate(`/documents/${d.id}`)} />`}
      </div>
    </section>
  </div>`;
}

/* Compact document columns (dashboard + publisher + campaign pages). */
function documentColumns({ showPublisher = true, showCampaign = true, updated = false } = {}) {
  return [
    { key: 'num', header: 'Document Number', width: '150px', render: (d) => html`<${Link} to=${`/documents/${d.id}`} className="doc-num">${d.documentNumber}</${Link}>` },
    showPublisher && { key: 'pub', header: 'Publisher', render: (d) => html`<span className="clamp" title=${d.publisherSnapshot?.publisherName}>${d.publisherSnapshot?.publisherName || '—'}</span>` },
    showCampaign && { key: 'campaign', header: 'Campaign', render: (d) => html`<span className="clamp" title=${d.campaign?.name}>${d.campaign?.name || '—'}</span>` },
    { key: 'amount', header: 'Amount', align: 'right', render: (d) => html`<span className="nowrap">${fmtINR(d.commercial?.totalAmount)}</span>` },
    { key: 'status', header: 'Status', render: (d) => html`<${StatusBadge} status=${d.status} />` },
    { key: 'date', header: updated ? 'Updated' : 'Date', render: (d) => html`<span className="nowrap">${fmtDate(updated ? d.updatedAt : d.issueDate)}</span>` },
    { key: 'action', header: 'Action', align: 'right', width: '80px', render: (d) => html`<${Link} to=${`/documents/${d.id}`} className="btn btn-secondary btn-sm">View</${Link}>` },
  ].filter(Boolean);
}
