/* documentService — RO / PO / IO records, numbering, status workflow, duplication and archiving. */
const documentService = (() => {
  const KEY = COLLECTIONS.documents;
  const read = () => storageService.get(KEY, []).map((d) => {
    const full = withDefaults(d, createEmptyDocument(d.documentType || 'RO'));
    full.status = normalizeStatus(full.status);
    return full;
  });
  const write = (list) => storageService.set(KEY, list);

  const pubLabel = (d) => d.publisherSnapshot?.publisherName || 'Unknown publisher';
  const flowDetail = (d) => `${pubLabel(d)} → ${d.client?.name || '—'}`;

  /* Permanent counters, one per document type + year. They only ever go up, so a number
     is never re-used — even if records are archived or storage is edited by hand. */
  function allocateNumber(type, numbering) {
    const year = new Date().getFullYear();
    const key = counterKey(type, year);
    const counters = storageService.get(COLLECTIONS.counters, {});
    const docs = storageService.get(KEY, []);
    const highestUsed = docs
      .filter((d) => d.documentType === type && d.numberYear === year)
      .reduce((m, d) => Math.max(m, d.numberSeq || 0), 0);
    let seq = Math.max(counters[key] || 0, highestUsed) + 1;
    let number = formatDocumentNumber(type, year, seq, numbering);
    while (docs.some((d) => d.documentNumber === number)) {
      seq += 1;
      number = formatDocumentNumber(type, year, seq, numbering);
    }
    counters[key] = seq;
    storageService.set(COLLECTIONS.counters, counters);
    return { documentNumber: number, numberYear: year, numberSeq: seq };
  }

  async function requireUsablePublisher(publisherId) {
    const pub = await publisherService.get(publisherId);
    if (!pub) throw new Error('Publisher not found.');
    if (pub.status === 'Blacklisted') throw new Error(`${pub.publisherName} is blacklisted and cannot be used for new documents.`);
    if (pub.status === 'Inactive') throw new Error(`${pub.publisherName} is inactive. Reactivate the publisher to create documents.`);
    return pub;
  }

  /* Recompute money fields so what is stored always matches the numbers shown.
     The GST type (CGST+SGST / IGST) is worked out once here and kept, so old documents never change by themselves. */
  function finalizeCommercial(cm, pubSnapshot, org) {
    const ctx = taxContext(pubSnapshot, org);
    const taxType = resolveTaxType('auto', ctx.agencyCode, ctx.partyCode);
    const c = computeCommercial({ ...cm, gstPercent: GST_PERCENT }, { taxType });
    return {
      pricingModel: cm.pricingModel,
      rate: toNum(cm.rate), quantity: toNum(cm.quantity),
      estimatedSpend: c.subtotal, spendOverride: !!cm.spendOverride,
      discountType: cm.discountType === 'amount' ? 'amount' : 'percent', discountValue: toNum(cm.discountValue),
      otherCharges: toNum(cm.otherCharges), otherChargesLabel: norm(cm.otherChargesLabel),
      gstPercent: GST_PERCENT, taxTreatment: 'auto', taxType,
      totalAmount: c.total,
    };
  }

  const clean = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
  const cleanNumbers = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, k === 'other' ? norm(v) : norm(v) === '' ? '' : toNum(v)]));

  /* Documents point at each other both ways, so you can move between them from either side. */
  function linkBothWays(list, aId, bIds) {
    bIds.filter((id) => id && id !== aId).forEach((bId) => {
      const a = list.find((d) => d.id === aId);
      const b = list.find((d) => d.id === bId);
      if (!a || !b) return;
      if (!(a.relatedIds || []).includes(bId)) a.relatedIds = [...(a.relatedIds || []), bId];
      if (!(b.relatedIds || []).includes(aId)) b.relatedIds = [...(b.relatedIds || []), aId];
    });
  }

  const historyEntry = (from, to, comment = '') => ({ from, to, by: currentUser.actor(), role: currentUser.role(), at: nowISO(), comment: norm(comment) });

  return {
    async list() { return read(); },
    async get(id) { return read().find((d) => d.id === id) || null; },
    async listForPublisher(publisherId) { return read().filter((d) => d.publisherId === publisherId); },
    async listForCampaign(campaignId) { return read().filter((d) => d.campaignId === campaignId); },

    /** What the next number would be (does not consume it). */
    async peekNextNumber(type) {
      const settings = await settingsService.get();
      const year = new Date().getFullYear();
      const counters = storageService.get(COLLECTIONS.counters, {});
      const highest = read().filter((d) => d.documentType === type && d.numberYear === year).reduce((m, d) => Math.max(m, d.numberSeq || 0), 0);
      return formatDocumentNumber(type, year, Math.max(counters[counterKey(type, year)] || 0, highest) + 1, settings.numbering);
    },

    /** Creates a Draft. Use setStatus() afterwards to submit it. */
    async create(input) {
      assertCan('document.create', 'create documents');
      const type = input.documentType;
      if (!DOCUMENT_TYPES[type]?.enabled) throw new Error(`${type} documents are not available.`);
      const pub = await requireUsablePublisher(input.publisherId);
      const settings = await settingsService.get();
      const snapshot = snapshotPublisher(pub);
      const now = nowISO();
      const actor = currentUser.actor();
      const doc = {
        ...withDefaults(input, createEmptyDocument(type, settings)),
        id: uid('doc_'),
        ...allocateNumber(type, settings.numbering),
        publisherSnapshot: snapshot,
        agencySnapshot: snapshotAgency(settings.organization),
        client: clean(input.client), campaign: clean(input.campaign), deliverables: cleanNumbers(input.deliverables),
        commercial: finalizeCommercial(input.commercial, snapshot, settings.organization),
        paymentTerms: norm(input.paymentTerms) || settings.defaults.paymentTerms,
        issueDate: todayISO(), // the date the document is created, never typed in
        status: 'Draft',
        statusHistory: [historyEntry(null, 'Draft', 'Created')],
        relatedIds: [...new Set(input.relatedIds || [])],
        archived: false,
        createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
      };
      const list = read();
      list.push(doc);
      linkBothWays(list, doc.id, doc.relatedIds);
      write(list);
      if (doc.campaignId) await campaignService.addPublisher(doc.campaignId, doc.publisherId);
      await auditService.log({ action: 'DOCUMENT_CREATED', entityType: 'document', entityId: doc.id, entityLabel: doc.documentNumber, summary: `Created ${doc.documentNumber}`, detail: flowDetail(doc) });
      return list.find((d) => d.id === doc.id);
    },

    /** Edits a Draft (or a Rejected document, which goes back to Draft). The document number never changes. */
    async update(id, input) {
      assertCan('document.edit', 'edit documents');
      const list = read();
      const idx = list.findIndex((d) => d.id === id);
      if (idx < 0) throw new Error('Document not found');
      const before = list[idx];
      if (!EDITABLE_STATUSES.includes(before.status)) {
        throw new Error(`${before.documentNumber} is ${before.status}, so it can no longer be edited. Cancel it and create a new one if it needs to change.`);
      }
      const settings = await settingsService.get();
      const pub = input.publisherId === before.publisherId
        ? (await publisherService.get(before.publisherId)) // refresh details when the document is edited
        : await requireUsablePublisher(input.publisherId);
      const snapshot = pub ? snapshotPublisher(pub) : before.publisherSnapshot;
      const reopened = before.status === 'Rejected';
      const after = {
        ...before, ...input,
        id: before.id, documentNumber: before.documentNumber, documentType: before.documentType,
        numberYear: before.numberYear, numberSeq: before.numberSeq,
        createdAt: before.createdAt, createdBy: before.createdBy,
        relatedIds: before.relatedIds, statusHistory: before.statusHistory,
        issueDate: before.issueDate, // stays the date the document was created
        publisherSnapshot: snapshot, agencySnapshot: snapshotAgency(settings.organization),
        client: clean(input.client), campaign: clean(input.campaign), deliverables: cleanNumbers(input.deliverables),
        commercial: finalizeCommercial(input.commercial, snapshot, settings.organization),
        paymentTerms: norm(input.paymentTerms) || settings.defaults.paymentTerms,
        status: reopened ? 'Draft' : before.status,
        updatedAt: nowISO(), updatedBy: currentUser.actor(),
      };
      if (reopened) after.statusHistory = [...before.statusHistory, historyEntry('Rejected', 'Draft', 'Edited after rejection')];
      list[idx] = after;
      write(list);
      if (after.campaignId) await campaignService.addPublisher(after.campaignId, after.publisherId);
      const changes = diffFields(before, after, DOCUMENT_FIELD_LABELS).filter((c) => c.field !== 'publisherId');
      if (before.publisherId !== after.publisherId) changes.unshift({ field: 'publisherId', label: 'Publisher', from: pubLabel(before), to: pubLabel(after) });
      if (changes.length) {
        await auditService.log({ action: 'DOCUMENT_UPDATED', entityType: 'document', entityId: id, entityLabel: after.documentNumber, summary: `Updated ${after.documentNumber}`, detail: changes.map((c) => c.label).join(', '), changes, isDemo: after.isDemo });
      }
      if (reopened) {
        await auditService.log({ action: 'DOCUMENT_STATUS_CHANGED', entityType: 'document', entityId: id, entityLabel: after.documentNumber, summary: `Changed status of ${after.documentNumber}`, detail: 'Rejected → Draft', isDemo: after.isDemo });
      }
      return after;
    },

    /**
     * Moves a document to a new status, if the workflow, the person's role and the document itself allow it.
     * `comment` is required for Reject and optional for Cancel. Every move is recorded: who, when, and why.
     */
    async setStatus(id, to, { comment = '' } = {}) {
      const list = read();
      const idx = list.findIndex((d) => d.id === id);
      if (idx < 0) throw new Error('Document not found');
      const before = list[idx];
      if (before.status === to) return before;
      const settings = await settingsService.get();
      const rule = findTransition(before.status, to, { requireApproval: settings.workflow.requireApproval });
      if (!rule) throw new Error(`A ${before.status} document cannot be moved to ${to}.`);
      assertCan(rule.perm, `${rule.label.toLowerCase()} on a document`);
      if (rule.askComment === 'required' && !norm(comment)) throw new Error('Please give a reason so the team knows what to fix.');

      // A document must be complete before it leaves Draft.
      if (before.status === 'Draft' && (to === 'Pending Approval' || to === 'Approved')) {
        const errs = validateDocument({ ...before, paymentTerms: before.paymentTerms || settings.defaults.paymentTerms }, { full: true });
        if (Object.keys(errs).length) throw new Error(`${before.documentNumber} cannot be submitted yet: ${Object.values(errs)[0]}. Edit it and try again.`);
      }

      const after = {
        ...before, status: to,
        statusHistory: [...before.statusHistory, historyEntry(before.status, to, comment)],
        updatedAt: nowISO(), updatedBy: currentUser.actor(),
      };
      list[idx] = after;
      write(list);
      await auditService.log({
        action: 'DOCUMENT_STATUS_CHANGED', entityType: 'document', entityId: id, entityLabel: after.documentNumber,
        summary: `Changed status of ${after.documentNumber}`, detail: `${before.status} → ${after.status}${norm(comment) ? ` · “${norm(comment)}”` : ''}`, isDemo: after.isDemo,
      });
      return after;
    },

    async logDownload(id) {
      const doc = await this.get(id);
      if (!doc) return;
      await auditService.log({ action: 'DOCUMENT_DOWNLOADED', entityType: 'document', entityId: id, entityLabel: doc.documentNumber, summary: `Downloaded ${doc.documentNumber}`, detail: flowDetail(doc), isDemo: doc.isDemo });
    },

    /** New document with a NEW number, linked to the original. Copies who/what/how much; never the number,
        status history, timestamps or creator. */
    async duplicate(id) {
      const src = await this.get(id);
      if (!src) throw new Error('Document not found');
      const settings = await settingsService.get();
      const copy = await this.create({
        documentType: src.documentType, publisherId: src.publisherId, campaignId: src.campaignId,
        client: { ...src.client }, campaign: { ...src.campaign }, deliverables: { ...src.deliverables },
        commercial: { ...src.commercial, taxType: '' }, paymentTerms: src.paymentTerms || settings.defaults.paymentTerms,
        notes: src.notes, specialInstructions: src.specialInstructions,
        creativeRequirements: src.creativeRequirements, billingInstructions: src.billingInstructions,
        relatedIds: [src.id], issueDate: todayISO(),
      });
      await auditService.log({ action: 'DOCUMENT_DUPLICATED', entityType: 'document', entityId: copy.id, entityLabel: copy.documentNumber, summary: `Duplicated ${src.documentNumber} as ${copy.documentNumber}`, detail: flowDetail(copy) });
      return copy;
    },

    async archive(id) {
      assertCan('document.archive', 'archive documents');
      const list = read();
      const idx = list.findIndex((d) => d.id === id);
      if (idx < 0) throw new Error('Document not found');
      const after = { ...list[idx], archived: true, archivedAt: nowISO(), archivedBy: currentUser.actor(), updatedAt: nowISO(), updatedBy: currentUser.actor() };
      list[idx] = after;
      write(list);
      await auditService.log({ action: 'DOCUMENT_ARCHIVED', entityType: 'document', entityId: id, entityLabel: after.documentNumber, summary: `Archived ${after.documentNumber}`, detail: flowDetail(after), isDemo: after.isDemo });
      return after;
    },

    async restore(id) {
      assertCan('document.archive', 'restore documents');
      const list = read();
      const idx = list.findIndex((d) => d.id === id);
      if (idx < 0) throw new Error('Document not found');
      const after = { ...list[idx], archived: false, updatedAt: nowISO(), updatedBy: currentUser.actor() };
      delete after.archivedAt; delete after.archivedBy;
      list[idx] = after;
      write(list);
      await auditService.log({ action: 'DOCUMENT_UPDATED', entityType: 'document', entityId: id, entityLabel: after.documentNumber, summary: `Restored ${after.documentNumber} from archive`, detail: flowDetail(after), isDemo: after.isDemo });
      return after;
    },
  };
})();
