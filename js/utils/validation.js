/* Validation. Each validate* function returns an object of errors keyed by
   field path (e.g. 'address.line1'); an empty object means valid.
   Messages are written for non-technical users: say what to do, not what is wrong with the data. */

const RX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  gstin: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  cin: /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/,
  tan: /^[A-Z]{4}\d{5}[A-Z]$/,
  pin: /^[1-9]\d{5}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  udyam: /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/,
  website: /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i,
  account: /^\d{9,18}$/,
};

const norm = (s) => (s == null ? '' : String(s).trim());
const upper = (s) => norm(s).toUpperCase();

const isValidPhone = (s) => /^\+?\d{10,13}$/.test(norm(s).replace(/[\s\-().]/g, ''));
const isValidISODate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && y >= 2000 && y <= 2100;
};
const isNumeric = (v) => v !== '' && v != null && Number.isFinite(Number(String(v).replace(/,/g, '')));

const MAX_QUANTITY = 1e12;
const MAX_AMOUNT = 1e11;

/* Only four things are needed to add a publisher. Everything else is checked only when it is filled in. */
function validatePublisher(p) {
  const e = {};
  const req = (path, label, value) => { if (!norm(value)) e[path] = `Please enter ${label}`; };

  req('publisherName', 'the publisher name', p.publisherName);
  req('legalEntityName', 'the legal company name', p.legalEntityName);
  req('contactPerson', 'a contact person', p.contactPerson);

  if (!norm(p.email)) e.email = 'Please enter an email address';
  else if (!RX.email.test(norm(p.email))) e.email = 'This email address does not look right. Example: name@company.com';

  if (norm(p.phone) && !isValidPhone(p.phone)) e.phone = 'Enter a phone number with 10 to 13 digits';
  if (norm(p.alternatePhone) && !isValidPhone(p.alternatePhone)) e.alternatePhone = 'Enter a phone number with 10 to 13 digits';
  if (norm(p.website) && !RX.website.test(norm(p.website))) e.website = 'Enter a website like www.example.com';

  (p.additionalContacts || []).forEach((c, i) => {
    if (norm(c.email) && !RX.email.test(norm(c.email))) e[`additionalContacts.${i}.email`] = 'This email address does not look right';
    if (norm(c.phone) && !isValidPhone(c.phone)) e[`additionalContacts.${i}.phone`] = 'Enter a phone number with 10 to 13 digits';
    if ((norm(c.email) || norm(c.phone) || norm(c.designation)) && !norm(c.name)) e[`additionalContacts.${i}.name`] = 'Please enter this contact’s name';
  });

  const checkAddress = (a = {}, prefix) => {
    if (norm(a.pinCode) && !RX.pin.test(norm(a.pinCode))) e[`${prefix}.pinCode`] = 'PIN code must be 6 digits';
  };
  checkAddress(p.address, 'address');
  if (!p.billingAddress?.sameAsRegistered) checkAddress(p.billingAddress, 'billingAddress');

  const t = p.tax || {};
  if (norm(t.gstin) && !RX.gstin.test(upper(t.gstin))) e['tax.gstin'] = 'This GSTIN does not look right. It has 15 characters, e.g. 27AAACC1206D1ZM';
  if (norm(t.pan) && !RX.pan.test(upper(t.pan))) e['tax.pan'] = 'This PAN does not look right. It has 10 characters, e.g. AAACC1206D';
  if (norm(t.cin) && !RX.cin.test(upper(t.cin))) e['tax.cin'] = 'This CIN does not look right. It has 21 characters';
  if (norm(t.tan) && !RX.tan.test(upper(t.tan))) e['tax.tan'] = 'This TAN does not look right. Example: BLRA12345B';

  const m = p.msme || {};
  if (m.registered && !norm(m.registrationNumber)) e['msme.registrationNumber'] = 'Please enter the Udyam number for an MSME-registered publisher';
  else if (norm(m.registrationNumber) && !RX.udyam.test(upper(m.registrationNumber))) e['msme.registrationNumber'] = 'Use the format UDYAM-XX-00-0000000';

  const c = p.commercial || {};
  if (norm(c.agreedRate) && (!isNumeric(c.agreedRate) || toNum(c.agreedRate) < 0)) e['commercial.agreedRate'] = 'Enter a rate of 0 or more';
  if (norm(c.gstPercent) && (!isNumeric(c.gstPercent) || toNum(c.gstPercent) < 0 || toNum(c.gstPercent) > 100)) e['commercial.gstPercent'] = 'GST must be between 0 and 100';

  const b = p.banking || {};
  if (norm(b.ifsc) && !RX.ifsc.test(upper(b.ifsc))) e['banking.ifsc'] = 'This IFSC does not look right. Example: HDFC0001234';
  if (norm(b.accountNumber) && !RX.account.test(norm(b.accountNumber))) e['banking.accountNumber'] = 'Account number must be 9 to 18 digits';

  return e;
}

