/* Who changed the status, when, and why — newest first. */
function StatusHistory({ history }) {
  if (!history || history.length === 0) return html`<p className="muted">No status changes recorded.</p>`;
  return html`<ol className="timeline">
    ${[...history].reverse().map((h, i) => html`<li key=${i} className="timeline-item">
      <span className=${'timeline-dot tone-' + (STATUS_TONES[h.to] || 'gray')}></span>
      <div>
        <div className="timeline-line">${h.from ? html`${h.from} → ` : ''}<strong>${h.to}</strong></div>
        <div className="timeline-meta">${actorName(h.by)}${h.role ? ` (${h.role})` : ''} · ${fmtDateTime(h.at)}</div>
        ${h.comment && html`<div className="timeline-comment">“${h.comment}”</div>`}
      </div>
    </li>`)}
  </ol>`;
}

function DocumentDetailPage({ params, query }) {
  const data = usePortalData();
  const doc = data ? data.documents.find((d) => d.id === params.id) : null;
  const activity = useQuery(() => auditService.listForEntity('document', params.id), [params.id]).data || [];
  usePageMeta(doc ? doc.documentNumber : 'Document', [{ label: 'Orders & Documents', to: '/documents' }, { label: doc ? doc.documentNumber : 'Document' }]);
  const [busy, setBusy] = useState(false);
  const relatedRef = useRef(null);

  useEffect(() => {
    if (doc && query.section === 'related' && relatedRef.current) relatedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [doc && doc.id, query.section]);

  if (!data) return html`<div className="page"><${CenterSpinner} /></div>`;
  if (!doc) {
    return html`<div className="page"><section className="card"><${EmptyState} icon="file" title="Document not found" description="It may have been removed."
      action=${html`<${Link} to="/documents" className="btn btn-primary">Back to Documents</${Link}>`} /></section></div>`;
  }

  const { settings } = data;
  const type = DOCUMENT_TYPES[doc.documentType];
  const snapshot = doc.publisherSnapshot;
  const livePub = data.publishers.find((p) => p.id === doc.publisherId);
  const campaign = data.campaigns.find((c) => c.id === doc.campaignId);
  const related = relatedDocuments(doc, data.documents);
  const org = doc.agencySnapshot || settings.organization; // documents made before snapshots existed use the current agency details
  const lastReject = [...(doc.statusHistory || [])].reverse().find((h) => h.to === 'Rejected');
  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const canCreate = can('document.create');

  return html`<div className="page">
    <section className="card profile-head">
      <div className="profile-id">
        <span className="profile-mark mono-mark">${doc.documentType}</span>
        <div>
          <div className="profile-name"><h2 className="mono">${doc.documentNumber}</h2><${StatusBadge} status=${doc.status} />${doc.archived && html`<${Tag}>Archived</${Tag}>`}${doc.isDemo && html`<${Tag} title="Bundled sample record">Sample</${Tag}>`}</div>
          <div className="profile-legal">${type.label} · ${snapshot?.publisherName || 'Unknown publisher'} → ${doc.client?.name || '—'}</div>
          <div className="profile-attr">${attribution('Created by', doc.createdBy, doc.createdAt, true)}${wasUpdated(doc) ? ` · ${attribution('Updated by', doc.updatedBy, doc.updatedAt, true)}` : ''}</div>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn btn-secondary" disabled=${busy} onClick=${() => documentActions.preview(doc)}><${Icon} name="eye" size=${15} /> Preview PDF</button>
        <button className="btn btn-secondary" disabled=${busy} onClick=${() => run(() => documentActions.download(doc))}><${Icon} name="download" size=${15} /> Download PDF</button>
        <${MenuButton} items=${[
          { label: 'Duplicate', icon: 'copy', hidden: !canCreate, onClick: () => run(() => documentActions.duplicate(doc)) },
          ...DOCUMENT_TYPE_LIST.filter((t) => t.enabled).map((t) => ({ label: `Create ${t.code} from this`, icon: 'link', to: `/documents/new?type=${t.code}&from=${doc.id}`, hidden: !canCreate })),
          ...statusMenuItems(doc, settings),
          doc.archived
            ? { label: 'Restore', icon: 'restore', hidden: !can('document.archive'), onClick: () => run(() => documentActions.restore(doc)) }
            : { label: 'Archive', icon: 'archive', danger: true, hidden: !can('document.archive'), onClick: () => run(async () => { if (await documentActions.archive(doc)) navigate('/documents'); }) },
        ]} />
      </div>
    </section>

    ${doc.archived && html`<div className="notice notice-warn"><${Icon} name="archive" size=${16} /><div>This document is archived${doc.archivedBy ? ` (${attribution('by', doc.archivedBy, doc.archivedAt)})` : ''}. It is hidden from the document list.</div></div>`}
    ${doc.status === 'Rejected' && lastReject && html`<div className="notice notice-warn"><${Icon} name="alert" size=${16} /><div><strong>Sent back by ${actorName(lastReject.by)}</strong> on ${fmtDate(lastReject.at)}${lastReject.comment ? html`: “${lastReject.comment}”` : '.'}</div></div>`}

    ${!doc.archived && html`<section className="card next-card"><${NextStep} doc=${doc} settings=${settings} /></section>`}

    <div className="detail-grid">
      <div className="detail-preview">
        <${DocumentPreview} doc=${doc} publisher=${snapshot} org=${org} paymentTerms=${doc.paymentTerms || settings.defaults.paymentTerms} createdBy=${doc.createdBy} createdAt=${doc.createdAt} />
      </div>
      <div className="stack">
        <section className="card">
          <header className="card-header"><h2 className="card-title">Status history</h2></header>
          <div className="card-body"><${StatusHistory} history=${doc.statusHistory} /></div>
        </section>

        <section className="card" id="related" ref=${relatedRef}>
          <header className="card-header"><h2 className="card-title">Related documents</h2><span className="tag">${related.length}</span></header>
          <div className="card-body">
            ${related.length === 0
              ? html`<p className="muted">No other documents for this campaign yet.</p>`
              : html`<ul className="related-list">${related.map((r) => html`<li key=${r.id}>
                  <${Link} to=${`/documents/${r.id}`} className="related-item">
                    <span className="doc-num">${r.documentNumber}</span>
                    <span className="related-meta">${r.publisherSnapshot?.publisherName || '—'}</span>
                    <${StatusBadge} status=${r.status} />
                  </${Link}></li>`)}</ul>`}
            ${canCreate && html`<div className="btn-row" style=${{ marginTop: 12 }}>
              ${DOCUMENT_TYPE_LIST.filter((t) => t.enabled).map((t) => html`<${Link} key=${t.code} to=${`/documents/new?type=${t.code}&from=${doc.id}`} className="btn btn-secondary btn-sm"><${Icon} name="plus" size=${13} /> ${t.code} from this</${Link}>`)}
            </div>`}
          </div>
        </section>

        <section className="card">
          <header className="card-header"><h2 className="card-title">Campaign and publisher</h2></header>
          <div className="card-body">
            ${campaign
              ? html`<div className="side-line"><span className="label">Campaign</span><${Link} to=${`/campaigns/${campaign.id}`} className="text-link">${campaign.name}</${Link}><div className="muted small">${campaign.client}</div></div>`
              : html`<div className="side-line"><span className="label">Campaign</span>${doc.campaign?.name || '—'}</div>`}
            <div className="side-line"><span className="label">Publisher ${livePub ? html`<${StatusBadge} status=${livePub.status} />` : ''}</span>
              ${livePub ? html`<${Link} to=${`/publishers/${livePub.id}`} className="text-link">${snapshot?.publisherName}</${Link}>` : snapshot?.publisherName}
              <div className="muted small">${snapshot?.legalEntityName}</div></div>
            ${snapshot?.capturedAt && html`<p className="hint">Publisher and agency details are as of ${fmtDate(snapshot.capturedAt)}, the way they are printed on this document.</p>`}
          </div>
        </section>

        <section className="card">
          <header className="card-header"><h2 className="card-title">Activity</h2></header>
          <div className="card-body"><${ActivityFeed} entries=${activity} linkEntities=${false} emptyText="No activity recorded." /></div>
        </section>
      </div>
    </div>
  </div>`;
}
