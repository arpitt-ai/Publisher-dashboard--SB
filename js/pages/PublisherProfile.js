function ProfileCard({ title, action, children, id, badge }) {
  return html`<section className="card" id=${id}>
    <header className="card-header"><h2 className="card-title">${title}</h2><span className="card-header-right">${badge}${action}</span></header>
    <div className="card-body">${children}</div>
  </section>`;
}

function BankingCard({ pub }) {
  const [reveal, setReveal] = useState(false);
  const mayReveal = can('bank.view');
  const b = pub.banking || {};
  const has = Object.values(b).some(Boolean);
  return html`<${ProfileCard} title="Bank details" badge=${html`<span className="tag"><${Icon} name="lock" size=${12} /> Sensitive</span>`}
    action=${can('bank.edit') && html`<${Link} to=${`/publishers/${pub.id}/edit?tab=bank`} className="text-link">Edit</${Link}>`}>
    ${!has ? html`<p className="muted">No bank details on file.</p>` : html`<dl className="kv-grid">
      <${KV} label="Account holder">${b.accountName}<//>
      <${KV} label="Bank name">${b.bankName}<//>
      <${KV} label="Account number" mono>${b.accountNumber && html`${reveal && mayReveal ? b.accountNumber : maskAccount(b.accountNumber)} ${mayReveal && html`<button type="button" className="link-btn" onClick=${() => setReveal(!reveal)}>${reveal ? 'Hide' : 'Show'}</button>`}`}<//>
      <${KV} label="IFSC" mono>${b.ifsc}<//>
      <${KV} label="Branch">${b.branch}<//>
    </dl>`}
    ${has && !mayReveal && html`<p className="hint hint-block">The full account number is only visible to Finance and Admin.</p>`}
  <//>`;
}

