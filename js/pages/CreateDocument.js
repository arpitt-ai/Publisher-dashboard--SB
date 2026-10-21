/* /documents/new?type=RO|PO|IO  [&publisher=ID] [&campaign=ID] [&from=DOCUMENT_ID]
   `from` starts the new document from an existing one (same campaign, publisher and prices) and links the two. */
function CreateDocumentPage({ query }) {
  const data = usePortalData();
  const typeCode = DOCUMENT_TYPES[query.type] && DOCUMENT_TYPES[query.type].enabled ? query.type : 'RO';
  usePageMeta(`Create ${typeCode}`, [{ label: 'Orders & Documents', to: '/documents' }, { label: 'Create' }]);
  // Freeze the starting values once the data has loaded, so background refreshes never reset the form.
  const [initial, setInitial] = useState(null);
  useEffect(() => {
    if (!data || initial) return;
    const base = createEmptyDocument(typeCode, data.settings);
    const src = query.from ? data.documents.find((d) => d.id === query.from) : null;
    const camp = data.campaigns.find((c) => c.id === (query.campaign || (src && src.campaignId)));
    const pre = data.publishers.find((p) => p.id === (query.publisher || (src && src.publisherId)) && p.status !== 'Inactive');
    let start = { ...base, publisherId: pre ? pre.id : '' };
    if (src) {
      start = {
        ...start, campaignId: src.campaignId, client: { ...src.client }, campaign: { ...src.campaign },
        deliverables: { ...src.deliverables }, commercial: { ...src.commercial, taxType: '' },
        paymentTerms: src.paymentTerms || base.paymentTerms, notes: src.notes, specialInstructions: src.specialInstructions,
        creativeRequirements: src.creativeRequirements, billingInstructions: src.billingInstructions, relatedIds: [src.id],
      };
    } else if (camp) {
      start = {
        ...start, campaignId: camp.id,
        client: { name: camp.client, legalEntity: camp.clientDetails?.legalEntity || '', address: camp.clientDetails?.address || '', gstin: camp.clientDetails?.gstin || '' },
        campaign: { ...base.campaign, name: camp.name, startDate: camp.startDate || '', endDate: camp.endDate || '' },
      };
    }
    // A publisher chosen up-front brings their usual pricing and payment terms.
    if (pre && !src) {
      const pc = pre.commercial || {};
      const cm = { ...start.commercial };
      if (PRICING_BY_CODE[pc.pricingModel]) cm.pricingModel = pc.pricingModel;
      if (norm(pc.agreedRate) && toNum(pc.agreedRate) > 0) cm.rate = String(pc.agreedRate);
      if (norm(pc.gstPercent)) cm.gstPercent = toNum(pc.gstPercent);
      if (pc.taxTreatment) cm.taxTreatment = pc.taxTreatment;
      start = { ...start, commercial: cm, paymentTerms: norm(pc.paymentTerms) || start.paymentTerms };
    }
    setInitial(start);
  }, [data]);

  if (!can('document.create')) return html`<${NoPermission} what="create documents" back="/documents" />`;
  if (!data || !initial) return html`<div className="page"><${CenterSpinner} /></div>`;

  if (data.publishers.length === 0) {
    return html`<div className="page"><section className="card"><${EmptyState} icon="building" title="Add a publisher first"
      description="Orders are made for a publisher. Add one, then come back here."
      action=${can('publisher.edit') && html`<${Link} to="/publishers/new" className="btn btn-primary"><${Icon} name="plus" size=${15} /> Add Publisher</${Link}>`} /></section></div>`;
  }

  return html`<div className="page page-form">
    <${DocumentForm} mode="create" initial=${initial} publishers=${data.publishers} campaigns=${data.campaigns} settings=${data.settings}
      onDone=${(d) => navigate(`/documents/${d.id}`)} onCancel=${() => navigate('/documents')} />
  </div>`;
}

function EditDocumentPage({ params }) {
  const data = usePortalData();
  const { data: doc, loading } = useQuery(() => documentService.get(params.id), [params.id]);
  usePageMeta(doc ? `Edit ${doc.documentNumber}` : 'Edit Document', [
    { label: 'Orders & Documents', to: '/documents' },
    { label: doc ? doc.documentNumber : 'Document', to: `/documents/${params.id}` },
    { label: 'Edit' },
  ]);
  const [frozen, setFrozen] = useState(null);
  useEffect(() => { if (doc && !frozen) setFrozen(doc); }, [doc]);

  if ((loading || !data) && !frozen) return html`<div className="page"><${CenterSpinner} /></div>`;
  if (!doc && !frozen) {
    return html`<div className="page"><section className="card"><${EmptyState} icon="file" title="Document not found"
      action=${html`<${Link} to="/documents" className="btn btn-primary">Back to Documents</${Link}>`} /></section></div>`;
  }
  if (!frozen || !data) return null;
  if (!canEditDocument(frozen)) {
    const why = !can('document.edit')
      ? `Your role (${currentUser.role()}) cannot edit documents.`
      : `${frozen.documentNumber} is ${frozen.status}. Only drafts and rejected documents can be edited. To change an approved or sent document, cancel it and create a new one.`;
    return html`<div className="page"><section className="card"><${EmptyState} icon="lock" title="This document cannot be edited" description=${why}
      action=${html`<${Link} to=${`/documents/${frozen.id}`} className="btn btn-secondary"><${Icon} name="arrowLeft" size=${15} /> Back to the document</${Link}>`} /></section></div>`;
  }
  return html`<div className="page page-form">
    <${DocumentForm} mode="edit" initial=${frozen} publishers=${data.publishers} campaigns=${data.campaigns} settings=${data.settings}
      onDone=${(d) => navigate(`/documents/${d.id}`)} onCancel=${() => navigate(`/documents/${frozen.id}`)} />
  </div>`;
}
