/* Automated tests: money maths, numbering, validation, workflow and permissions, migration, reports, PDFs.
   They run the real app code (see index.html) against a throw-away storage area. */

const YEAR = new Date().getFullYear();
const SAME_STATE_GSTIN = '33AAHCD7973M1Z2'; // Tamil Nadu, the same state as the default agency
const OTHER_STATE_GSTIN = '27AAACC1206D1ZM'; // Maharashtra

/* ── builders ── */
const cm = (over = {}) => ({ pricingModel: 'CPM', rate: 30, quantity: 10000000, spendOverride: false, gstPercent: 18, taxTreatment: 'auto', ...over });
const newPub = (over = {}) => publisherService.create({
  ...createEmptyPublisher(), publisherName: 'Alpha', legalEntityName: 'Alpha Media Pvt Ltd', contactPerson: 'Asha', email: 'asha@alpha.com', ...over,
});
const docInput = (publisherId, over = {}) => {
  const base = createEmptyDocument('RO', DEFAULT_SETTINGS);
  return {
    ...base, publisherId,
    client: { name: 'Acme', legalEntity: '', address: '', gstin: '' },
    campaign: { name: 'Launch', startDate: '2026-11-01', endDate: '2026-11-30', type: '', platform: 'Meta', adFormat: '' },
    commercial: { ...base.commercial, pricingModel: 'CPM', rate: 30, quantity: 1000000, gstPercent: 18 },
    ...over,
  };
};
const validForm = (over = {}) => ({
  publisherId: 'p1', campaign: { name: 'Launch', startDate: '2026-11-01', endDate: '2026-11-30' }, client: { name: 'Acme', gstin: '' },
  commercial: { pricingModel: 'CPM', rate: '30', quantity: '1000000', estimatedSpend: '30000', spendOverride: false, discountType: 'percent', discountValue: '', otherCharges: '', gstPercent: '18' },
  deliverables: {}, paymentTerms: '30 days', issueDate: '2026-10-21', ...over,
});
const withCm = (patch) => { const f = validForm(); return { ...f, commercial: { ...f.commercial, ...patch } }; };

/* ═══ Money ═══ */
test('Money › CPM = impressions ÷ 1,000 × rate, plus 18% GST', () => {
  const c = computeCommercial(cm());
  assert.equal(c.subtotal, 300000); assert.equal(c.gstAmount, 54000); assert.equal(c.total, 354000);
});
test('Money › CPC = clicks × rate', () => { const c = computeCommercial(cm({ pricingModel: 'CPC', rate: 2.5, quantity: 80000 })); assert.equal(c.subtotal, 200000); assert.equal(c.total, 236000); });
test('Money › CPL = leads × rate', () => { const c = computeCommercial(cm({ pricingModel: 'CPL', rate: 500, quantity: 500 })); assert.equal(c.subtotal, 250000); assert.equal(c.total, 295000); });
test('Money › Fixed fee = the agreed amount', () => { const c = computeCommercial(cm({ pricingModel: 'Fixed', rate: 500000, quantity: '' })); assert.equal(c.subtotal, 500000); assert.equal(c.total, 590000); });
test('Money › these four match the original sample ROs exactly', () => {
  const expected = { ro1: 354000, ro2: 295000, ro3: 590000, ro4: 236000 };
  buildDemoData().documents.forEach((d) => assert.equal(computeCommercial(d.commercial).total, expected[d.id], d.id));
});
test('Money › rounds to the paisa (CPM 12,34,567 @ ₹17.35)', () => {
  const c = computeCommercial(cm({ rate: 17.35, quantity: 1234567 }));
  assert.equal(c.subtotal, 21419.74); assert.equal(c.gstAmount, 3855.55); assert.equal(c.total, 25275.29);
});
test('Money › exact halves round up (₹0.125 → ₹0.13)', () => { assert.equal(computeCommercial(cm({ pricingModel: 'Other', estimatedSpend: 0.125, gstPercent: 0 })).subtotal, 0.13); });
test('Money › no floating-point drift (3 clicks × ₹0.10 = ₹0.30)', () => { assert.equal(computeCommercial(cm({ pricingModel: 'CPC', rate: 0.1, quantity: 3, gstPercent: 0 })).subtotal, 0.3); });
test('Money › percent discount comes off before GST', () => {
  const c = computeCommercial(cm({ discountType: 'percent', discountValue: 10 }));
  assert.equal(c.discount, 30000); assert.equal(c.taxable, 270000); assert.equal(c.gstAmount, 48600); assert.equal(c.total, 318600);
});
test('Money › fixed-amount discount', () => { const c = computeCommercial(cm({ discountType: 'amount', discountValue: 5000 })); assert.equal(c.taxable, 295000); assert.equal(c.total, 348100); });
test('Money › a discount can never push the price below zero', () => {
  const c = computeCommercial(cm({ discountType: 'amount', discountValue: 400000 }));
  assert.equal(c.discount, 300000); assert.equal(c.total, 0); assert.ok(c.discountTooBig);
});
test('Money › other charges are added before GST', () => { const c = computeCommercial(cm({ otherCharges: 10000 })); assert.equal(c.taxable, 310000); assert.equal(c.gstAmount, 55800); assert.equal(c.total, 365800); });
test('Money › negative discount, charges or rate are ignored, never subtracted', () => {
  const c = computeCommercial(cm({ discountValue: -50, otherCharges: -100 })); assert.equal(c.discount, 0); assert.equal(c.otherCharges, 0); assert.equal(c.total, 354000);
  assert.equal(computeCommercial(cm({ rate: -5, estimatedSpend: '' })).total, 0);
});
test('Money › same state splits GST into CGST + SGST', () => {
  const c = computeCommercial(cm({ taxTreatment: 'intra', discountValue: 10 }));
  assert.equal(c.taxType, 'CGST_SGST'); assert.equal(c.cgst, 24300); assert.equal(c.sgst, 24300); assert.equal(c.gstAmount, 48600); assert.equal(c.taxLines[0].label, 'CGST @ 9%');
});
test('Money › different state charges IGST', () => {
  const c = computeCommercial(cm({ taxTreatment: 'inter' })); assert.equal(c.igst, 54000); assert.equal(c.taxLines.length, 1); assert.equal(c.taxLines[0].label, 'IGST @ 18%');
});
test('Money › "No GST" charges nothing', () => { const c = computeCommercial(cm({ taxTreatment: 'none' })); assert.equal(c.gstAmount, 0); assert.equal(c.total, 300000); });
test('Money › automatic GST type follows the two states', () => {
  assert.equal(computeCommercial(cm(), { agencyCode: '33', partyCode: '33' }).taxType, 'CGST_SGST');
  assert.equal(computeCommercial(cm(), { agencyCode: '33', partyCode: '27' }).taxType, 'IGST');
  assert.equal(computeCommercial(cm(), { agencyCode: '33', partyCode: '' }).taxType, 'GST'); // unknown state: one plain GST line, not a guess
});
test('Money › a saved GST type is kept, so old documents never change', () => {
  assert.equal(computeCommercial(cm({ taxType: 'IGST' }), { agencyCode: '33', partyCode: '33' }).taxType, 'IGST');
});
test('Money › total always equals taxable + GST, even with odd paise', () => {
  ['intra', 'inter'].forEach((t) => {
    const c = computeCommercial(cm({ pricingModel: 'Other', estimatedSpend: 0.05, taxTreatment: t }));
    assert.near(c.total, c.taxable + c.gstAmount, t, 0.00001);
  });
});
test('Money › totalsAreConsistent catches a tampered total', () => {
  const good = { ...cm(), totalAmount: 354000 };
  assert.ok(totalsAreConsistent(good)); assert.ok(!totalsAreConsistent({ ...good, totalAmount: 354001 }));
});
test('Money › GST state codes come from a valid GSTIN or the address state', () => {
  assert.equal(stateCodeFromGstin(OTHER_STATE_GSTIN), '27'); assert.equal(stateCodeFromGstin('nonsense'), '');
  assert.equal(stateCodeFor({ state: 'Tamil Nadu' }), '33'); assert.equal(stateCodeFor({ gstin: OTHER_STATE_GSTIN, state: 'Tamil Nadu' }), '27');
});
test('Money › describePricing reads naturally', () => {
  assert.equal(describePricing(cm(), (n) => `INR ${n}`), `CPM: ${fmtNum(10000000)} impressions × INR 30 per 1,000`);
  assert.equal(describePricing({ pricingModel: 'Fixed' }), 'Fixed fee');
});
test('Money › deliverable lines show the billed quantity and other targets', () => {
  const lines = deliverableLines({ commercial: cm({ pricingModel: 'CPL', quantity: 500 }), deliverables: { clicks: 9000, impressions: '', leads: 999 } });
  assert.deepEqual(lines.map((l) => [l.label, l.billed]), [['Clicks', false], ['Leads', true]]);
  assert.equal(lines[1].value, '500'); // the billed number wins over a typed target
});