/** What a publisher record is still missing for printing a proper document (a gentle reminder, not an error). */
function publisherGaps(p) {
  const gaps = [];
  if (!norm(p.address?.line1) && !norm(p.address?.city)) gaps.push('registered address');
  if (!norm(p.tax?.gstin)) gaps.push('GSTIN');
  return gaps;
}

/**
 * Checks an order.
 *  - default (draft): only what is needed to save — a publisher and a campaign — plus anything typed that is wrong.
 *  - full: everything needed before the order can be submitted.
 */
function validateDocument(d, { full = false } = {}) {
  const e = {};
  if (!d.publisherId) e.publisherId = 'Please choose a publisher';

  const cp = d.campaign || {};
  const c = d.client || {};
  if (!norm(c.name)) e['client.name'] = 'Please choose the client this order is for';
  if (full && !norm(cp.name)) e['campaign.name'] = 'Please enter the campaign name'; // printed on the document
  if (norm(c.gstin) && !RX.gstin.test(upper(c.gstin))) e['client.gstin'] = 'This client GSTIN does not look right. It has 15 characters';

  if (full || cp.startDate || cp.endDate) {
    // The start can be any date (past, today or future). The end just cannot come before the start.
    if (!cp.startDate) e['campaign.startDate'] = 'Please choose a start date';
    else if (!isValidISODate(cp.startDate)) e['campaign.startDate'] = 'This date is not valid';
    if (!cp.endDate) e['campaign.endDate'] = 'Please choose an end date';
    else if (!isValidISODate(cp.endDate)) e['campaign.endDate'] = 'This date is not valid';
    else if (isValidISODate(cp.startDate) && cp.endDate < cp.startDate) e['campaign.endDate'] = 'The end date cannot be before the start date';
  }

  const cm = d.commercial || {};
  const model = PRICING_BY_CODE[cm.pricingModel];
  if (!model) e['commercial.pricingModel'] = 'Please choose a pricing model';

  const num = (path, v, label, { min = 0, max, required = false, positive = false } = {}) => {
    if (!norm(v)) { if (required) e[path] = `Please enter ${label}`; return; }
    if (!isNumeric(v)) { e[path] = `${label[0].toUpperCase() + label.slice(1)} must be a number`; return; }
    const n = toNum(v);
    if (n < min) e[path] = `${label[0].toUpperCase() + label.slice(1)} cannot be negative`;
    else if (positive && n <= 0) e[path] = `${label[0].toUpperCase() + label.slice(1)} must be more than 0`;
    else if (max != null && n > max) e[path] = `${label[0].toUpperCase() + label.slice(1)} is too large`;
  };

  // Rate: needed to price the order (not for "Other", where the amount is typed in).
  const needsRate = model && model.code !== 'Other';
  num('commercial.rate', cm.rate, model && model.code === 'Fixed' ? 'the agreed amount' : 'the rate', { required: full && needsRate, positive: needsRate, max: MAX_AMOUNT });
  if (model && model.needsQty) num('commercial.quantity', cm.quantity, `the number of ${model.qtyLabel.toLowerCase()}`, { required: full, positive: true, max: MAX_QUANTITY });
  else num('commercial.quantity', cm.quantity, 'the quantity', { max: MAX_QUANTITY });

  if (model && !model.auto || cm.spendOverride) num('commercial.estimatedSpend', cm.estimatedSpend, model && model.needsQty ? 'the budget' : 'the amount', { required: full, positive: true, max: MAX_AMOUNT });

  const dv = toNum(cm.discountValue);
  num('commercial.discountValue', cm.discountValue, 'the discount', { max: cm.discountType === 'percent' ? 100 : MAX_AMOUNT });
  num('commercial.otherCharges', cm.otherCharges, 'other charges', { max: MAX_AMOUNT });
  if (!e['commercial.discountValue'] && dv > 0) {
    const calc = computeCommercial(cm);
    if (calc.discountTooBig) e['commercial.discountValue'] = 'The discount cannot be more than the subtotal';
  }
  if (!isNumeric(cm.gstPercent) || toNum(cm.gstPercent) < 0 || toNum(cm.gstPercent) > 100) e['commercial.gstPercent'] = 'GST must be between 0 and 100';

  if (full && !norm(d.paymentTerms)) e.paymentTerms = 'Please enter the payment terms';
  if (!isValidISODate(d.issueDate)) e.issueDate = 'Please choose a valid issue date';

  const dl = d.deliverables || {};
  ['impressions', 'clicks', 'leads'].forEach((k) => num(`deliverables.${k}`, dl[k], `the number of ${k}`, { max: MAX_QUANTITY }));

  return e;
}

