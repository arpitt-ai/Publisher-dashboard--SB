/* ──────────────────────────────────────────────────────────────
   pdfService — document generation (jsPDF + AutoTable).

   One builder produces RO, PO and IO (only the title and opening sentence differ).
   All data comes from the saved document: the publisher and agency details are the
   snapshots stored with it, so a PDF downloaded next year matches the one downloaded today.
   Settings → Organization controls the agency details for new documents.
   ────────────────────────────────────────────────────────────── */
const pdfService = (() => {
  const W = 210;
  const M = 18;
  const FOOTER_Y = 272;
  const CONTENT_MAX_Y = 269;
  const PAGE_TOP = 24;

  /* The built-in PDF fonts have no rupee glyph (it would print as "¹"), so money uses "INR". */
  const money = (n) => 'INR ' + toNum(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* The built-in fonts only cover Western characters. Swap common look-alikes and drop anything else
     so notes pasted from Word or a browser never print as garbage. */
  const safe = (s) => String(s == null ? '' : s)
    .replace(/₹/g, 'INR ').replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
    .replace(/[   ]/g, ' ').replace(/•/g, '-')
    .replace(/[^\n\t\x20-\x7E¡-ÿ]/g, '');

  const WATERMARK = { Draft: 'DRAFT', 'Pending Approval': 'PENDING APPROVAL', Rejected: 'REJECTED', Cancelled: 'CANCELLED' };

  function msmeLine(pub) {
    return pub.msme?.registered
      ? `MSME: Registered${pub.msme.registrationNumber ? ' - Udyam No. ' + pub.msme.registrationNumber : ''}`
      : 'MSME: Not registered';
  }

  function drawFooter(doc, org, docData, page, pages) {
    doc.setDrawColor(210, 50, 50);
    doc.setLineWidth(1.2);
    doc.line(0, FOOTER_Y, W, FOOTER_Y);
    doc.setFillColor(252, 252, 252);
    doc.rect(0, FOOTER_Y, W, 25, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(safe(org.footerName || org.name.toUpperCase()), M, FOOTER_Y + 8);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(safe(`${org.footerAddress}. GSTIN: ${org.gstin}, CIN: ${org.cin}`), M, FOOTER_Y + 14);

    doc.setTextColor(220, 38, 38);
    doc.setFontSize(7.5);
    doc.text(safe(org.website), W - M, FOOTER_Y + 14, { align: 'right' });

    doc.setTextColor(160, 160, 160);
    doc.setFontSize(6.5);
    const prepared = docData.createdBy?.name ? `  |  Prepared by ${docData.createdBy.name}` : '';
    doc.text(safe(`Generated: ${new Date().toLocaleString('en-IN')}  |  ${docData.documentNumber}${prepared}  |  Page ${page} of ${pages}`), W / 2, FOOTER_Y + 20, { align: 'center' });
  }

  /* A faint diagonal word across the page for documents that are not final. */
  function drawWatermark(doc, text) {
    try {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.09 }));
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(text.length > 9 ? 46 : 78);
      doc.text(text, W / 2, 150, { align: 'center', angle: 38 });
      doc.restoreGraphicsState();
    } catch (e) { /* the watermark is a nicety; never block the PDF over it */ }
  }

  /* ── One builder for RO / PO / IO ──────────────────────────── */
  function buildOrderPdf(docData, { publisher, org, settings }) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const typeInfo = DOCUMENT_TYPES[docData.documentType];
    const cm = docData.commercial;
    const c = computeCommercial(cm);
    const model = PRICING_BY_CODE[cm.pricingModel];
    const cp = docData.campaign || {};
    const client = docData.client || {};
    const paymentTerms = docData.paymentTerms || settings.defaults.paymentTerms;
    const T = (s) => safe(s);

    // Header — logo left, cities right
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, 28, 'F');
    doc.addImage(LOGO_DARK_DATA_URI, 'PNG', M, 5, 17 * LOGO_RATIO, 17, 'sb-logo', 'FAST'); // Social Beat logo, transparent background
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(T(org.cities), W - M, 15, { align: 'right' });
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.4);
    doc.line(M, 27, W - M, 27);

    // Date / document no / advertiser — top right
    let y = 36;
    const rightX = W - M;
    const rightCol = W / 2 + 4;
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(`Date: ${fmtDate(docData.issueDate)}`, rightX, y, { align: 'right' });
    y += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.text(`${docData.documentType} No: ${docData.documentNumber}`, rightX, y, { align: 'right' });
    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.text(T(`Advertiser: ${client.name}`), rightX, y, { align: 'right' });

    // Left block — "To," + publisher (from the document's publisher snapshot)
    let ly = 36;
    doc.text('To,', M, ly);
    ly += 7;
    doc.setFont('helvetica', 'bold');
    const nameLines = doc.splitTextToSize(T((publisher.legalEntityName || publisher.publisherName || '').toUpperCase()), 85);
    doc.text(nameLines, M, ly);
    ly += nameLines.length * 5;
    doc.setFont('helvetica', 'normal');
    const addrLines = doc.splitTextToSize(T(joinAddress(publisher.address)), 85);
    doc.text(addrLines, M, ly);
    ly += addrLines.length * 5 + 2;
    if (publisher.gstin) { doc.text(`GSTIN: ${publisher.gstin}`, M, ly); ly += 5; }
    doc.setFont('helvetica', 'bold');
    doc.text(T(msmeLine(publisher)), M, ly);
    doc.setFont('helvetica', 'normal');
    ly += 5;

    // Right block — agency details
    let ry = 52;
    doc.text('Agency Details:', rightCol, ry);
    ry += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.text(T(org.name), rightCol, ry);
    ry += 5.5;
    doc.setFont('helvetica', 'normal');
    const agencyLines = doc.splitTextToSize(T(org.address), 78);
    doc.text(agencyLines, rightCol, ry);
    ry += agencyLines.length * 5 + 1;
    doc.text(T(`GSTIN: ${org.gstin}`), rightCol, ry); ry += 5;
    doc.text(T(`Contact Person: ${org.contactPerson}`), rightCol, ry); ry += 5;
    doc.text(T(`Mail ID: ${org.email}`), rightCol, ry); ry += 5;
    if (org.accountsEmail) doc.text(T(org.accountsEmail), rightCol, ry);

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(W / 2, 33, W / 2, Math.max(ly, ry) + 4);

    // Title, subject and intro
    y = Math.max(ly, ry) + 8;
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.4);
    doc.line(M, y - 4, W - M, y - 4);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(typeInfo.pdfTitle, W / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    const subject = doc.splitTextToSize(T(`Subject: Regarding Campaign for ${client.name}${cp.name ? ' - ' + cp.name : ''}`), W - M * 2);
    doc.text(subject, M, y);
    y += subject.length * 5 + 3;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    const intro = typeInfo.intro.replace('{total}', money(c.total));
    const introLines = doc.splitTextToSize(intro, W - M * 2);
    doc.text(introLines, M, y);
    y += introLines.length * 5.2 + 3;

    const tableBase = {
      margin: { left: M, right: M, top: PAGE_TOP, bottom: 297 - CONTENT_MAX_Y }, // keeps tables clear of the footer on every page
      theme: 'grid', tableLineColor: [180, 180, 180], tableLineWidth: 0.3,
      rowPageBreak: 'avoid', showHead: 'everyPage',
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: 2.8 },
      bodyStyles: { fontSize: 8.8, textColor: [40, 40, 40], cellPadding: 2.2, valign: 'top', fillColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [255, 255, 255] },
    };

    // Table 1 — what is being booked
    const details = [
      [cp.name ? 'Campaign' : 'Client', T(cp.name ? `${cp.name}${client.name ? '  (for ' + client.name + ')' : ''}` : (client.name || '-'))],
      ['Campaign period', cp.startDate || cp.endDate ? `${fmtDate(cp.startDate)} to ${fmtDate(cp.endDate)}` : '-'],
    ];
    const placement = [cp.platform, cp.adFormat].filter(Boolean).join(' / ');
    if (placement) details.push(['Platform / format', T(placement)]);
    const dLines = deliverableLines(docData);
    const dText = [...dLines.map((l) => `${l.label}: ${l.value}${l.billed ? ' (billed)' : ''}`), ...(docData.deliverables?.other ? [docData.deliverables.other] : [])].join('\n');
    if (dText) details.push(['Deliverables', T(dText)]);
    doc.autoTable({
      ...tableBase, startY: y,
      head: [[{ content: 'Campaign Details', colSpan: 2 }]],
      body: details,
      columnStyles: { 0: { cellWidth: 44, fontStyle: 'bold', fillColor: [247, 247, 247] }, 1: { cellWidth: 'auto' } },
    });
    y = doc.lastAutoTable.finalY + 5;

    // Table 2 — the money
    const rows = [[T(describePricing(cm, money) || 'Subtotal'), money(c.subtotal)]];
    if (c.discount > 0) rows.push([cm.discountType === 'amount' ? 'Discount' : `Discount (${toNum(cm.discountValue)}%)`, '- ' + money(c.discount)]);
    if (c.otherCharges > 0) rows.push([T(cm.otherChargesLabel || 'Other charges'), money(c.otherCharges)]);
    if (c.discount > 0 || c.otherCharges > 0) rows.push(['Taxable value', money(c.taxable)]);
    c.taxLines.forEach((l) => rows.push([l.label, money(l.amount)]));
    rows.push(['Total (including tax)', money(c.total)]);
    doc.autoTable({
      ...tableBase, startY: y,
      head: [['Commercial Details', 'Amount']],
      body: rows,
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'right', cellWidth: 50 } },
      didParseCell: (d) => {
        if (d.section === 'head' && d.column.index === 1) d.cell.styles.halign = 'right';
        if (d.section === 'body' && d.row.index === rows.length - 1) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fontSize = 10; d.cell.styles.fillColor = [247, 247, 247]; }
      },
    });
    y = doc.lastAutoTable.finalY + 8;

    const ensureSpace = (h) => { if (y + h > CONTENT_MAX_Y) { doc.addPage(); y = PAGE_TOP; } };

    // Payment terms
    ensureSpace(14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Payment Terms:', M, y);
    doc.setFont('helvetica', 'normal');
    const ptLines = doc.splitTextToSize(T(paymentTerms), W - M * 2 - 30);
    doc.text(ptLines, M + 30, y);
    y += ptLines.length * 4.6 + 3;

    // Notes & instructions — written line by line so a long note flows onto the next page instead of overflowing
    const sections = [
      ['Notes', docData.notes], ['Special Instructions', docData.specialInstructions],
      ['Creative Requirements', docData.creativeRequirements], ['Billing Instructions', docData.billingInstructions],
    ].filter(([, text]) => text && text.trim());
    for (const [label, text] of sections) {
      const lines = doc.splitTextToSize(T(text.trim()), W - M * 2);
      ensureSpace(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);
      doc.text(`${label}:`, M, y);
      y += 4.8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      for (const line of lines) {
        ensureSpace(4.6);
        doc.text(line, M, y);
        y += 4.4;
      }
      y += 4;
    }

    // Sign-off: publisher acceptance (left) and agency signatory (right). Kept compact so a standard order fits on one page.
    ensureSpace(30);
    y += 1;
    const signTop = y;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Accepted by publisher', M, y);
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.line(M, y + 15, M + 62, y + 15);
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text('Name, signature and stamp', M, y + 19);
    doc.line(M + 72, y + 15, M + 100, y + 15);
    doc.text('Date', M + 72, y + 19);

    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text('Regards,', W - M, signTop, { align: 'right' });
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.circle(W - M - 12, signTop + 10, 6.5, 'S');
    doc.setFontSize(8.5);
    doc.text('Authorised Signatory', W - M, signTop + 21, { align: 'right' });
    const approved = [...(docData.statusHistory || [])].reverse().find((h) => h.to === 'Approved' && h.by && h.by.id !== 'system-upgrade');
    if (approved) {
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 110);
      doc.text(T(`Approved by ${approved.by.name} on ${fmtDate(approved.at)}`), W - M, signTop + 26, { align: 'right' });
    }

    // Footers, running header on later pages, and the watermark
    const pages = doc.getNumberOfPages();
    const mark = WATERMARK[docData.status];
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      if (p > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(T(`${typeInfo.pdfTitle} ${docData.documentNumber}  |  ${client.name || ''}  |  continued`), M, 14);
        doc.setDrawColor(220, 220, 220);
        doc.line(M, 17, W - M, 17);
      }
      drawFooter(doc, org, docData, p, pages);
      if (mark) drawWatermark(doc, mark);
    }
    return doc;
  }

  const generators = { RO: buildOrderPdf, PO: buildOrderPdf, IO: buildOrderPdf };

  return {
    supports: (type) => !!generators[type],
    safeText: safe,

    /** Build the jsPDF document for a stored document (uses its publisher and agency snapshots). */
    async build(docData) {
      const gen = generators[docData.documentType];
      if (!gen) throw new Error(`PDF generation for ${docData.documentType} is not available.`);
      const settings = await settingsService.get();
      let publisher = docData.publisherSnapshot;
      if (!publisher) {
        const live = await publisherService.get(docData.publisherId);
        if (!live) throw new Error('Publisher details are unavailable for this document.');
        publisher = snapshotPublisher(live);
      }
      const org = docData.agencySnapshot || settings.organization; // documents created before snapshots existed use the current agency details
      return gen(docData, { publisher, org, settings });
    },

    /** Generate + download the PDF, and record the download in the activity log. */
    async download(docData) {
      const pdf = await this.build(docData);
      pdf.save(`${docData.documentNumber}.pdf`);
      await documentService.logDownload(docData.id);
    },
  };
})();