/* ═══ Numbering ═══ */
test('Numbering › default format RO-YYYY-001', () => { assert.equal(formatDocumentNumber('RO', 2026, 1), 'RO-2026-001'); });
test('Numbering › custom format and padding', () => { assert.equal(formatDocumentNumber('PO', 2026, 7, { pattern: '{TYPE}/{YEAR}/{SEQ}', padding: 4 }), 'PO/2026/0007'); });
test('Numbering › parses a number back', () => {
  assert.deepEqual(parseDocumentNumber('RO-2026-014'), { type: 'RO', year: 2026, seq: 14 }); assert.equal(parseDocumentNumber('garbage'), null);
});
test('Numbering › numbers are sequential per type and year', async () => {
  const p = await newPub();
  const a = await documentService.create(docInput(p.id)); const b = await documentService.create(docInput(p.id));
  const po = await documentService.create(docInput(p.id, { documentType: 'PO' })); const io = await documentService.create(docInput(p.id, { documentType: 'IO' }));
  assert.equal(a.documentNumber, `RO-${YEAR}-001`); assert.equal(b.documentNumber, `RO-${YEAR}-002`);
  assert.equal(po.documentNumber, `PO-${YEAR}-001`); assert.equal(io.documentNumber, `IO-${YEAR}-001`);
});
test('Numbering › 25 documents created at once all get different numbers', async () => {
  const p = await newPub();
  const docs = await Promise.all(Array.from({ length: 25 }, () => documentService.create(docInput(p.id))));
  assert.equal(new Set(docs.map((d) => d.documentNumber)).size, 25);
});
test('Numbering › editing keeps the same number', async () => {
  const p = await newPub();
  const d = await documentService.create(docInput(p.id));
  const edited = await documentService.update(d.id, { ...d, campaign: { ...d.campaign, name: 'Renamed' }, commercial: { ...d.commercial, rate: 99 } });
  assert.equal(edited.documentNumber, d.documentNumber); assert.equal(edited.id, d.id); assert.equal(edited.numberSeq, d.numberSeq);
  assert.equal((await documentService.create(docInput(p.id))).documentNumber, `RO-${YEAR}-002`); // and the next one carries on
});
test('Numbering › a number is never reused after archiving', async () => {
  const p = await newPub();
  await documentService.create(docInput(p.id)); const b = await documentService.create(docInput(p.id));
  await documentService.archive(b.id);
  assert.equal((await documentService.create(docInput(p.id))).documentNumber, `RO-${YEAR}-003`);
});
test('Numbering › still safe if the counter is lost', async () => {
  const p = await newPub();
  await documentService.create(docInput(p.id)); await documentService.create(docInput(p.id));
  storageService.remove(COLLECTIONS.counters);
  assert.equal((await documentService.create(docInput(p.id))).documentNumber, `RO-${YEAR}-003`);
});
test('Numbering › a duplicate gets its own new number', async () => {
  const p = await newPub();
  const d = await documentService.create(docInput(p.id)); const copy = await documentService.duplicate(d.id);
  assert.ok(copy.documentNumber !== d.documentNumber); assert.equal(copy.status, 'Draft');
});

