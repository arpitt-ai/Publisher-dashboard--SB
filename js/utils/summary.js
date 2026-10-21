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

function addDays(iso, n) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

