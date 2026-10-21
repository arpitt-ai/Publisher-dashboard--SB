/* Numbers shown on the dashboard, worked out from the saved records (pure functions, so they can be tested). */
/* Everything on this page is worked out from the saved records — no typed-in numbers. */
function dashboardNumbers({ publishers, campaigns, documents }, today = todayISO()) {
  const live = documents.filter((d) => !d.archived);
  const booked = live.filter((d) => BOOKED_STATUSES.includes(d.status));
  const soon = (iso) => iso && iso >= today && iso <= addDays(today, 30);
  const upcoming = [];
  campaigns.filter((c) => !['Completed', 'Cancelled'].includes(c.status)).forEach((c) => {
    if (soon(c.startDate)) upcoming.push({ campaign: c, kind: 'Starts', date: c.startDate });
    if (soon(c.endDate)) upcoming.push({ campaign: c, kind: 'Ends', date: c.endDate });
  });
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  return {
    activePublishers: publishers.filter((p) => p.status === 'Active').length,
    campaignsInProgress: campaigns.filter((c) => c.status === 'In Progress').length,
    pending: live.filter((d) => d.status === 'Pending Approval'),
    rejected: live.filter((d) => d.status === 'Rejected'),
    drafts: live.filter((d) => d.status === 'Draft'),
    bookingValue: booked.reduce((s, d) => s + toNum(d.commercial?.totalAmount), 0),
    bookedCount: booked.length,
    upcoming,
    recent: [...live].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
  };
}

/* "Acme Ltd" and " acme  ltd " are the same client. */
const clientKey = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * One row per client that has at least one RO, PO or IO, with a count of each, worked out from the documents.
 * Archived documents are left out. Sorted A to Z.
 */
function clientSummaries(documents, campaigns = []) {
  const byKey = new Map();
  documents.filter((d) => !d.archived).forEach((d) => {
    const key = clientKey(d.client?.name);
    const row = byKey.get(key) || { key, name: (d.client?.name || '').trim() || 'Not specified', counts: { RO: 0, PO: 0, IO: 0 }, total: 0, bookedValue: 0, campaignIds: new Set(), updatedAt: '' };
    row.counts[d.documentType] = (row.counts[d.documentType] || 0) + 1;
    row.total += 1;
    if (BOOKED_STATUSES.includes(d.status)) row.bookedValue += toNum(d.commercial?.totalAmount);
    if (d.campaignId) row.campaignIds.add(d.campaignId);
    else if (d.campaign?.name) row.campaignIds.add('name:' + d.campaign.name);
    if ((d.updatedAt || '') > row.updatedAt) row.updatedAt = d.updatedAt;
    byKey.set(key, row);
  });
  return [...byKey.values()]
    .map((r) => ({ ...r, campaigns: r.campaignIds.size, campaignIds: undefined }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function addDays(iso, n) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