/** Which wizard step each error belongs to (used to jump to the right place). */
const DOCUMENT_STEP_FIELDS = {
  campaign: (k) => k === 'publisherId' || k === 'campaignId' || k.startsWith('client.') || k === 'campaign.name' || k === 'documentType',
  deliverables: (k) => ['campaign.startDate', 'campaign.endDate', 'commercial.pricingModel', 'commercial.quantity', 'commercial.rate', 'commercial.estimatedSpend'].includes(k) || k.startsWith('deliverables.'),
  commercials: (k) => (k.startsWith('commercial.') && !['commercial.pricingModel', 'commercial.quantity', 'commercial.rate', 'commercial.estimatedSpend'].includes(k)) || k === 'issueDate' || k === 'paymentTerms',
};

function validateCampaign(c) {
  const e = {};
  if (!norm(c.name)) e.name = 'Please enter the campaign name';
  if (!norm(c.client)) e.client = 'Please enter the client or advertiser';
  if (norm(c.startDate) && !isValidISODate(c.startDate)) e.startDate = 'This date is not valid';
  if (norm(c.endDate) && !isValidISODate(c.endDate)) e.endDate = 'This date is not valid';
  if (!e.startDate && !e.endDate && c.startDate && c.endDate && c.endDate < c.startDate) e.endDate = 'The end date cannot be before the start date';
  if (norm(c.budget) && (!isNumeric(c.budget) || toNum(c.budget) < 0)) e.budget = 'Enter a budget of 0 or more';
  if (norm(c.clientDetails?.gstin) && !RX.gstin.test(upper(c.clientDetails.gstin))) e['clientDetails.gstin'] = 'This GSTIN does not look right. It has 15 characters';
  return e;
}

function validateSettings(s) {
  const e = {};
  if (!norm(s.organization.name)) e['organization.name'] = 'Please enter your agency name';
  const g = toNum(s.defaults.gstPercent);
  if (!isNumeric(s.defaults.gstPercent) || g < 0 || g > 100) e['defaults.gstPercent'] = 'GST must be between 0 and 100';
  const pat = s.numbering.pattern || '';
  if (!pat.includes('{SEQ}')) e['numbering.pattern'] = 'The format must include {SEQ}';
  else if (pat.replace(/\{(TYPE|YEAR|SEQ)\}/g, '').match(/[{}]/)) e['numbering.pattern'] = 'Only {TYPE}, {YEAR} and {SEQ} can be used';
  const pad = Number(s.numbering.padding);
  if (!Number.isInteger(pad) || pad < 1 || pad > 8) e['numbering.padding'] = 'Use a number from 1 to 8';
  return e;
}

/** Trim + canonicalise a publisher before it is stored (uppercase IDs, lowercase email). */
function normalizePublisher(p) {
  const s = (v) => norm(v);
  const addr = (a = {}) => ({
    line1: s(a.line1), line2: s(a.line2), city: s(a.city), state: s(a.state), pinCode: s(a.pinCode), country: s(a.country) || 'India',
  });
  return {
    ...p,
    publisherName: s(p.publisherName), legalEntityName: s(p.legalEntityName), companyType: s(p.companyType), vendorCategory: s(p.vendorCategory),
    contactPerson: s(p.contactPerson), designation: s(p.designation), email: s(p.email).toLowerCase(),
    phone: s(p.phone), alternatePhone: s(p.alternatePhone), website: s(p.website),
    additionalContacts: (p.additionalContacts || [])
      .map((c) => ({ name: s(c.name), designation: s(c.designation), email: s(c.email).toLowerCase(), phone: s(c.phone) }))
      .filter((c) => c.name || c.email || c.phone),
    address: addr(p.address),
    billingAddress: { sameAsRegistered: p.billingAddress?.sameAsRegistered !== false, ...addr(p.billingAddress) },
    tax: { gstin: upper(p.tax.gstin), pan: upper(p.tax.pan), cin: upper(p.tax.cin), tan: upper(p.tax.tan) },
    msme: { registered: !!p.msme.registered, registrationNumber: upper(p.msme.registrationNumber) },
    commercial: {
      pricingModel: s(p.commercial?.pricingModel), agreedRate: s(p.commercial?.agreedRate), rateNotes: s(p.commercial?.rateNotes),
      paymentTerms: s(p.commercial?.paymentTerms), gstPercent: s(p.commercial?.gstPercent), taxTreatment: s(p.commercial?.taxTreatment) || 'auto',
    },
    banking: {
      bankName: s(p.banking.bankName), accountName: s(p.banking.accountName), accountNumber: s(p.banking.accountNumber),
      ifsc: upper(p.banking.ifsc), branch: s(p.banking.branch),
    },
  };
}
