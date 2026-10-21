/* migrationService — brings records saved by older versions up to date, without losing anything.

   Rules:
   - Never clears or re-seeds storage.
   - Before the first change it saves an untouched copy of the old records under the key `backup_v1`.
   - Every step can be run twice without harm (it only fills gaps).

   Version 2 (this release):
   - the old "Generated" status becomes "Approved" (a status history note says so)
   - every document gets a status history and an (empty) list of linked documents
   - a stored total that does not match its own numbers (the first sample records left GST out) is corrected
   - documents are grouped into campaigns (matched by campaign name + client), so the Campaigns screen starts populated */
const migrationService = (() => {
  const SCHEMA_VERSION = 2;
  const MIGRATION_ACTOR = { id: 'system-upgrade', name: 'System upgrade' };

  function backupOnce() {
    if (storageService.get(COLLECTIONS.backup, null)) return;
    storageService.set(COLLECTIONS.backup, {
      at: nowISO(), schemaVersion: 1,
      publishers: storageService.get(COLLECTIONS.publishers, []),
      documents: storageService.get(COLLECTIONS.documents, []),
      settings: storageService.get(COLLECTIONS.settings, null),
      counters: storageService.get(COLLECTIONS.counters, {}),
    });
  }

  function migrateDocuments() {
    const docs = storageService.get(COLLECTIONS.documents, []);
    let changed = 0;
    let totalsRepaired = 0;
    const now = nowISO();
    docs.forEach((d) => {
      let touched = false;
      // The earlier sample records were saved with a total that left GST out, while the PDF always added it.
      // The number printed on the PDF is the right one, so make the stored total match it.
      if (d.commercial && !totalsAreConsistent(d.commercial)) {
        d.commercial = { ...d.commercial, totalAmount: computeCommercial(d.commercial).total };
        totalsRepaired += 1;
        touched = true;
      }
      if (LEGACY_STATUS_MAP[d.status]) {
        const from = d.status;
        d.status = LEGACY_STATUS_MAP[from];
        d.statusHistory = [...(d.statusHistory || []), { from, to: d.status, by: MIGRATION_ACTOR, at: now, comment: `The status “${from}” is now called “${d.status}”.` }];
        touched = true;
      }
      if (!Array.isArray(d.statusHistory)) {
        d.statusHistory = [{ from: null, to: d.status, by: MIGRATION_ACTOR, at: now, comment: 'Status recorded when this record was upgraded.' }];
        touched = true;
      }
      if (!Array.isArray(d.relatedIds)) { d.relatedIds = []; touched = true; }
      if (touched) changed += 1;
    });
    if (changed) storageService.set(COLLECTIONS.documents, docs);
    return { changed, totalsRepaired };
  }

  return {
    SCHEMA_VERSION,

    /** Runs at start-up, before the first screen is drawn. */
    run() {
      const meta = storageService.get(COLLECTIONS.meta, null);
      if (meta && meta.schemaVersion >= SCHEMA_VERSION) return { migrated: false };
      const hasOldData = storageService.get(COLLECTIONS.documents, []).length > 0 || storageService.get(COLLECTIONS.publishers, []).length > 0;
      if (hasOldData) backupOnce();
      const { changed: documentsUpdated, totalsRepaired } = migrateDocuments();
      const linked = campaignService.linkLegacyDocuments();
      storageService.set(COLLECTIONS.meta, { schemaVersion: SCHEMA_VERSION, migratedAt: nowISO(), documentsUpdated, totalsRepaired, documentsLinkedToCampaigns: linked });
      return { migrated: true, documentsUpdated, totalsRepaired, linked };
    },
  };
})();
