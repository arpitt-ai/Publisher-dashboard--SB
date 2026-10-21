/* Deactivate / reactivate, shared by the directory and the publisher page. */
async function togglePublisherStatus(p) {
  const deactivating = p.status !== 'Inactive';
  const ok = await confirmDialog({
    title: deactivating ? `Deactivate ${p.publisherName}?` : `Reactivate ${p.publisherName}?`,
    message: deactivating
      ? 'They will no longer be offered when creating new documents. Existing documents stay exactly as they are, and the publisher can still be found.'
      : 'They will be available again when creating new documents.',
    confirmLabel: deactivating ? 'Deactivate' : 'Reactivate', danger: deactivating,
  });
  if (!ok) return false;
  return (await runAction(
    { loading: deactivating ? 'Deactivating publisher...' : 'Reactivating publisher...', success: deactivating ? 'Publisher deactivated.' : 'Publisher reactivated.' },
    () => (deactivating ? publisherService.deactivate(p.id) : publisherService.reactivate(p.id)),
  )).ok;
}

/* Blacklist and delete. Both are serious, so each one always asks again (the confirm button is red and
   the safe "Cancel" button is the one that has focus). */
async function blacklistPublisher(p) {
  const reason = await askComment({
    title: `Blacklist ${p.publisherName}?`,
    message: 'A blacklisted publisher can no longer be chosen for any new RO, PO or IO. Documents already created are not changed, and you can remove the blacklist later.',
    required: true, confirmLabel: 'Yes, blacklist', danger: true, placeholder: 'Why is this publisher being blacklisted?',
  });
  if (reason === null) return false;
  return (await runAction({ loading: 'Blacklisting publisher...', success: `${p.publisherName} is now blacklisted.` }, () => publisherService.blacklist(p.id, reason))).ok;
}

async function unblacklistPublisher(p) {
  const ok = await confirmDialog({
    title: `Remove ${p.publisherName} from the blacklist?`,
    message: 'They can be chosen for new documents again.',
    confirmLabel: 'Remove from blacklist',
  });
  if (!ok) return false;
  return (await runAction({ loading: 'Updating publisher...', success: `${p.publisherName} is no longer blacklisted.` }, () => publisherService.removeFromBlacklist(p.id))).ok;
}

async function deletePublisher(p) {
  const docs = (await documentService.listForPublisher(p.id)).length;
  const ok = await confirmDialog({
    title: `Delete ${p.publisherName}?`,
    message: `This permanently deletes the publisher and every file uploaded for it. This cannot be undone.${docs ? ` The ${plural(docs, 'document')} already created for this publisher ${docs === 1 ? 'stays' : 'stay'} in the system with the details ${docs === 1 ? 'it was' : 'they were'} issued with.` : ''}`,
    confirmLabel: 'Yes, delete permanently', cancelLabel: 'No, keep it', danger: true,
  });
  if (!ok) return false;
  return (await runAction({ loading: 'Deleting publisher...', success: `${p.publisherName} was deleted.` }, () => publisherService.remove(p.id))).ok;
}

/* The danger items for a publisher's "more" menu (shown in red). */
function publisherDangerItems(p, { onDeleted } = {}) {
  return [
    p.status === 'Blacklisted'
      ? { label: 'Remove from blacklist', icon: 'restore', hidden: !can('publisher.blacklist'), onClick: () => unblacklistPublisher(p) }
      : { label: 'Blacklist publisher', icon: 'ban', danger: true, hidden: !can('publisher.blacklist'), onClick: () => blacklistPublisher(p) },
    { label: 'Delete publisher', icon: 'trash', danger: true, hidden: !can('publisher.delete'), onClick: async () => { if (await deletePublisher(p) && onDeleted) onDeleted(); } },
  ];
}