/* ═══ Validation ═══ */
test('Validation › a publisher needs only four things', () => {
  assert.deepEqual(Object.keys(validatePublisher(createEmptyPublisher())).sort(), ['contactPerson', 'email', 'legalEntityName', 'publisherName']);
  assert.deepEqual(validatePublisher({ ...createEmptyPublisher(), publisherName: 'A', legalEntityName: 'A Ltd', contactPerson: 'B', email: 'b@a.com' }), {});
});
test('Validation › publisher identifiers are checked when entered', () => {
  const base = { ...createEmptyPublisher(), publisherName: 'A', legalEntityName: 'A', contactPerson: 'B', email: 'b@a.com' };
  const bad = validatePublisher({ ...base, phone: '123', tax: { gstin: 'ABC', pan: 'X', cin: '', tan: '' }, address: { ...base.address, pinCode: '12345' }, banking: { ...base.banking, ifsc: 'nope', accountNumber: '12' } });
  ['phone', 'tax.gstin', 'tax.pan', 'address.pinCode', 'banking.ifsc', 'banking.accountNumber'].forEach((k) => assert.ok(bad[k], k));
  const good = validatePublisher({ ...base, phone: '+91 98765 43210', tax: { gstin: OTHER_STATE_GSTIN, pan: 'AAACC1206D', cin: '', tan: '' }, address: { ...base.address, pinCode: '400013' }, banking: { ...base.banking, ifsc: 'hdfc0001234', accountNumber: '123456789012' } });
  assert.deepEqual(good, {});
});
test('Validation › MSME needs its Udyam number', () => {
  const base = { ...createEmptyPublisher(), publisherName: 'A', legalEntityName: 'A', contactPerson: 'B', email: 'b@a.com' };
  assert.ok(validatePublisher({ ...base, msme: { registered: true, registrationNumber: '' } })['msme.registrationNumber']);
  assert.equal(validatePublisher({ ...base, msme: { registered: true, registrationNumber: 'UDYAM-MH-18-0012345' } })['msme.registrationNumber'], undefined);
});
test('Validation › error messages are plain language', () => {
  const e = validatePublisher(createEmptyPublisher());
  assert.equal(e.publisherName, 'Please enter the publisher name'); assert.equal(e.email, 'Please enter an email address');
});
test('Validation › a complete order is valid', () => { assert.deepEqual(validateDocument(validForm(), { full: true }), {}); });
test('Validation › a draft only needs a publisher and a campaign', () => {
  assert.deepEqual(validateDocument({ publisherId: 'p', campaign: { name: 'X' }, client: {}, commercial: { pricingModel: 'CPM', gstPercent: '18' }, issueDate: '2026-10-21' }), {});
  assert.ok(validateDocument(validForm({ publisherId: '' })).publisherId);
  assert.ok(validateDocument(validForm({ campaign: { name: '' } }))['campaign.name']);
});
test('Validation › the end date cannot be before the start date', () => {
  assert.equal(validateDocument(validForm({ campaign: { name: 'X', startDate: '2026-11-10', endDate: '2026-11-01' } }), { full: true })['campaign.endDate'], 'The end date cannot be before the start date');
});
test('Validation › impossible dates are refused', () => {
  assert.ok(validateDocument(validForm({ issueDate: '2026-02-30' })).issueDate);
  assert.ok(validateDocument(validForm({ campaign: { name: 'X', startDate: '2026-13-01', endDate: '2026-14-01' } }), { full: true })['campaign.startDate']);
});
test('Validation › negative or zero quantities and rates are refused', () => {
  assert.ok(validateDocument(withCm({ quantity: '-5' }), { full: true })['commercial.quantity']);
  assert.ok(validateDocument(withCm({ quantity: '0' }), { full: true })['commercial.quantity']);
  assert.ok(validateDocument(withCm({ rate: '0' }), { full: true })['commercial.rate']);
  assert.ok(validateDocument(withCm({ rate: '' }), { full: true })['commercial.rate']);
  assert.ok(validateDocument(withCm({ rate: 'abc' }), { full: true })['commercial.rate']);
});
test('Validation › discount, other charges and GST are bounded', () => {
  assert.ok(validateDocument(withCm({ discountValue: '150' }))['commercial.discountValue']);
  assert.ok(validateDocument(withCm({ discountType: 'amount', discountValue: '400000' }))['commercial.discountValue']); // more than the ₹30,000 subtotal
  assert.ok(validateDocument(withCm({ otherCharges: '-1' }))['commercial.otherCharges']);
  assert.ok(validateDocument(withCm({ gstPercent: '120' }))['commercial.gstPercent']);
});
test('Validation › a manual amount is required for the "Other" pricing model', () => {
  assert.ok(validateDocument(withCm({ pricingModel: 'Other', rate: '', quantity: '', estimatedSpend: '' }), { full: true })['commercial.estimatedSpend']);
});
test('Validation › payment terms are needed before submitting', () => { assert.ok(validateDocument(validForm({ paymentTerms: '' }), { full: true }).paymentTerms); });
test('Validation › campaign rules', () => {
  assert.deepEqual(Object.keys(validateCampaign({ name: '', client: '' })).sort(), ['client', 'name']);
  assert.ok(validateCampaign({ name: 'A', client: 'B', startDate: '2026-02-01', endDate: '2026-01-01' }).endDate);
  assert.ok(validateCampaign({ name: 'A', client: 'B', budget: '-4' }).budget);
  assert.deepEqual(validateCampaign({ name: 'A', client: 'B', startDate: '2026-01-01', endDate: '2026-02-01', budget: '5000' }), {});
});
test('Validation › settings numbering format must contain {SEQ}', () => {
  const s = { organization: { name: 'X' }, defaults: { gstPercent: 18 }, numbering: { pattern: '{TYPE}-{YEAR}', padding: 3 } };
  assert.ok(validateSettings(s)['numbering.pattern']);
  assert.deepEqual(validateSettings({ ...s, numbering: { pattern: '{TYPE}-{YEAR}-{SEQ}', padding: 3 } }), {});
});

