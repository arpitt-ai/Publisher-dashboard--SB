/* Fast, case-insensitive, multi-term search + filter + sort (pure functions). */

const matchesTerms = (haystack, q) => {
  const terms = (q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const h = haystack.toLowerCase();
  return terms.every((t) => h.includes(t));
};

/** ISO timestamp -> local YYYY-MM-DD, for date-range filters. */
const localDay = (iso) => {
  const d = parseDate(iso);
  return d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : '';
};

function filterPublishers(list, { q = '', status = '', sort = 'name' } = {}) {
  const out = list.filter((p) => {
    if (status && p.status !== status) return false;
    if (!q) return true;
    return matchesTerms([p.publisherName, p.legalEntityName, p.tax?.gstin, p.tax?.pan, p.email, p.contactPerson, p.phone].join(' '), q);
  });
  const by = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    name: (a, b) => a.publisherName.localeCompare(b.publisherName, undefined, { sensitivity: 'base' }),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  };
  return out.sort(by[sort] || by.name);
}

/* Documents on the other side of a link: explicitly linked ones plus everything in the same campaign. */
function relatedDocuments(doc, all) {
  const linked = new Set(doc.relatedIds || []);
  return all
    .filter((d) => d.id !== doc.id && !d.archived && (linked.has(d.id) || (doc.campaignId && d.campaignId === doc.campaignId)))
    .sort((a, b) => a.documentType.localeCompare(b.documentType) || String(a.documentNumber).localeCompare(String(b.documentNumber)));
}

function filterDocuments(list, f = {}, publishersById = {}) {
  const { q = '', type = '', status = '', publisherId = '', client = '', campaignId = '', createdBy = '', from = '', to = '', sort = 'updated', includeArchived = false } = f;
  const pubName = (d) => d.publisherSnapshot?.publisherName || publishersById[d.publisherId]?.publisherName || '';
  const out = list.filter((d) => {
    if (d.archived && !includeArchived) return false;
    if (type && d.documentType !== type) return false;
    if (status && d.status !== status) return false;
    if (publisherId && d.publisherId !== publisherId) return false;
    if (campaignId && d.campaignId !== campaignId) return false;
    if (client && d.client?.name !== client) return false;
    if (createdBy && d.createdBy?.id !== createdBy) return false;
    const day = d.issueDate || localDay(d.createdAt); // the date printed on the document
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (!q) return true;
    return matchesTerms([d.documentNumber, pubName(d), d.client?.name, d.campaign?.name].join(' '), q);
  });
  const amt = (d) => toNum(d.commercial?.totalAmount);
  const by = {
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
    'amount-desc': (a, b) => amt(b) - amt(a),
    'amount-asc': (a, b) => amt(a) - amt(b),
  };
  return out.sort(by[sort] || by.updated);
}

function filterCampaigns(list, { q = '', status = '' } = {}) {
  return list
    .filter((c) => (!status || c.status === status) && (!q || matchesTerms([c.name, c.client, c.owner].join(' '), q)))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function filterActivity(list, { q = '', action = '', entityType = '', user = '', from = '', to = '' } = {}) {
  return list.filter((a) => {
    if (action && a.action !== action) return false;
    if (entityType && a.entityType !== entityType) return false;
    if (user && a.performedBy?.id !== user) return false;
    const day = localDay(a.timestamp);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (!q) return true;
    return matchesTerms([a.summary, a.detail, a.entityLabel, a.performedBy?.name, AUDIT_ACTIONS[a.action]?.label].join(' '), q);
  });
}