function PublishersPage({ query }) {
  usePageMeta('Publishers', []);
  const { data: publishers } = useQuery(() => publisherService.list());
  const [q, setQ] = useState(query.q || '');
  const [status, setStatus] = useState(PUBLISHER_STATUSES.includes(query.status) ? query.status : '');
  const dq = useDeferredValue(q);

  const rows = useMemo(() => filterPublishers(publishers || [], { q: dq, status }), [publishers, dq, status]);
  const clear = () => { setQ(''); setStatus(''); };
  const canEdit = can('publisher.edit');

  const columns = [
    { key: 'name', header: 'Publisher Name', sticky: 'left', width: '170px', render: (p) => html`<${Link} to=${`/publishers/${p.id}`} className="row-title">${p.publisherName}</${Link}>${p.isDemo ? html` <${Tag} title="Bundled sample record">Sample</${Tag}>` : ''}` },
    { key: 'legal', header: 'Legal Company Name', render: (p) => html`<span className="clamp" title=${p.legalEntityName}>${p.legalEntityName}</span>` },
    { key: 'gstin', header: 'GSTIN', render: (p) => html`<span className="mono nowrap">${p.tax?.gstin || '—'}</span>` },
    { key: 'contact', header: 'Primary Contact', render: (p) => p.contactPerson },
    { key: 'email', header: 'Email', render: (p) => html`<span className="clamp" title=${p.email}>${p.email}</span>` },
    { key: 'phone', header: 'Phone', render: (p) => html`<span className="nowrap">${p.phone || '—'}</span>` },
    { key: 'status', header: 'Status', render: (p) => html`<${StatusBadge} status=${p.status} />` },
    {
      key: 'actions', header: 'Actions', sticky: 'right', align: 'right', width: '170px',
      render: (p) => html`<div className="row-actions">
        <${Link} to=${`/publishers/${p.id}`} className="btn btn-secondary btn-sm">View</${Link}>
        ${canEdit && html`<${Link} to=${`/publishers/${p.id}/edit`} className="btn btn-secondary btn-sm">Edit</${Link}>`}
        <${MenuButton} label=${`More actions for ${p.publisherName}`} iconOnly className="icon-btn" items=${[
          { label: 'Create RO', icon: 'filePlus', to: `/documents/new?type=RO&publisher=${p.id}`, hidden: !can('document.create'), disabled: !canBookPublisher(p) },
          { label: 'Create PO / IO', icon: 'filePlus', to: `/documents/new?type=PO&publisher=${p.id}`, hidden: !can('document.create'), disabled: !canBookPublisher(p) },
          { label: p.status === 'Inactive' ? 'Reactivate' : 'Deactivate', icon: p.status === 'Inactive' ? 'power' : 'ban', hidden: !canEdit || p.status === 'Blacklisted', onClick: () => togglePublisherStatus(p) },
          ...publisherDangerItems(p),
        ]} />
      </div>`,
    },
  ];

  return html`<div className="page">
    <div className="page-actions">
      <p className="page-sub">Everyone you buy media from, with their contact, tax and payment details.</p>
      ${canEdit && html`<${Link} to="/publishers/new" className="btn btn-primary"><${Icon} name="plus" size=${15} /> Add Publisher</${Link}>`}
    </div>

    ${publishers && publishers.length === 0
      ? html`<section className="card"><${EmptyState} icon="building" title="No publishers yet" description="Add your first publisher to start creating documents."
          action=${canEdit && html`<${Link} to="/publishers/new" className="btn btn-primary"><${Icon} name="plus" size=${15} /> Add Publisher</${Link}>`} /></section>`
      : html`
      <section className="card">
        <div className="toolbar toolbar-row">
          <${SearchBar} className="toolbar-search" value=${q} onChange=${setQ} placeholder="Search by name, GSTIN, contact or email" autoFocus />
          <div className="toolbar-inline">
            <${SelectField} label="Status" value=${status} onChange=${setStatus} placeholder="All" options=${PUBLISHER_STATUSES} />
          </div>
        </div>
        <div className="table-meta">
          <span>${publishers ? `Showing ${rows.length} of ${publishers.length} ${publishers.length === 1 ? 'publisher' : 'publishers'}` : 'Loading…'}</span>
          ${(q || status) && html`<button className="link-btn" onClick=${clear}>Clear search</button>`}
        </div>
        ${!publishers ? html`<${CenterSpinner} />`
          : rows.length === 0
            ? html`<${EmptyState} icon="search" title="No publishers match your search" description="Try a different name, GSTIN or email."
                action=${html`<button className="btn btn-secondary" onClick=${clear}>Clear search</button>`} />`
            : html`<${DataTable} rows=${rows} columns=${columns} onRowClick=${(p) => navigate(`/publishers/${p.id}`)} rowClass=${(p) => (p.status === 'Inactive' || p.status === 'Blacklisted' ? 'is-muted' : '')} />`}
      </section>`}
  </div>`;
}