function PublisherProfilePage({ params, query }) {
  const { data: pub, loading } = useQuery(() => publisherService.get(params.id), [params.id]);
  const docs = useQuery(() => documentService.listForPublisher(params.id), [params.id]).data || [];
  const activity = useQuery(() => auditService.listForEntity('publisher', params.id), [params.id]).data || [];
  usePageMeta(pub ? pub.publisherName : 'Publisher', [{ label: 'Publishers', to: '/publishers' }, { label: pub ? pub.publisherName : 'Publisher' }]);
  const [tab, setTab] = useState(PUBLISHER_TABS.some((t) => t.id === query.tab) ? query.tab : 'basic');

  if (loading) return html`<div className="page"><${CenterSpinner} /></div>`;
  if (!pub) {
    return html`<div className="page"><section className="card"><${EmptyState} icon="building" title="Publisher not found" description="This publisher may have been removed."
      action=${html`<${Link} to="/publishers" className="btn btn-primary">Back to Publishers</${Link}>`} /></section></div>`;
  }

  const inactive = !canBookPublisher(pub); // inactive or blacklisted: cannot be used for new documents
  const blacklisted = pub.status === 'Blacklisted';
  const canEdit = can('publisher.edit');
  const liveDocs = docs.filter((d) => !d.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const gaps = publisherGaps(pub);
  const singles = COMPLIANCE_TYPES.filter((t) => t.single);
  const onFile = singles.filter((t) => pub.complianceDocuments.some((d) => d.type === t.code)).length;
  const editLink = (label = 'Edit') => canEdit && html`<${Link} to=${`/publishers/${pub.id}/edit?tab=${tab}`} className="text-link">${label}</${Link}>`;

  async function saveDocs(next) {
    try { await publisherService.saveComplianceDocuments(pub.id, next); }
    catch (e) { console.error(e); toast.error(e.message || 'Could not save the files.'); }
  }

  const tabs = [
    { id: 'basic', label: 'Basic Details' },
    { id: 'contact', label: 'Contact' },
    { id: 'address', label: 'Address' },
    { id: 'commercial', label: 'Commercial Terms' },
    { id: 'bank', label: 'Bank Details' },
    { id: 'documents', label: 'Documents', count: pub.complianceDocuments.length },
    { id: 'orders', label: 'Orders', count: liveDocs.length },
  ];

  const billing = pub.billingAddress?.sameAsRegistered !== false ? 'Same as the registered address' : joinAddress(pub.billingAddress);
  const model = PRICING_BY_CODE[pub.commercial?.pricingModel];

  const panels = {
    basic: html`<${ProfileCard} title="Basic details" action=${editLink()}>
      <dl className="kv-grid">
        <${KV} label="Publisher name">${pub.publisherName}<//>
        <${KV} label="Legal company name">${pub.legalEntityName}<//>
        <${KV} label="Vendor category">${pub.vendorCategory}<//>
        <${KV} label="Company type">${pub.companyType}<//>
        <${KV} label="Status">${html`<${StatusBadge} status=${pub.status} />`}<//>
        <${KV} label="MSME">${pub.msme.registered ? `Registered${pub.msme.registrationNumber ? ' · ' + pub.msme.registrationNumber : ''}` : 'Not registered'}<//>
        <${KV} label="GSTIN" mono>${pub.tax.gstin}<//>
        <${KV} label="PAN" mono>${pub.tax.pan}<//>
        <${KV} label="CIN" mono>${pub.tax.cin}<//>
        <${KV} label="TAN" mono>${pub.tax.tan}<//>
      </dl>
    <//>`,
    contact: html`<div className="stack">
      <${ProfileCard} title="Primary contact" action=${editLink()}>
        <dl className="kv-grid">
          <${KV} label="Name">${pub.contactPerson}<//>
          <${KV} label="Designation">${pub.designation}<//>
          <${KV} label="Email">${pub.email && html`<a className="text-link" href=${'mailto:' + pub.email}>${pub.email}</a>`}<//>
          <${KV} label="Phone">${pub.phone}<//>
          <${KV} label="Alternate phone">${pub.alternatePhone}<//>
          <${KV} label="Website">${pub.website}<//>
        </dl>
      <//>
      ${(pub.additionalContacts || []).length > 0 && html`<${ProfileCard} title="Other contacts">
        <ul className="contact-list">${pub.additionalContacts.map((c, i) => html`<li key=${i} className="contact-item"><dl className="kv-grid">
          <${KV} label="Name">${c.name}<//><${KV} label="Role">${c.designation}<//>
          <${KV} label="Email">${c.email}<//><${KV} label="Phone">${c.phone}<//>
        </dl></li>`)}</ul>
      <//>`}
    </div>`,
    address: html`<${ProfileCard} title="Addresses" action=${editLink()}>
      <dl className="kv-grid">
        <${KV} label="Registered address" wide>${joinAddress(pub.address)}<//>
        <${KV} label="Billing address" wide>${billing}<//>
      </dl>
    <//>`,
    commercial: html`<${ProfileCard} title="Commercial terms" action=${editLink()}>
      <dl className="kv-grid">
        <${KV} label="Usual pricing model">${model ? `${model.label} · ${model.hint}` : ''}<//>
        <${KV} label="Agreed rate">${toNum(pub.commercial?.agreedRate) > 0 ? fmtINR(pub.commercial.agreedRate) : ''}<//>
        <${KV} label="Payment terms">${pub.commercial?.paymentTerms}<//>
        <${KV} label="Rate notes" wide>${pub.commercial?.rateNotes}<//>
      </dl>
      <p className="hint hint-block">These fill in new orders for this publisher. You can change them on any order.</p>
    <//>`,
    bank: html`<${BankingCard} pub=${pub} />`,
    documents: html`<${ProfileCard} title="Documents" id="compliance" badge=${html`<span className=${'tag' + (onFile === singles.length ? ' tag-good' : '')}>${onFile} of ${singles.length} on file</span>`}>
      <${ComplianceDocuments} docs=${pub.complianceDocuments} msmeRegistered=${pub.msme.registered} readOnly=${!canEdit} onChange=${saveDocs} />
    <//>`,
    orders: html`<${ProfileCard} title="Orders for this publisher" badge=${html`<span className="tag">${plural(liveDocs.length, 'document')}</span>`}
      action=${!inactive && can('document.create') && html`<${Link} to=${`/documents/new?type=RO&publisher=${pub.id}`} className="text-link">+ Create RO</${Link}>`}>
      ${liveDocs.length === 0
        ? html`<${EmptyState} compact icon="file" title="No orders yet" description="ROs, POs and IOs for this publisher will be listed here."
            action=${!inactive && can('document.create') && html`<${Link} to=${`/documents/new?type=RO&publisher=${pub.id}`} className="btn btn-primary"><${Icon} name="plus" size=${15} /> Create RO</${Link}>`} />`
        : html`<div className="bleed"><${DataTable} rows=${liveDocs} columns=${documentColumns({ showPublisher: false })} onRowClick=${(d) => navigate(`/documents/${d.id}`)} /></div>`}
    <//>`,
  };

  return html`<div className="page">
    <section className="card profile-head">
      <div className="profile-id">
        <span className="profile-mark">${initials(pub.publisherName)}</span>
        <div>
          <div className="profile-name"><h2>${pub.publisherName}</h2><${StatusBadge} status=${pub.status} />${pub.isDemo && html`<${Tag} title="Bundled sample record">Sample</${Tag}>`}</div>
          <div className="profile-legal">${pub.legalEntityName}${pub.vendorCategory ? ` · ${pub.vendorCategory}` : ''}</div>
          <div className="profile-attr">${attribution('Added by', pub.createdBy, pub.createdAt)}${wasUpdated(pub) ? ` · ${attribution('Last updated by', pub.updatedBy, pub.updatedAt, true)}` : ''}</div>
        </div>
      </div>
      <div className="btn-row">
        ${canEdit && html`<${Link} to=${`/publishers/${pub.id}/edit`} className="btn btn-secondary"><${Icon} name="edit" size=${15} /> Edit</${Link}>`}
        ${can('document.create') && (inactive
          ? html`<button className="btn btn-primary" disabled title=${blacklisted ? 'Blacklisted publishers cannot be used for new documents' : 'Inactive publishers cannot be used for new documents'}><${Icon} name="filePlus" size=${15} /> Create RO</button>`
          : html`<${Link} to=${`/documents/new?type=RO&publisher=${pub.id}`} className="btn btn-primary"><${Icon} name="filePlus" size=${15} /> Create RO</${Link}>`)}
        <${MenuButton} items=${[
          { label: 'Create PO / IO', icon: 'filePlus', to: `/documents/new?type=PO&publisher=${pub.id}`, hidden: !can('document.create'), disabled: inactive },
          { label: pub.status === 'Inactive' ? 'Reactivate publisher' : 'Deactivate publisher', icon: pub.status === 'Inactive' ? 'power' : 'ban', hidden: !canEdit || blacklisted, onClick: () => togglePublisherStatus(pub) },
          ...publisherDangerItems(pub, { onDeleted: () => navigate('/publishers') }),
        ]} />
      </div>
    </section>

    ${blacklisted && html`<div className="notice notice-danger"><${Icon} name="ban" size=${16} /><div><strong>This publisher is blacklisted.</strong> It cannot be chosen for new documents; existing documents are unchanged.${pub.blacklist ? html` <strong>Reason:</strong> ${pub.blacklist.reason} (${actorName(pub.blacklist.by)}, ${fmtDate(pub.blacklist.at)}).` : ''}</div></div>`}
    ${inactive && !blacklisted && html`<div className="notice notice-warn"><${Icon} name="alert" size=${16} /><div>This publisher is inactive. It is hidden when creating new documents; existing documents are unchanged.</div></div>`}
    ${!inactive && gaps.length > 0 && html`<div className="notice notice-info"><${Icon} name="info" size=${16} /><div>Still missing for printing documents: <strong>${gaps.join(' and ')}</strong>. ${canEdit && html`<${Link} to=${`/publishers/${pub.id}/edit?tab=${gaps.includes('GSTIN') ? 'basic' : 'address'}`} className="text-link">Add now</${Link}>`}</div></div>`}

    <${Tabs} label="Publisher sections" tabs=${tabs} active=${tab} onChange=${setTab} />
    <div role="tabpanel" aria-labelledby=${'tab-' + tab}>${panels[tab]}</div>

    <${ProfileCard} title="Recent activity" badge=${html`<${Link} to="/activity" className="text-link">All activity</${Link}>`}>
      <${ActivityFeed} entries=${activity.slice(0, 6)} linkEntities=${false} emptyText="No activity recorded for this publisher." />
    <//>
  </div>`;
}
