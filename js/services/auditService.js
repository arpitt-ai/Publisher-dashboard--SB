/* auditService — append-only activity log. Every entry records who did what, to what, and when. */
const auditService = {
  /** Record an event. `performedBy` and `timestamp` are stamped automatically. */
  async log({ action, entityType, entityId, entityLabel = '', summary, detail = '', changes = null, isDemo = false, performedBy, timestamp }) {
    const entry = {
      id: uid('act_'),
      action,
      entityType: entityType || AUDIT_ACTIONS[action]?.entity || '',
      entityId: entityId || '',
      entityLabel,
      summary,
      detail,
      changes: changes && changes.length ? changes : null,
      performedBy: performedBy || currentUser.actor(),
      timestamp: timestamp || nowISO(),
    };
    if (isDemo) entry.isDemo = true;
    // read-modify-write with no await in between, so concurrent logs cannot clobber each other
    const list = storageService.get(COLLECTIONS.activity, []);
    list.unshift(entry);
    storageService.set(COLLECTIONS.activity, list.slice(0, 5000));
    return entry;
  },

  /** Newest first. */
  async list() {
    return storageService.get(COLLECTIONS.activity, []);
  },

  async listForEntity(entityType, entityId) {
    return (await this.list()).filter((a) => a.entityType === entityType && a.entityId === entityId);
  },
};