/* ═══ Workflow and permissions ═══ */
test('Workflow › allowed and blocked moves', () => {
  assert.ok(findTransition('Draft', 'Pending Approval')); assert.equal(findTransition('Draft', 'Sent'), null);
  assert.equal(findTransition('Draft', 'Approved', { requireApproval: true }), null); assert.ok(findTransition('Draft', 'Approved', { requireApproval: false }));
  assert.equal(findTransition('Completed', 'Draft'), null); assert.equal(findTransition('Cancelled', 'Draft'), null);
  assert.equal(findTransition('Approved', 'Draft'), null);
});
test('Workflow › who sees which buttons', () => {
  const pending = { status: 'Pending Approval' };
  const names = (role) => availableTransitions(pending, { role }).map((t) => t.to).sort().join(',');
  assert.equal(names('Approver'), 'Approved,Rejected'); assert.equal(names('Media Operations'), 'Cancelled,Draft'); assert.equal(names('Read Only'), ''); assert.equal(names('Finance'), '');
});
test('Permissions › Read Only can do nothing that changes data', () => { Object.keys(PERMISSIONS).forEach((a) => assert.ok(!can(a, 'Read Only'), a)); });
test('Permissions › only Admin and Finance may reveal bank details', () => {
  assert.deepEqual(ROLES.filter((r) => can('bank.view', r)), ['Admin', 'Finance']);
});
test('Permissions › only drafts and rejected documents are editable', () => {
  ['Draft', 'Rejected'].forEach((s) => assert.ok(canEditDocument({ status: s }), s));
  ['Pending Approval', 'Approved', 'Sent', 'Acknowledged', 'Completed', 'Cancelled'].forEach((s) => assert.ok(!canEditDocument({ status: s }), s));
  asRole('Read Only'); assert.ok(!canEditDocument({ status: 'Draft' }));
});
test('Workflow › full life of a document, recorded step by step', async () => {
  const p = await newPub();
  const d = await documentService.create(docInput(p.id));
  assert.equal(d.status, 'Draft'); assert.equal(d.statusHistory.length, 1);
  await documentService.setStatus(d.id, 'Pending Approval');
  asRole('Media Operations');
  await assert.rejects(documentService.setStatus(d.id, 'Approved'), /cannot/);
  asRole('Approver');
  await assert.rejects(documentService.setStatus(d.id, 'Rejected'), /reason/);
  const rej = await documentService.setStatus(d.id, 'Rejected', { comment: 'Rate is too high' });
  assert.equal(rej.statusHistory[rej.statusHistory.length - 1].comment, 'Rate is too high');
  asRole('Media Operations');
  await documentService.setStatus(d.id, 'Draft'); await documentService.setStatus(d.id, 'Pending Approval');
  asRole('Approver');
  await documentService.setStatus(d.id, 'Approved');
  asRole('Media Operations');
  await documentService.setStatus(d.id, 'Sent'); await documentService.setStatus(d.id, 'Acknowledged'); const done = await documentService.setStatus(d.id, 'Completed');
  assert.equal(done.status, 'Completed');
  const h = done.statusHistory;
  assert.deepEqual(h.map((x) => x.to), ['Draft', 'Pending Approval', 'Rejected', 'Draft', 'Pending Approval', 'Approved', 'Sent', 'Acknowledged', 'Completed']);
  assert.ok(h.every((x) => x.by && x.by.name && x.at && x.role));
  await assert.rejects(documentService.setStatus(d.id, 'Draft'), /cannot be moved/);
});
test('Workflow › a Sent document cannot go back to Draft', async () => {
  const p = await newPub(); const d = await documentService.create(docInput(p.id));
  await documentService.setStatus(d.id, 'Pending Approval'); await documentService.setStatus(d.id, 'Approved'); await documentService.setStatus(d.id, 'Sent');
  await assert.rejects(documentService.setStatus(d.id, 'Draft'), /cannot be moved/);
});
test('Workflow › an incomplete draft cannot be submitted', async () => {
  const p = await newPub();
  const d = await documentService.create(docInput(p.id, { campaign: { name: 'Launch', startDate: '', endDate: '', type: '', platform: '', adFormat: '' } }));
  await assert.rejects(documentService.setStatus(d.id, 'Pending Approval'), /missing details/);
});
test('Workflow › cancelling records the reason', async () => {
  const p = await newPub(); const d = await documentService.create(docInput(p.id));
  const c = await documentService.setStatus(d.id, 'Cancelled', { comment: 'Client dropped the campaign' });
  assert.equal(c.statusHistory[c.statusHistory.length - 1].comment, 'Client dropped the campaign');
  await assert.rejects(documentService.setStatus(d.id, 'Draft'), /cannot be moved/);
});
test('Workflow › with approval switched off a draft can be approved directly', async () => {
  const settings = await settingsService.get();
  await settingsService.update({ ...settings, workflow: { requireApproval: false } });
  const p = await newPub(); const d = await documentService.create(docInput(p.id));
  assert.equal((await documentService.setStatus(d.id, 'Approved')).status, 'Approved');
  const d2 = await documentService.create(docInput(p.id));
  await assert.rejects(documentService.setStatus(d2.id, 'Pending Approval'), /cannot be moved/);
});
test('Workflow › approved documents are locked against editing', async () => {
  const p = await newPub(); const d = await documentService.create(docInput(p.id));
  await documentService.setStatus(d.id, 'Pending Approval');
  await assert.rejects(documentService.update(d.id, d), /can no longer be edited/);
});
test('Workflow › editing a rejected document returns it to Draft', async () => {
  const p = await newPub(); const d = await documentService.create(docInput(p.id));
  await documentService.setStatus(d.id, 'Pending Approval'); await documentService.setStatus(d.id, 'Rejected', { comment: 'Fix the dates' });
  const fixed = await documentService.update(d.id, d);
  assert.equal(fixed.status, 'Draft'); assert.equal(fixed.documentNumber, d.documentNumber);
});
test('Permissions › services refuse actions the role may not do', async () => {
  const p = await newPub();
  asRole('Read Only');
  await assert.rejects(documentService.create(docInput(p.id)), /cannot/);
  await assert.rejects(newPub({ publisherName: 'Nope' }), /cannot/);
  await assert.rejects(campaignService.create({ name: 'X', client: 'Y' }), /cannot/);
  const s = await settingsService.get();
  await assert.rejects(settingsService.update(s), /cannot/);
  asRole('Finance');
  await assert.rejects(documentService.create(docInput(p.id)), /cannot/);
});
test('Permissions › Finance can update bank details but nothing else', async () => {
  const p = await newPub();
  asRole('Finance');
  const after = await publisherService.update(p.id, { ...p, publisherName: 'HACKED', banking: { ...p.banking, bankName: 'HDFC Bank', accountNumber: '123456789012' } });
  assert.equal(after.publisherName, 'Alpha'); assert.equal(after.banking.bankName, 'HDFC Bank');
});
test('Permissions › Media Operations can edit but not reveal bank details, approve, or change settings', async () => {
  asRole('Media Operations');
  assert.ok(can('bank.edit')); assert.ok(!can('bank.view')); assert.ok(!can('document.approve')); assert.ok(!can('settings.edit'));
});

