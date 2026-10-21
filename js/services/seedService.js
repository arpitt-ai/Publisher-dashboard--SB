/* seedService — first-run bootstrap, legacy migration and sample-data management. */
const seedService = (() => {
  const LEGACY_ACTOR = { id: 'legacy-import', name: 'Imported (first draft)' };
  const DEMO_PUB_IDS = ['pub1', 'pub2', 'pub3', 'pub4', 'pub5', 'pub6'];
  const DEMO_DOC_IDS = ['ro1', 'ro2', 'ro3', 'ro4'];

  /* Convert records saved by the first-draft app (localStorage keys af_pubs / af_ros). */
  function migrateLegacy() {
    const oldPubs = storageService.readLegacy('af_pubs');
    const oldRos = storageService.readLegacy('af_ros');
    const publishers = [];
    const documents = [];
    const counters = {};

    (Array.isArray(oldPubs) ? oldPubs : []).filter((p) => p && !DEMO_PUB_IDS.includes(p.id)).forEach((p) => {
      const pin = /[–-]\s*(\d{6})\s*$/.exec(p.address || '');
      const created = p.createdAt ? `${p.createdAt}T10:00:00.000Z` : nowISO();
      publishers.push({
        ...createEmptyPublisher(),
        id: p.id, publisherName: p.publisherName, legalEntityName: p.companyName,
        contactPerson: p.contactPerson, email: p.email, phone: p.phone,
        address: { line1: (p.address || '').replace(/\s*[–-]\s*\d{6}\s*$/, ''), line2: '', city: '', state: '', pinCode: pin ? pin[1] : '', country: 'India' },
        tax: { gstin: p.gstNumber || '', pan: (p.gstNumber || '').slice(2, 12), cin: '', tan: '' },
        createdAt: created, createdBy: LEGACY_ACTOR, updatedAt: created, updatedBy: LEGACY_ACTOR,
      });
    });

    (Array.isArray(oldRos) ? oldRos : []).filter((r) => r && !DEMO_DOC_IDS.includes(r.id)).forEach((r) => {
      const model = PRICING_BY_CODE[r.pricingModel] ? r.pricingModel : 'Other';
      const qty = { CPM: r.impressions, CPC: r.clicks, CPL: r.leads, CPA: r.leads }[model] || '';
      const cost = toNum(r.cost);
      const rate = model === 'CPM' && toNum(qty) ? (cost / toNum(qty)) * 1000 : model === 'Fixed' || !toNum(qty) ? cost : cost / toNum(qty);
      const parsed = parseDocumentNumber(r.roNumber);
      const created = r.createdAt ? `${r.createdAt}T11:00:00.000Z` : nowISO();
      if (parsed) counters[counterKey('RO', parsed.year)] = Math.max(counters[counterKey('RO', parsed.year)] || 0, parsed.seq);
      documents.push({
        ...createEmptyDocument('RO'),
        id: r.id, documentNumber: r.roNumber, documentType: 'RO', numberYear: parsed?.year, numberSeq: parsed?.seq,
        publisherId: r.publisherId,
        publisherSnapshot: {
          publisherName: r.publisherName, legalEntityName: r.companyName, gstin: r.gstNumber || '',
          address: { line1: r.address || '', line2: '', city: '', state: '', pinCode: '', country: 'India' },
          contactPerson: r.contactPerson, email: r.email, phone: r.phone, msme: { registered: false, registrationNumber: '' }, capturedAt: created,
        },
        client: { name: r.clientName, legalEntity: '', address: '', gstin: '' },
        campaign: { name: r.campaignName, startDate: r.startDate, endDate: r.endDate, type: '', platform: r.platform || '', adFormat: r.adFormat || '' },
        commercial: { pricingModel: model, rate: round2(rate), quantity: toNum(qty), estimatedSpend: cost, spendOverride: true, gstPercent: toNum(r.gstPercent), totalAmount: toNum(r.totalAmount) },
        notes: r.notes || '', issueDate: r.issueDate || todayISO(),
        status: normalizeStatus(r.status),
        createdAt: created, createdBy: LEGACY_ACTOR, updatedAt: created, updatedBy: LEGACY_ACTOR,
      });
    });
    return { publishers, documents, counters };
  }

  /* Merge records into a collection by id (existing ids are left untouched). */
  function mergeById(key, incoming) {
    const list = storageService.get(key, []);
    const have = new Set(list.map((x) => x.id));
    const add = incoming.filter((x) => !have.has(x.id));
    if (add.length) storageService.set(key, [...list, ...add]);
    return add.length;
  }
  function mergeCounters(incoming) {
    const counters = storageService.get(COLLECTIONS.counters, {});
    Object.entries(incoming).forEach(([k, v]) => { counters[k] = Math.max(counters[k] || 0, v); });
    storageService.set(COLLECTIONS.counters, counters);
  }

  function importDemo() {
    const demo = buildDemoData();
    const p = mergeById(COLLECTIONS.publishers, demo.publishers);
    const d = mergeById(COLLECTIONS.documents, demo.documents);
    campaignService.linkLegacyDocuments(); // sample documents get their campaigns too
    const activityList = storageService.get(COLLECTIONS.activity, []);
    const haveAct = new Set(activityList.map((a) => a.id));
    const newAct = demo.activity.filter((a) => !haveAct.has(a.id));
    if (newAct.length) storageService.set(COLLECTIONS.activity, [...activityList, ...newAct].sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    mergeCounters(demo.counters);
    return { publishers: p, documents: d };
  }

  return {
    /** Runs once, synchronously, before the UI renders. */
    bootstrap() {
      if (!storageService.get(COLLECTIONS.seeded, null)) {
        importDemo();
        const legacy = migrateLegacy();
        mergeById(COLLECTIONS.publishers, legacy.publishers);
        mergeById(COLLECTIONS.documents, legacy.documents);
        mergeCounters(legacy.counters);
        storageService.set(COLLECTIONS.seeded, { at: nowISO(), legacyPublishers: legacy.publishers.length, legacyDocuments: legacy.documents.length });
      }
      migrationService.run(); // upgrades records from older versions (never wipes anything)
      campaignService.linkLegacyDocuments();
    },

    /** Add back any sample records that are missing. */
    async restoreSampleData() { assertCan('data.manage', 'restore sample data'); return importDemo(); },

    /** Remove sample records only. Sample publishers still referenced by real documents are kept. */
    async removeSampleData() {
      assertCan('data.manage', 'remove sample data');
      const docs = storageService.get(COLLECTIONS.documents, []);
      const realRefs = new Set(docs.filter((d) => !d.isDemo).map((d) => d.publisherId));
      const realCampaignRefs = new Set(docs.filter((d) => !d.isDemo).map((d) => d.campaignId));
      const pubs = storageService.get(COLLECTIONS.publishers, []);
      const keepPubs = pubs.filter((p) => !p.isDemo || realRefs.has(p.id));
      storageService.set(COLLECTIONS.publishers, keepPubs);
      storageService.set(COLLECTIONS.documents, docs.filter((d) => !d.isDemo));
      storageService.set(COLLECTIONS.campaigns, storageService.get(COLLECTIONS.campaigns, []).filter((c) => !c.isDemo || realCampaignRefs.has(c.id)));
      storageService.set(COLLECTIONS.activity, storageService.get(COLLECTIONS.activity, []).filter((a) => !a.isDemo));
      return { removedPublishers: pubs.length - keepPubs.length, keptPublishers: pubs.filter((p) => p.isDemo && realRefs.has(p.id)).length };
    },

    /** Wipe everything (records, activity, counters, uploaded files). */
    async clearAll() {
      assertCan('data.manage', 'delete all data');
      const pubs = storageService.get(COLLECTIONS.publishers, []);
      await fileService.deleteMany(pubs.flatMap((p) => (p.complianceDocuments || []).map((d) => d.fileId)));
      [COLLECTIONS.publishers, COLLECTIONS.campaigns, COLLECTIONS.documents, COLLECTIONS.activity, COLLECTIONS.counters].forEach((k) => storageService.remove(k));
    },

    /** Saves every record to a JSON file the user can keep. Returns how many records it holds. */
    downloadBackup() {
      assertCan('data.manage', 'download a backup');
      const dump = {
        app: 'publisher-portal', exportedAt: nowISO(), schemaVersion: migrationService.SCHEMA_VERSION,
        settings: storageService.get(COLLECTIONS.settings, null), counters: storageService.get(COLLECTIONS.counters, {}),
        publishers: storageService.get(COLLECTIONS.publishers, []), campaigns: storageService.get(COLLECTIONS.campaigns, []),
        documents: storageService.get(COLLECTIONS.documents, []), activity: storageService.get(COLLECTIONS.activity, []),
      };
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `publisher-portal-backup-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return dump.publishers.length + dump.campaigns.length + dump.documents.length;
    },

    hasSampleData() {
      return storageService.get(COLLECTIONS.publishers, []).some((p) => p.isDemo) || storageService.get(COLLECTIONS.documents, []).some((d) => d.isDemo);
    },
  };
})();
