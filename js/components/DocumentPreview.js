/* On-screen preview of a document, laid out like the PDF.
   `doc` may be a saved document or an in-progress form value. `publisher` is a snapshot-style object. */

function DocumentPreview({ doc, publisher, org, paymentTerms, createdBy, createdAt, taxCtx }) {
  const type = DOCUMENT_TYPES[doc.documentType] || DOCUMENT_TYPES.RO;
  const cm = doc.commercial || {};
  const c = computeCommercial(cm, taxCtx || {});
  const model = PRICING_BY_CODE[cm.pricingModel];
  const cp = doc.campaign || {};
  const client = doc.client || {};
  const pub = publisher || {};
  const deliverables = deliverableLines(doc);
  const terms = [
    ['Notes', doc.notes], ['Special Instructions', doc.specialInstructions],
    ['Creative Requirements', doc.creativeRequirements], ['Billing Instructions', doc.billingInstructions],
  ].filter(([, t]) => t && t.trim());
  const empty = (v) => v || html`<span className="paper-blank">—</span>`;

  return html`<article className="paper" aria-label=${`${type.label} preview`}>
    <header className="paper-head">
      <div className="paper-brand"><img className="paper-logo" src=${LOGO_DARK_DATA_URI} alt="Social Beat" /><span>${org.name}</span></div>
      <div className="paper-cities">${org.cities.replace(/\s{2,}/g, ' ')}</div>
    </header>

    <div className="paper-titlebar">
      <div>
        <div className="paper-kicker">Document type</div>
        <div className="paper-doctype">${type.label} <span className="paper-code">${type.code}</span></div>
      </div>
      <div className="paper-idblock">
        <div><span className="paper-label">Number</span><strong className="mono">${doc.documentNumber || 'Assigned on save'}</strong></div>
        <div><span className="paper-label">Date</span><strong>${fmtDate(doc.issueDate)}</strong></div>
        ${doc.status && html`<div><span className="paper-label">Status</span><${StatusBadge} status=${doc.status} /></div>`}
      </div>
    </div>

    <div className="paper-parties">
      <section>
        <h4>Publisher</h4>
        <div className="paper-strong">${empty(pub.legalEntityName || pub.publisherName)}</div>
        ${pub.publisherName && pub.legalEntityName && pub.publisherName !== pub.legalEntityName && html`<div className="paper-muted">Brand: ${pub.publisherName}</div>`}
        <div>${empty(joinAddress(pub.address))}</div>
        <div className="paper-line"><span>GSTIN</span> <span className="mono">${empty(pub.gstin)}</span></div>
        <div className="paper-line"><span>MSME</span> ${pub.msme?.registered ? `Registered${pub.msme.registrationNumber ? ' · ' + pub.msme.registrationNumber : ''}` : 'Not registered'}</div>
        <div className="paper-line"><span>Contact</span> ${empty(pub.contactPerson)}</div>
        <div className="paper-line"><span>Email</span> ${empty(pub.email)}</div>
        <div className="paper-line"><span>Phone</span> ${empty(pub.phone)}</div>
      </section>
      <section>
        <h4>Client</h4>
        <div className="paper-strong">${empty(client.name)}</div>
        ${client.legalEntity && html`<div className="paper-muted">${client.legalEntity}</div>`}
        ${client.address && html`<div>${client.address}</div>`}
        ${client.gstin && html`<div className="paper-line"><span>GSTIN</span> <span className="mono">${client.gstin}</span></div>`}
        <h4 className="paper-h-gap">Agency</h4>
        <div className="paper-strong">${org.name}</div>
        <div className="paper-line"><span>GSTIN</span> <span className="mono">${org.gstin}</span></div>
      </section>
    </div>

    <section className="paper-block">
      <h4>Campaign</h4>
      <div className="paper-grid">
        ${cp.name && html`<div><span className="paper-label">Campaign</span><strong>${cp.name}</strong></div>`}
        <div><span className="paper-label">Duration</span>${cp.startDate || cp.endDate ? `${fmtDate(cp.startDate)} – ${fmtDate(cp.endDate)}` : empty('')}</div>
        ${cp.platform && html`<div><span className="paper-label">Platform</span>${cp.platform}</div>`}
        ${cp.adFormat && html`<div><span className="paper-label">Ad format</span>${cp.adFormat}</div>`}
        <div><span className="paper-label">Pricing</span>${empty(describePricing(cm))}</div>
      </div>
      ${(deliverables.length > 0 || (doc.deliverables && doc.deliverables.other)) && html`<div className="paper-deliver">
        <span className="paper-label">Deliverables</span>
        <ul>${deliverables.map((l) => html`<li key=${l.label}>${l.label}: <strong>${l.value}</strong>${l.billed ? html` <span className="paper-billed">billed</span>` : ''}</li>`)}</ul>
        ${doc.deliverables && doc.deliverables.other && html`<p className="paper-note-text">${doc.deliverables.other}</p>`}
      </div>`}
    </section>

    <section className="paper-block">
      <h4>Cost</h4>
      <table className="paper-table">
        <tbody>
          <tr><td>${model && model.code !== 'Other' && model.code !== 'Fixed' ? 'Subtotal' : 'Amount'}</td><td>${fmtINR(c.subtotal)}</td></tr>
          ${c.discount > 0 && html`<tr><td>Discount${cm.discountType === 'percent' ? ` (${toNum(cm.discountValue)}%)` : ''}</td><td>− ${fmtINR(c.discount)}</td></tr>`}
          ${c.otherCharges > 0 && html`<tr><td>${cm.otherChargesLabel || 'Other charges'}</td><td>${fmtINR(c.otherCharges)}</td></tr>`}
          ${(c.discount > 0 || c.otherCharges > 0) && html`<tr><td>Taxable value</td><td>${fmtINR(c.taxable)}</td></tr>`}
          ${c.taxLines.map((l) => html`<tr key=${l.label}><td>${l.label}</td><td>${fmtINR(l.amount)}</td></tr>`)}
          <tr className="paper-total"><td>Total (including tax)</td><td>${fmtINR(c.total)}</td></tr>
        </tbody>
      </table>
      <p className="paper-terms-line">Payment terms: ${paymentTerms || '—'}</p>
    </section>

    ${terms.length > 0 && html`<section className="paper-block">
      <h4>Notes and instructions</h4>
      ${terms.map(([label, text]) => html`<div key=${label} className="paper-note"><span className="paper-label">${label}</span><p>${text}</p></div>`)}
    </section>`}

    <footer className="paper-foot">
      <div><span className="paper-label">Prepared by</span>${createdBy ? html`<strong>${actorName(createdBy)}</strong>${createdAt ? ` · ${fmtDateTime(createdAt)}` : ''}` : html`<strong>${currentUser.get().name}</strong> · on save`}</div>
      <div className="paper-org">${org.footerName || org.name} · ${org.website}</div>
    </footer>
  </article>`;
}