/* ═══ Publishers and campaigns ═══ */
test('Publishers › duplicate checks: GSTIN, PAN, name, email and bank account', async () => {
  await newPub({ tax: { gstin: OTHER_STATE_GSTIN, pan: 'AAACC1206D', cin: '', tan: '' }, banking: { bankName: 'HDFC', accountName: 'Alpha', accountNumber: '123456789012', ifsc: 'HDFC0001234', branch: '' } });
  const reasons = async (data) => (await publisherService.findDuplicates(data)).flatMap((m) => m.reasons);
  assert.ok((await reasons({ ...createEmptyPublisher(), tax: { gstin: OTHER_STATE_GSTIN, pan: '', cin: '', tan: '' } })).includes('Same GSTIN'));
  assert.ok((await reasons({ ...createEmptyPublisher(), tax: { gstin: '', pan: 'AAACC1206D', cin: '', tan: '' } })).includes('Same PAN'));
  assert.ok((await reasons({ ...createEmptyPublisher(), legalEntityName: 'ALPHA MEDIA PRIVATE LIMITED' })).includes('Same legal company name'));
  assert.ok((await reasons({ ...createEmptyPublisher(), email: 'ASHA@alpha.com' })).includes('Same email'));
  assert.ok((await reasons({ ...createEmptyPublisher(), banking: { ...createEmptyPublisher().banking, accountNumber: '123456789012' } })).includes('Same bank account'));
  assert.equal((await reasons({ ...createEmptyPublisher(), legalEntityName: 'Totally Different', email: 'x@y.com' })).length, 0);
});
test('Publishers › editing a publisher does not flag itself as a duplicate', async () => {
  const p = await newPub({ tax: { gstin: OTHER_STATE_GSTIN, pan: '', cin: '', tan: '' } });
  assert.equal((await publisherService.findDuplicates(p, p.id)).length, 0);
});
test('Publishers › older records without the new fields still load', async () => {
  storageService.set(COLLECTIONS.publishers, [{ id: 'old', publisherName: 'Old', legalEntityName: 'Old Ltd', contactPerson: 'X', email: 'x@o.com', phone: '1', address: { line1: 'a' }, tax: { gstin: '' }, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }]);
  const p = await publisherService.get('old');
  assert.equal(p.billingAddress.sameAsRegistered, true); assert.deepEqual(p.additionalContacts, []); assert.equal(p.commercial.taxTreatment, 'auto'); assert.equal(p.address.country, 'India');
});
test('Publishers › search finds by name, GSTIN and contact', () => {
  const list = buildDemoData().publishers;
  assert.equal(filterPublishers(list, { q: 'bennett' }).length, 1); assert.equal(filterPublishers(list, { q: 'times' }).length, 2); assert.equal(filterPublishers(list, { q: '07AABCH5302R1ZJ' })[0].id, 'pub2');
  assert.equal(filterPublishers(list, { q: 'priya' })[0].id, 'pub2'); assert.equal(filterPublishers(list, { status: 'Pending Verification' })[0].id, 'pub6');
});
test('Campaigns › create, find by name and client, and link publishers once', async () => {
  const c = await campaignService.create({ name: 'Diwali', client: 'Acme', startDate: '2026-11-01', endDate: '2026-11-30' });
  assert.ok(CAMPAIGN_STATUSES.includes(c.status));
  assert.equal((await campaignService.findByNameAndClient('  diwali ', 'ACME')).id, c.id);
  await campaignService.addPublisher(c.id, 'p1'); await campaignService.addPublisher(c.id, 'p1');
  assert.deepEqual((await campaignService.get(c.id)).publisherIds, ['p1']);
  await assert.rejects(campaignService.create({ name: '', client: 'x' }), /campaign name/i);
});
test('Campaigns › a document links its publisher to the campaign and keeps its own copy of the details', async () => {
  const p = await newPub(); const c = await campaignService.create({ name: 'Diwali', client: 'Acme', startDate: '2026-11-01', endDate: '2026-11-30' });
  const d = await documentService.create(docInput(p.id, { campaignId: c.id }));
  assert.deepEqual((await campaignService.get(c.id)).publisherIds, [p.id]);
  await campaignService.update(c.id, { ...c, name: 'Diwali (renamed)', client: 'Acme Ltd' });
  const again = await documentService.get(d.id);
  assert.equal(again.campaign.name, 'Launch'); assert.equal(again.client.name, 'Acme'); // the issued document is unchanged
});

