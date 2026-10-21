/* reportService — five simple reports, built from the saved records.
   Each report returns { columns, rows, totals? }. A column is
     { header, value(row) -> raw value (used in the CSV), kind?: 'money' | 'number' | 'date' | 'text' }
   so the screen and the CSV file always show the same figures. Pure functions: easy to test. */
const REPORTS = [
  { id: 'publishers', label: 'Publisher Directory', description: 'Every publisher with contact and tax details. The date filter is the date they were added.' },
  { id: 'campaigns', label: 'Campaign Booking Summary', description: 'Documents and booked value for each campaign. The date filter is the document date.' },
  { id: 'status', label: 'RO / PO / IO Status', description: 'How many documents are in each status. The date filter is the document date.' },
  { id: 'pending', label: 'Pending Approvals', description: 'Documents waiting for an approver. The date filter is the document date.' },
  { id: 'monthly', label: 'Monthly Booking Value', description: 'Approved and sent documents by month. The date filter is the document date.' },
];

const reportService = (() => {
  const inRange = (day, { from, to }) => !!day && (!from || day >= from) && (!to || day <= to);
  const liveDocs = (docs) => docs.filter((d) => !d.archived);
  const amountOf = (d) => toNum(d.commercial?.totalAmount);
  const monthKey = (iso) => String(iso).slice(0, 7);
  const monthLabel = (key) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
  const money = (header, value) => ({ header, value, kind: 'money' });
  const text = (header, value) => ({ header, value, kind: 'text' });
  const num = (header, value) => ({ header, value, kind: 'number' });
  const date = (header, value) => ({ header, value, kind: 'date' });

  function publishers({ publishers: list }, range) {
    const rows = list.filter((p) => (!range.from && !range.to) || inRange(localDay(p.createdAt), range)).sort((a, b) => a.publisherName.localeCompare(b.publisherName));
    return {
      columns: [
        text('Publisher name', (p) => p.publisherName), text('Legal company name', (p) => p.legalEntityName), text('Vendor category', (p) => p.vendorCategory),
        text('GSTIN', (p) => p.tax?.gstin), text('PAN', (p) => p.tax?.pan), text('Primary contact', (p) => p.contactPerson),
        text('Email', (p) => p.email), text('Phone', (p) => p.phone), text('City', (p) => p.address?.city), text('State', (p) => p.address?.state),
        text('Payment terms', (p) => p.commercial?.paymentTerms), text('Status', (p) => p.status), date('Added on', (p) => localDay(p.createdAt)),
      ],
      rows,
    };
  }

  function campaigns({ campaigns: list, documents }, range) {
    const filtering = !!(range.from || range.to);
    const docsIn = liveDocs(documents).filter((d) => !filtering || inRange(d.issueDate, range));
    const rows = list.map((c) => {
      const mine = docsIn.filter((d) => d.campaignId === c.id);
      const booked = mine.filter((d) => BOOKED_STATUSES.includes(d.status));
      return {
        c, count: mine.length, bookedCount: booked.length,
        bookedValue: booked.reduce((s, d) => s + amountOf(d), 0),
        pendingValue: mine.filter((d) => d.status === 'Pending Approval').reduce((s, d) => s + amountOf(d), 0),
        publishers: new Set(mine.map((d) => d.publisherId)).size,
      };
    }).filter((r) => !filtering || r.count > 0).sort((a, b) => b.bookedValue - a.bookedValue || a.c.name.localeCompare(b.c.name));
    return {
      columns: [
        text('Campaign', (r) => r.c.name), text('Client', (r) => r.c.client), text('Owner', (r) => r.c.owner), text('Status', (r) => r.c.status),
        date('Start date', (r) => r.c.startDate), date('End date', (r) => r.c.endDate), money('Budget', (r) => (toNum(r.c.budget) > 0 ? toNum(r.c.budget) : '')),
        num('Publishers', (r) => r.publishers), num('Documents', (r) => r.count), num('Approved or sent', (r) => r.bookedCount),
        money('Booked value (incl. tax)', (r) => r.bookedValue), money('Waiting for approval', (r) => r.pendingValue),
      ],
      rows,
      totals: { 'Documents': rows.reduce((s, r) => s + r.count, 0), 'Booked value (incl. tax)': rows.reduce((s, r) => s + r.bookedValue, 0) },
    };
  }

  function status({ documents }, range) {
    const docs = liveDocs(documents).filter((d) => (!range.from && !range.to) || inRange(d.issueDate, range));
    const types = DOCUMENT_TYPE_LIST.filter((t) => t.enabled).map((t) => t.code);
    const rows = [...types, 'All'].map((t) => {
      const mine = t === 'All' ? docs : docs.filter((d) => d.documentType === t);
      const byStatus = Object.fromEntries(DOCUMENT_STATUSES.map((s) => [s, mine.filter((d) => d.status === s).length]));
      return { type: t, byStatus, total: mine.length, value: mine.filter((d) => BOOKED_STATUSES.includes(d.status)).reduce((s, d) => s + amountOf(d), 0) };
    });
    return {
      columns: [
        text('Type', (r) => (r.type === 'All' ? 'All types' : r.type)),
        ...DOCUMENT_STATUSES.map((s) => num(s, (r) => r.byStatus[s])),
        num('Total', (r) => r.total), money('Approved or sent value', (r) => r.value),
      ],
      rows,
    };
  }

  function pending({ documents }, range) {
    const rows = liveDocs(documents).filter((d) => d.status === 'Pending Approval' && ((!range.from && !range.to) || inRange(d.issueDate, range)))
      .map((d) => {
        const sub = [...(d.statusHistory || [])].reverse().find((h) => h.to === 'Pending Approval');
        return { d, submittedBy: sub ? actorName(sub.by) : actorName(d.updatedBy), submittedAt: sub ? sub.at : d.updatedAt };
      })
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    const today = parseDate(todayISO());
    return {
      columns: [
        text('Document number', (r) => r.d.documentNumber), text('Type', (r) => r.d.documentType), text('Publisher', (r) => r.d.publisherSnapshot?.publisherName),
        text('Campaign', (r) => r.d.campaign?.name), text('Client', (r) => r.d.client?.name), money('Amount (incl. tax)', (r) => amountOf(r.d)),
        text('Submitted by', (r) => r.submittedBy), date('Submitted on', (r) => localDay(r.submittedAt)),
        num('Days waiting', (r) => Math.max(0, Math.round((today - parseDate(localDay(r.submittedAt))) / 86400000))),
      ],
      rows,
      totals: { 'Amount (incl. tax)': rows.reduce((s, r) => s + amountOf(r.d), 0) },
    };
  }

  function monthly({ documents }, range) {
    const docs = liveDocs(documents).filter((d) => BOOKED_STATUSES.includes(d.status) && d.issueDate && ((!range.from && !range.to) || inRange(d.issueDate, range)));
    const byMonth = new Map();
    docs.forEach((d) => {
      const k = monthKey(d.issueDate);
      const c = computeCommercial(d.commercial);
      const row = byMonth.get(k) || { month: k, count: 0, taxable: 0, gst: 0, total: 0 };
      row.count += 1; row.taxable += c.taxable; row.gst += c.gstAmount; row.total += amountOf(d);
      byMonth.set(k, row);
    });
    const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).map((r) => ({ ...r, taxable: round2(r.taxable), gst: round2(r.gst), total: round2(r.total) }));
    return {
      columns: [
        text('Month', (r) => monthLabel(r.month)), num('Documents', (r) => r.count),
        money('Before tax', (r) => r.taxable), money('GST', (r) => r.gst), money('Total (incl. tax)', (r) => r.total),
      ],
      rows,
      totals: { 'Documents': rows.reduce((s, r) => s + r.count, 0), 'Before tax': round2(rows.reduce((s, r) => s + r.taxable, 0)), 'GST': round2(rows.reduce((s, r) => s + r.gst, 0)), 'Total (incl. tax)': round2(rows.reduce((s, r) => s + r.total, 0)) },
    };
  }

  const builders = { publishers, campaigns, status, pending, monthly };

  return {
    build(id, data, range = {}) {
      const b = builders[id];
      if (!b) throw new Error('Unknown report');
      return b(data, { from: range.from || '', to: range.to || '' });
    },
    /** Text for a cell on screen (money and dates formatted; the CSV keeps raw values). */
    display(col, raw) {
      if (raw === '' || raw == null) return '—';
      if (col.kind === 'money') return fmtINR(raw);
      if (col.kind === 'number') return fmtNum(raw);
      if (col.kind === 'date') return fmtDate(raw);
      return String(raw);
    },
  };
})();
