/* publisherService — the publisher master database (source of truth for legal/compliance info). */
const publisherService = (() => {
  const KEY = COLLECTIONS.publishers;
  const read = () => storageService.get(KEY, []).map((p) => withDefaults(p, createEmptyPublisher()));
  const write = (list) => storageService.set(KEY, list);

  /* "Bennett Coleman & Co. Ltd." and "bennett coleman and co limited" should look the same. */
  const normName = (s = '') =>
    s.toLowerCase().replace(/&/g, ' and ').replace(/[.,()'"-]/g, ' ')
      .replace(/\bprivate\b/g, 'pvt').replace(/\blimited\b/g, 'ltd').replace(/\s+/g, ' ').trim();

  const typeLabel = (d) => COMPLIANCE_BY_CODE[d.type]?.short || 'Document';

  /* Compare old vs new compliance documents: audit uploads / replacements / deletions
     and delete blobs that are no longer referenced. */
  async function commitComplianceChanges(before = [], after = [], pub) {
    const oldById = Object.fromEntries(before.map((d) => [d.id, d]));
    const newById = Object.fromEntries(after.map((d) => [d.id, d]));
    const added = after.filter((d) => !oldById[d.id]);
    const removed = before.filter((d) => !newById[d.id]);
    const unmatched = [...removed];

    for (const d of added) {
      const repl = COMPLIANCE_BY_CODE[d.type]?.single ? unmatched.findIndex((r) => r.type === d.type) : -1;
      const base = { entityType: 'publisher', entityId: pub.id, entityLabel: pub.publisherName };
      if (repl >= 0) {
        const old = unmatched.splice(repl, 1)[0];
        await auditService.log({ ...base, action: 'FILE_REPLACED', summary: `Replaced ${typeLabel(d)} for ${pub.publisherName}`, detail: `${old.fileName} → ${d.fileName}`, isDemo: pub.isDemo });
      } else {
        await auditService.log({ ...base, action: 'FILE_UPLOADED', summary: `Uploaded ${typeLabel(d)} for ${pub.publisherName}`, detail: d.fileName, isDemo: pub.isDemo });
      }
    }
    for (const d of unmatched) {
      await auditService.log({ action: 'FILE_DELETED', entityType: 'publisher', entityId: pub.id, entityLabel: pub.publisherName, summary: `Deleted ${typeLabel(d)} for ${pub.publisherName}`, detail: d.fileName, isDemo: pub.isDemo });
    }
    const keep = new Set(after.map((d) => d.fileId));
    await fileService.deleteMany(removed.map((d) => d.fileId).filter((id) => !keep.has(id)));
  }

  return {
    async list() { return read(); },
    async get(id) { return read().find((p) => p.id === id) || null; },
    /** Publishers that may be picked for new documents (Inactive ones are excluded). */
    async listActive() { return read().filter(canBookPublisher); },
    newId: () => uid('pub_'),

    async create(input) {
      assertCan('publisher.edit', 'add publishers');
      const data = normalizePublisher(withDefaults(input, createEmptyPublisher()));
      const problems = validatePublisher(data);
      if (Object.keys(problems).length) throw new Error(Object.values(problems)[0]);
      if (!can('bank.edit')) data.banking = createEmptyPublisher().banking;
      const now = nowISO();
      const actor = currentUser.actor();
      const pub = {
        ...data,
        id: input.id || uid('pub_'),
        status: PUBLISHER_STATUSES.includes(data.status) ? data.status : 'Active',
        complianceDocuments: input.complianceDocuments || [],
        createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
      };
      const list = read();
      list.push(pub);
      write(list);
      await auditService.log({
        action: 'PUBLISHER_CREATED', entityType: 'publisher', entityId: pub.id, entityLabel: pub.publisherName,
        summary: `Onboarded ${pub.publisherName}`, detail: pub.legalEntityName,
      });
      await commitComplianceChanges([], pub.complianceDocuments, pub);
      return pub;
    },

    async update(id, input) {
      const fullEdit = can('publisher.edit');
      if (!fullEdit && !can('bank.edit')) throw new Error(`Your role (${currentUser.role()}) cannot edit publishers.`);
      const list = read();
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error('Publisher not found');
      const before = list[idx];
      let data = normalizePublisher(withDefaults(input, createEmptyPublisher()));
      if (!fullEdit) data = { ...before, banking: data.banking }; // Finance may update bank details only
      else if (!can('bank.edit')) data.banking = before.banking; // bank details are only changed by roles that are allowed to
      const after = {
        ...before, ...data,
        id: before.id, createdAt: before.createdAt, createdBy: before.createdBy, isDemo: before.isDemo,
        complianceDocuments: input.complianceDocuments || before.complianceDocuments,
        updatedAt: nowISO(), updatedBy: currentUser.actor(),
      };
      list[idx] = after;
      write(list);

      const changes = diffFields(before, after, PUBLISHER_FIELD_LABELS);
      const wentInactive = before.status !== after.status && after.status === 'Inactive';
      const wentActive = before.status === 'Inactive' && after.status !== 'Inactive';
      const fieldChanges = changes.filter((c) => !((wentInactive || wentActive) && c.field === 'status'));
      if (fieldChanges.length) {
        await auditService.log({
          action: 'PUBLISHER_UPDATED', entityType: 'publisher', entityId: id, entityLabel: after.publisherName,
          summary: `Updated ${after.publisherName}`, detail: fieldChanges.map((c) => c.label).join(', '), changes: fieldChanges, isDemo: after.isDemo,
        });
      }
      if (wentInactive) await auditService.log({ action: 'PUBLISHER_DEACTIVATED', entityType: 'publisher', entityId: id, entityLabel: after.publisherName, summary: `Deactivated ${after.publisherName}`, changes: changes.filter((c) => c.field === 'status'), isDemo: after.isDemo });
      if (wentActive) await auditService.log({ action: 'PUBLISHER_REACTIVATED', entityType: 'publisher', entityId: id, entityLabel: after.publisherName, summary: `Reactivated ${after.publisherName}`, changes: changes.filter((c) => c.field === 'status'), isDemo: after.isDemo });
      await commitComplianceChanges(before.complianceDocuments, after.complianceDocuments, after);
      return after;
    },

    /** Blacklist: the publisher stays on record but can never be picked for a new document until it is removed from the blacklist. */
    async blacklist(id, reason) {
      assertCan('publisher.blacklist', 'blacklist publishers');
      if (!norm(reason)) throw new Error('Please give a reason for blacklisting.');
      const list = read();
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error('Publisher not found');
      const before = list[idx];
      if (before.status === 'Blacklisted') return before;
      const after = {
        ...before, status: 'Blacklisted',
        blacklist: { reason: norm(reason), by: currentUser.actor(), at: nowISO(), previousStatus: before.status },
        updatedAt: nowISO(), updatedBy: currentUser.actor(),
      };
      list[idx] = after;
      write(list);
      await auditService.log({ action: 'PUBLISHER_BLACKLISTED', entityType: 'publisher', entityId: id, entityLabel: after.publisherName, summary: `Blacklisted ${after.publisherName}`, detail: norm(reason), isDemo: after.isDemo });
      return after;
    },

    async removeFromBlacklist(id) {
      assertCan('publisher.blacklist', 'remove publishers from the blacklist');
      const list = read();
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error('Publisher not found');
      const before = list[idx];
      if (before.status !== 'Blacklisted') return before;
      const back = before.blacklist && PUBLISHER_STATUSES.includes(before.blacklist.previousStatus) && before.blacklist.previousStatus !== 'Blacklisted' ? before.blacklist.previousStatus : 'Active';
      const after = { ...before, status: back, blacklist: null, updatedAt: nowISO(), updatedBy: currentUser.actor() };
      list[idx] = after;
      write(list);
      await auditService.log({ action: 'PUBLISHER_UNBLACKLISTED', entityType: 'publisher', entityId: id, entityLabel: after.publisherName, summary: `Removed ${after.publisherName} from the blacklist`, detail: `Now ${back}`, isDemo: after.isDemo });
      return after;
    },

    /** Permanently deletes the publisher and its uploaded files. Documents already created keep the details they were issued with. */
    async remove(id) {
      assertCan('publisher.delete', 'delete publishers');
      const list = read();
      const pub = list.find((p) => p.id === id);
      if (!pub) throw new Error('Publisher not found');
      const documents = storageService.get(COLLECTIONS.documents, []).filter((d) => d.publisherId === id).length;
      write(list.filter((p) => p.id !== id));
      const camps = storageService.get(COLLECTIONS.campaigns, []);
      if (camps.some((c) => (c.publisherIds || []).includes(id))) {
        storageService.set(COLLECTIONS.campaigns, camps.map((c) => ({ ...c, publisherIds: (c.publisherIds || []).filter((x) => x !== id) })));
      }
      await fileService.deleteMany((pub.complianceDocuments || []).map((d) => d.fileId));
      await auditService.log({
        action: 'PUBLISHER_DELETED', entityType: 'publisher', entityId: id, entityLabel: pub.publisherName, summary: `Deleted ${pub.publisherName}`,
        detail: documents ? `${plural(documents, 'document')} keep their saved details` : '', isDemo: pub.isDemo,
      });
      return { documents };
    },

    async deactivate(id) {
      const p = await this.get(id);
      if (!p) throw new Error('Publisher not found');
      return this.update(id, { ...p, status: 'Inactive' });
    },
    async reactivate(id) {
      const p = await this.get(id);
      if (!p) throw new Error('Publisher not found');
      return this.update(id, { ...p, status: 'Active' });
    },

    /** Replace only the compliance documents (used by the publisher profile). */
    async saveComplianceDocuments(id, docs) {
      assertCan('publisher.edit', 'change publisher files');
      const list = read();
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error('Publisher not found');
      const before = list[idx];
      const after = { ...before, complianceDocuments: docs, updatedAt: nowISO(), updatedBy: currentUser.actor() };
      list[idx] = after;
      write(list);
      await commitComplianceChanges(before.complianceDocuments, docs, after);
      return after;
    },

    /** Potential duplicates by GSTIN, PAN, legal company name, email or bank account. Returns [{ publisher, reasons[] }].
        A shared PAN alone can be a different branch of the same company, so it is only a hint. */
    async findDuplicates(data, excludeId) {
      const gst = upper(data.tax?.gstin);
      const pan = upper(data.tax?.pan);
      const legal = normName(data.legalEntityName);
      const email = norm(data.email).toLowerCase();
      const account = norm(data.banking?.accountNumber);
      const ifsc = upper(data.banking?.ifsc);
      return read()
        .filter((p) => p.id !== excludeId)
        .map((p) => {
          const reasons = [];
          if (gst && upper(p.tax?.gstin) === gst) reasons.push('Same GSTIN');
          if (pan && upper(p.tax?.pan) === pan && !reasons.includes('Same GSTIN')) reasons.push('Same PAN');
          if (legal && normName(p.legalEntityName) === legal) reasons.push('Same legal company name');
          if (email && norm(p.email).toLowerCase() === email) reasons.push('Same email');
          if (account && norm(p.banking?.accountNumber) === account && (!ifsc || !p.banking?.ifsc || upper(p.banking.ifsc) === ifsc)) reasons.push('Same bank account');
          return reasons.length ? { publisher: p, reasons } : null;
        })
        .filter(Boolean);
    },
  };
})();