/* ═══ History stays fixed ═══ */
test('History › a document keeps the publisher and agency details it was issued with', async () => {
  const p = await newPub(); const d = await documentService.create(docInput(p.id));
  await publisherService.update(p.id, { ...p, legalEntityName: 'Alpha New Name Ltd' });
  const s = await settingsService.get();
  await settingsService.update({ ...s, organization: { ...s.organization, name: 'A Different Agency' } });
  const again = await documentService.get(d.id);
  assert.equal(again.publisherSnapshot.legalEntityName, 'Alpha Media Pvt Ltd'); assert.equal(again.agencySnapshot.name, 'Diginfluenz Pvt Ltd');
});
test('History › the GST type is fixed when the document is saved', async () => {
  const same = await newPub({ tax: { gstin: SAME_STATE_GSTIN, pan: '', cin: '', tan: '' } });
  const other = await newPub({ publisherName: 'Beta', legalEntityName: 'Beta Ltd', email: 'b@b.com', tax: { gstin: OTHER_STATE_GSTIN, pan: '', cin: '', tan: '' } });
  const a = await documentService.create(docInput(same.id)); const b = await documentService.create(docInput(other.id));
  assert.equal(a.commercial.taxType, 'CGST_SGST'); assert.equal(b.commercial.taxType, 'IGST'); assert.equal(a.commercial.totalAmount, b.commercial.totalAmount);
  assert.ok(totalsAreConsistent(a.commercial) && totalsAreConsistent(b.commercial));
});
test('History › the stored total always matches the numbers', async () => {
  const p = await newPub();
  const d = await documentService.create(docInput(p.id, { commercial: { ...docInput(p.id).commercial, rate: 17.35, quantity: 1234567, discountType: 'percent', discountValue: 7.5, otherCharges: 1234.56, taxTreatment: 'inter' } }));
  assert.ok(totalsAreConsistent(d.commercial));
});

/* ═══ Related documents ═══ */
test('Related › a duplicate is linked both ways, and same-campaign documents find each other', async () => {
  const p = await newPub(); const c = await campaignService.create({ name: 'Diwali', client: 'Acme' });
  const a = await documentService.create(docInput(p.id, { campaignId: c.id }));
  const copy = await documentService.duplicate(a.id);
  const all = await documentService.list();
  const aNow = all.find((d) => d.id === a.id);
  assert.ok(aNow.relatedIds.includes(copy.id) && copy.relatedIds.includes(a.id));
  const io = await documentService.create(docInput(p.id, { documentType: 'IO', campaignId: c.id }));
  const related = relatedDocuments(aNow, await documentService.list());
  assert.ok(related.some((d) => d.id === io.id)); assert.ok(!related.some((d) => d.id === a.id));
});

/* ═══ Upgrading older data ═══ */
const legacyDoc = (id, seq, campaign, client, status = 'Generated') => ({
  id, documentNumber: `RO-2025-00${seq}`, documentType: 'RO', numberYear: 2025, numberSeq: seq, publisherId: 'p1',
  publisherSnapshot: { publisherName: 'Old Pub', legalEntityName: 'Old Pub Ltd', gstin: '', address: { line1: 'x' }, capturedAt: '2025-01-01T00:00:00Z' },
  client: { name: client }, campaign: { name: campaign, startDate: '2025-01-01', endDate: '2025-02-01' },
  commercial: { pricingModel: 'CPC', rate: 2.5, quantity: 80000, estimatedSpend: 200000, spendOverride: false, gstPercent: 18, totalAmount: 236000 },
  status, createdAt: '2025-01-02T00:00:00Z', createdBy: { id: 'u', name: 'U' }, updatedAt: '2025-01-02T00:00:00Z', updatedBy: { id: 'u', name: 'U' }, archived: false,
});
const seedLegacy = () => {
  storageService.set(COLLECTIONS.publishers, [{ id: 'p1', publisherName: 'Old Pub', legalEntityName: 'Old Pub Ltd', contactPerson: 'X', email: 'x@o.com', phone: '9999999999', address: { line1: 'x' }, tax: { gstin: '' }, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }]);
  storageService.set(COLLECTIONS.documents, [legacyDoc('d1', 1, 'App Q4', 'Zomato'), legacyDoc('d2', 2, 'App Q4', 'zomato', 'Sent'), legacyDoc('d3', 3, 'Winter', 'Maruti', 'Draft')]);
  storageService.set(COLLECTIONS.counters, { 'RO-2025': 3 });
};
test('Upgrade › old statuses, history and campaigns are added without losing anything', async () => {
  seedLegacy();
  const before = { pubs: storageService.get(COLLECTIONS.publishers, []), docs: storageService.get(COLLECTIONS.documents, []) };
  const r = migrationService.run();
  assert.ok(r.migrated);
  const docs = await documentService.list();
  assert.equal(docs.length, 3); assert.deepEqual(docs.map((d) => d.status).sort(), ['Approved', 'Draft', 'Sent']);
  assert.deepEqual(docs.map((d) => d.documentNumber).sort(), ['RO-2025-001', 'RO-2025-002', 'RO-2025-003']);
  const d1 = docs.find((d) => d.id === 'd1');
  assert.ok(d1.statusHistory.some((h) => h.from === 'Generated' && h.to === 'Approved'));
  assert.deepEqual(storageService.get(COLLECTIONS.publishers, []), before.pubs); // publishers untouched
  assert.ok(totalsAreConsistent(d1.commercial)); // the old total still adds up under the new maths
  const camps = await campaignService.list();
  assert.equal(camps.length, 2); // "App Q4 / Zomato" and "App Q4 / zomato" are one campaign
  assert.equal(docs.find((d) => d.id === 'd1').campaignId, docs.find((d) => d.id === 'd2').campaignId);
});
test('Upgrade › a stored total that left GST out is corrected to what the PDF always showed', async () => {
  seedLegacy();
  const docs = storageService.get(COLLECTIONS.documents, []);
  docs[0].commercial.totalAmount = 200000; // the old bug: ₹2,00,000 stored, but ₹2,36,000 printed
  storageService.set(COLLECTIONS.documents, docs);
  assert.equal(migrationService.run().totalsRepaired, 1);
  assert.equal((await documentService.get('d1')).commercial.totalAmount, 236000);
  assert.equal(storageService.get(COLLECTIONS.backup, null).documents[0].commercial.totalAmount, 200000); // the backup keeps the original
});
test('Upgrade › the sample records have correct totals from the start', async () => {
  seedService.bootstrap();
  const docs = await documentService.list();
  assert.ok(docs.every((d) => totalsAreConsistent(d.commercial)));
  assert.equal(docs.filter((d) => BOOKED_STATUSES.includes(d.status)).reduce((s, d) => s + d.commercial.totalAmount, 0), 885000);
});
test('Upgrade › an untouched copy of the old records is saved first', () => {
  seedLegacy(); migrationService.run();
  const backup = storageService.get(COLLECTIONS.backup, null);
  assert.ok(backup); assert.equal(backup.documents.length, 3); assert.equal(backup.documents.find((d) => d.id === 'd1').status, 'Generated');
});
test('Upgrade › running it again changes nothing', async () => {
  seedLegacy(); migrationService.run();
  const once = JSON.stringify([storageService.get(COLLECTIONS.documents, []), storageService.get(COLLECTIONS.campaigns, [])]);
  assert.ok(!migrationService.run().migrated); assert.equal(campaignService.linkLegacyDocuments(), 0);
  assert.equal(JSON.stringify([storageService.get(COLLECTIONS.documents, []), storageService.get(COLLECTIONS.campaigns, [])]), once);
});
test('Upgrade › numbering carries on after the old numbers', async () => {
  seedLegacy(); migrationService.run();
  const p = await publisherService.get('p1');
  const d = await documentService.create(docInput(p.id));
  assert.ok(d.documentNumber.startsWith(`RO-${YEAR}-`)); assert.ok(!(await documentService.list()).slice(0, 3).some((x) => x.documentNumber === d.documentNumber));
});
test('Upgrade › first-run start-up with the sample data works and links campaigns', async () => {
  seedService.bootstrap();
  const docs = await documentService.list(); const camps = await campaignService.list();
  assert.equal(docs.length, 4); assert.equal(camps.length, 4); assert.ok(docs.every((d) => d.campaignId));
  assert.equal(storageService.get(COLLECTIONS.meta, null).schemaVersion, 2);
  seedService.bootstrap(); // starting up again must not duplicate or wipe anything
  assert.equal((await documentService.list()).length, 4); assert.equal((await campaignService.list()).length, 4);
});
test('Upgrade › removing sample data also removes its campaigns, and keeps real work', async () => {
  seedService.bootstrap();
  const p = await newPub(); const c = await campaignService.create({ name: 'Mine', client: 'Me' });
  await documentService.create(docInput(p.id, { campaignId: c.id }));
  await seedService.removeSampleData();
  assert.equal((await documentService.list()).length, 1); assert.deepEqual((await campaignService.list()).map((x) => x.name), ['Mine']);
});

