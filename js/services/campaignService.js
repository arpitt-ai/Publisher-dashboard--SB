/* campaignService — campaigns group the ROs, POs and IOs for one client engagement.
   A document copies the campaign details when it is created, so editing a campaign
   later never changes documents that were already issued. */
const campaignService = (() => {
  const KEY = COLLECTIONS.campaigns;
  const read = () => storageService.get(KEY, []).map((c) => withDefaults(c, createEmptyCampaign()));
  const write = (list) => storageService.set(KEY, list);

  const clean = (c) => ({
    ...c,
    name: norm(c.name), client: norm(c.client), owner: norm(c.owner), notes: norm(c.notes),
    startDate: norm(c.startDate), endDate: norm(c.endDate),
    budget: norm(c.budget) === '' ? '' : toNum(c.budget),
    clientDetails: { legalEntity: norm(c.clientDetails?.legalEntity), address: norm(c.clientDetails?.address), gstin: upper(c.clientDetails?.gstin) },
    publisherIds: [...new Set(c.publisherIds || [])],
  });

  const sameKey = (name, client) => `${norm(name).toLowerCase()}|${norm(client).toLowerCase()}`;

  return {
    async list() { return read(); },
    async get(id) { return read().find((c) => c.id === id) || null; },

    /** Same name for the same client is treated as the same campaign. */
    async findByNameAndClient(name, client) {
      const k = sameKey(name, client);
      return read().find((c) => sameKey(c.name, c.client) === k) || null;
    },

    async create(input) {
      assertCan('campaign.edit', 'create campaigns');
      const data = clean(withDefaults(input, createEmptyCampaign()));
      const errs = validateCampaign(data);
      if (Object.keys(errs).length) throw new Error(Object.values(errs)[0]);
      const now = nowISO();
      const actor = currentUser.actor();
      const camp = {
        ...data,
        id: input.id || uid('camp_'),
        status: CAMPAIGN_STATUSES.includes(data.status) ? data.status : suggestCampaignStatus(data.startDate, data.endDate),
        createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
      };
      const list = read();
      list.push(camp);
      write(list);
      await auditService.log({ action: 'CAMPAIGN_CREATED', entityType: 'campaign', entityId: camp.id, entityLabel: camp.name, summary: `Created campaign ${camp.name}`, detail: camp.client });
      return camp;
    },

    async update(id, input) {
      assertCan('campaign.edit', 'edit campaigns');
      const list = read();
      const idx = list.findIndex((c) => c.id === id);
      if (idx < 0) throw new Error('Campaign not found');
      const before = list[idx];
      const data = clean(withDefaults(input, createEmptyCampaign()));
      const errs = validateCampaign(data);
      if (Object.keys(errs).length) throw new Error(Object.values(errs)[0]);
      const after = {
        ...before, ...data,
        id: before.id, createdAt: before.createdAt, createdBy: before.createdBy, isDemo: before.isDemo,
        publisherIds: data.publisherIds, updatedAt: nowISO(), updatedBy: currentUser.actor(),
      };
      list[idx] = after;
      write(list);
      const changes = diffFields(before, after, CAMPAIGN_FIELD_LABELS);
      if (changes.length) {
        await auditService.log({ action: 'CAMPAIGN_UPDATED', entityType: 'campaign', entityId: id, entityLabel: after.name, summary: `Updated campaign ${after.name}`, detail: changes.map((c) => c.label).join(', '), changes, isDemo: after.isDemo });
      }
      return after;
    },

    /** Remember that a publisher works on this campaign. Quiet bookkeeping: not logged, not permission-gated. */
    async addPublisher(id, publisherId) {
      const list = read();
      const idx = list.findIndex((c) => c.id === id);
      if (idx < 0 || list[idx].publisherIds.includes(publisherId)) return;
      list[idx] = { ...list[idx], publisherIds: [...list[idx].publisherIds, publisherId] };
      write(list);
    },

    /**
     * Gives every document that has no campaign link one (matching by campaign name + client, creating the
     * campaign if needed). Safe to run repeatedly. Used when upgrading older data and after restoring sample data.
     */
    linkLegacyDocuments() {
      const docs = storageService.get(COLLECTIONS.documents, []);
      const orphans = docs.filter((d) => !d.campaignId && (d.campaign?.name || '').trim());
      if (!orphans.length) return 0;

      const camps = storageService.get(KEY, []);
      const byKey = new Map(camps.map((c) => [sameKey(c.name, c.client), c]));
      const groups = new Map();
      orphans.forEach((d) => {
        const k = sameKey(d.campaign.name, d.client?.name);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(d);
      });

      groups.forEach((group, k) => {
        let camp = byKey.get(k);
        if (!camp) {
          const starts = group.map((d) => d.campaign.startDate).filter(Boolean).sort();
          const ends = group.map((d) => d.campaign.endDate).filter(Boolean).sort();
          const first = group.slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0];
          const stamp = first.createdAt || nowISO();
          camp = {
            ...createEmptyCampaign(),
            id: uid('camp_'), name: group[0].campaign.name.trim(), client: (group[0].client?.name || '').trim() || 'Not specified',
            clientDetails: { legalEntity: group[0].client?.legalEntity || '', address: group[0].client?.address || '', gstin: group[0].client?.gstin || '' },
            startDate: starts[0] || '', endDate: ends[ends.length - 1] || '',
            status: suggestCampaignStatus(starts[0], ends[ends.length - 1]),
            publisherIds: [...new Set(group.map((d) => d.publisherId))],
            notes: 'Created automatically from existing documents.',
            createdAt: stamp, createdBy: first.createdBy || currentUser.actor(), updatedAt: stamp, updatedBy: first.createdBy || currentUser.actor(),
            ...(group.every((d) => d.isDemo) ? { isDemo: true } : {}),
          };
          camps.push(camp);
          byKey.set(k, camp);
        }
        group.forEach((d) => { d.campaignId = camp.id; });
      });

      storageService.set(KEY, camps);
      storageService.set(COLLECTIONS.documents, docs);
      return orphans.length;
    },
  };
})();