/* ═══ Reports, dashboard and CSV ═══ */
const fakeDoc = (id, status, issueDate, amount, over = {}) => ({
  id, documentNumber: `RO-2026-${id}`, documentType: 'RO', status, issueDate, archived: false, campaignId: 'c1', publisherId: 'p1',
  publisherSnapshot: { publisherName: 'Alpha' }, client: { name: 'Acme' }, campaign: { name: 'Launch' },
  commercial: { pricingModel: 'Other', estimatedSpend: amount / 1.18, spendOverride: true, gstPercent: 18, totalAmount: amount },
  createdAt: `${issueDate}T10:00:00.000Z`, updatedAt: `${issueDate}T10:00:00.000Z`, createdBy: { id: 'u', name: 'U' }, updatedBy: { id: 'u', name: 'U' }, statusHistory: [], ...over,
});
const sampleData = () => ({
  publishers: [{ id: 'p1', publisherName: 'Alpha', status: 'Active', createdAt: '2026-01-05T10:00:00.000Z', tax: {}, address: {}, commercial: {} }, { id: 'p2', publisherName: 'Beta', status: 'Inactive', createdAt: '2026-03-05T10:00:00.000Z', tax: {}, address: {}, commercial: {} }],
  campaigns: [{ id: 'c1', name: 'Launch', client: 'Acme', owner: 'Me', status: 'In Progress', startDate: '2026-11-05', endDate: '2026-12-31', budget: 500000, updatedAt: '2026-01-01' },
    { id: 'c2', name: 'Old', client: 'Zed', owner: '', status: 'Completed', startDate: '2026-10-25', endDate: '2026-10-28', budget: '', updatedAt: '2026-01-01' }],
  documents: [fakeDoc('001', 'Approved', '2026-01-15', 118), fakeDoc('002', 'Sent', '2026-01-20', 236), fakeDoc('003', 'Approved', '2026-02-01', 59),
    fakeDoc('004', 'Draft', '2026-01-10', 1000), fakeDoc('005', 'Pending Approval', '2026-02-10', 500, { statusHistory: [{ to: 'Pending Approval', by: { name: 'Sam' }, at: '2026-02-10T10:00:00.000Z' }] }), fakeDoc('006', 'Cancelled', '2026-02-11', 700)],
});
test('Reports › monthly booking value counts only approved and sent documents', () => {
  const r = reportService.build('monthly', sampleData());
  assert.deepEqual(r.rows.map((x) => [x.month, x.count, x.total]), [['2026-01', 2, 354], ['2026-02', 1, 59]]);
  assert.equal(r.totals['Total (incl. tax)'], 413);
});
test('Reports › date filter limits the rows', () => {
  const r = reportService.build('monthly', sampleData(), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(r.rows.map((x) => x.month), ['2026-02']);
});
test('Reports › status matrix counts each status', () => {
  const r = reportService.build('status', sampleData());
  const all = r.rows.find((x) => x.type === 'All');
  assert.equal(all.total, 6); assert.equal(all.byStatus.Approved, 2); assert.equal(all.byStatus.Draft, 1); assert.equal(all.value, 413);
});
test('Reports › pending approvals lists only documents waiting', () => {
  const r = reportService.build('pending', sampleData());
  assert.equal(r.rows.length, 1); assert.equal(r.columns.find((c) => c.header === 'Submitted by').value(r.rows[0]), 'Sam');
});
test('Reports › campaign summary shows booked value per campaign', () => {
  const r = reportService.build('campaigns', sampleData());
  const row = r.rows.find((x) => x.c.id === 'c1');
  assert.equal(row.bookedValue, 413); assert.equal(row.count, 6); assert.equal(row.pendingValue, 500);
});
test('Reports › publisher directory and its date filter', () => {
  assert.equal(reportService.build('publishers', sampleData()).rows.length, 2);
  assert.deepEqual(reportService.build('publishers', sampleData(), { from: '2026-03-01' }).rows.map((p) => p.id), ['p2']);
});
test('Reports › every report builds without errors', () => { REPORTS.forEach((r) => assert.ok(Array.isArray(reportService.build(r.id, sampleData()).rows), r.id)); });
test('Dashboard › every number comes from the records', () => {
  const n = dashboardNumbers(sampleData(), '2026-10-21');
  assert.equal(n.activePublishers, 1); assert.equal(n.campaignsInProgress, 1); assert.equal(n.pending.length, 1); assert.equal(n.bookingValue, 413); assert.equal(n.bookedCount, 3);
  assert.deepEqual(n.upcoming.map((u) => [u.campaign.id, u.kind]), [['c1', 'Starts']]); // the 'Completed' campaign and far-off end dates are left out
  assert.equal(n.recent.length, 6);
});
test('Dashboard › an empty system shows zeros, not errors', () => {
  const n = dashboardNumbers({ publishers: [], campaigns: [], documents: [] }, '2026-10-21');
  assert.equal(n.bookingValue, 0); assert.equal(n.pending.length, 0); assert.equal(n.upcoming.length, 0);
});
test('Search › finds documents by number, publisher or campaign', () => {
  const docs = sampleData().documents;
  assert.equal(filterDocuments(docs, { q: '2026-003' }).length, 1); assert.equal(filterDocuments(docs, { q: 'alpha' }).length, 6); assert.equal(filterDocuments(docs, { q: 'launch', status: 'Draft' }).length, 1);
  assert.equal(filterDocuments(docs, { from: '2026-02-01', to: '2026-02-28' }).length, 3);
});
test('CSV › cells are quoted and formulas defused', () => {
  assert.equal(csvCell('a,b'), '"a,b"'); assert.equal(csvCell('say "hi"'), '"say ""hi"""'); assert.equal(csvCell('two\nlines'), '"two\nlines"');
  assert.equal(csvCell('=SUM(A1:A9)'), "'=SUM(A1:A9)"); assert.equal(csvCell('@cmd'), "'@cmd");
  assert.equal(csvCell(-5), '-5'); assert.equal(csvCell('+91 98765 43210'), '+91 98765 43210'); assert.equal(csvCell(null), '');
});
test('CSV › a report exports the same rows it shows', () => {
  const r = reportService.build('monthly', sampleData());
  const lines = toCsv(r.columns, r.rows).split('\r\n');
  assert.equal(lines[0], 'Month,Documents,Before tax,GST,Total (incl. tax)'); assert.equal(lines.length, 3); assert.ok(lines[1].startsWith('Jan 2026,2,'));
});

/* ═══ PDFs ═══ */
const pdfText = (pdf) => {
  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s.replace(/\\([()\\])/g, '$1'); // PDF text escapes brackets; undo that so we can search it
};
test('PDF › RO, PO and IO each build with their own title', async () => {
  const p = await newPub({ address: { ...createEmptyPublisher().address, line1: '1 Main Rd', city: 'Mumbai', state: 'Maharashtra', pinCode: '400001' } });
  for (const [type, title] of [['RO', 'Request Order'], ['PO', 'Purchase Order'], ['IO', 'Insertion Order']]) {
    const d = await documentService.create(docInput(p.id, { documentType: type }));
    const pdf = await pdfService.build(d);
    assert.ok(pdf.getNumberOfPages() >= 1, type); assert.ok(pdfText(pdf).includes(title), `${type} should contain "${title}"`);
  }
});
test('PDF › long notes flow onto more pages instead of overflowing', async () => {
  const p = await newPub();
  const long = Array.from({ length: 160 }, (_, i) => `Line ${i + 1}: the quick brown fox jumps over the lazy dog.`).join('\n');
  const short = await pdfService.build(await documentService.create(docInput(p.id)));
  const big = await pdfService.build(await documentService.create(docInput(p.id, { notes: long, specialInstructions: long })));
  assert.equal(short.getNumberOfPages(), 1); assert.ok(big.getNumberOfPages() >= 4, `got ${big.getNumberOfPages()} pages`);
});
test('PDF › the commercial breakdown is printed', async () => {
  const p = await newPub({ tax: { gstin: OTHER_STATE_GSTIN, pan: '', cin: '', tan: '' } });
  const d = await documentService.create(docInput(p.id, { commercial: { ...docInput(p.id).commercial, discountType: 'percent', discountValue: 10, otherCharges: 500, otherChargesLabel: 'Ad serving' } }));
  const text = pdfText(await pdfService.build(d));
  ['Taxable value', 'IGST @ 18%', 'Ad serving', 'Discount (10%)', 'Total (including tax)', 'Payment Terms', 'Accepted by publisher'].forEach((w) => assert.ok(text.includes(w), w));
});
test('PDF › documents that are not final are marked', async () => {
  const p = await newPub(); const d = await documentService.create(docInput(p.id));
  assert.ok(pdfText(await pdfService.build(d)).includes('DRAFT'));
  await documentService.setStatus(d.id, 'Pending Approval'); await documentService.setStatus(d.id, 'Approved');
  assert.ok(!pdfText(await pdfService.build(await documentService.get(d.id))).includes('DRAFT'));
});
test('PDF › characters the PDF font cannot print are cleaned up', () => {
  assert.equal(pdfService.safeText('₹5,000 “quote” – dash 😀'), 'INR 5,000 "quote" - dash ');
});
test('PDF › an old document with no snapshots still prints', async () => {
  seedLegacy(); migrationService.run();
  const pdf = await pdfService.build((await documentService.list())[0]);
  assert.ok(pdf.getNumberOfPages() >= 1);
});
