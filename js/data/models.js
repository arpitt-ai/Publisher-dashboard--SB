/* Data model factories.

   Publisher  { id, publisherName, legalEntityName, companyType, vendorCategory, contactPerson, designation, email, phone,
                alternatePhone, website, additionalContacts[], address{}, billingAddress{}, tax{}, msme{}, commercial{},
                banking{}, complianceDocuments[], status, createdAt, createdBy, updatedAt, updatedBy }
   Campaign   { id, name, client, clientDetails{}, owner, startDate, endDate, budget, status, publisherIds[], notes,
                createdAt, createdBy, updatedAt, updatedBy }
   Document   { id, documentNumber, documentType, publisherId, publisherSnapshot, agencySnapshot, campaignId, client{},
                campaign{}, deliverables{}, commercial{}, paymentTerms, notes, specialInstructions, creativeRequirements,
                billingInstructions, issueDate, status, statusHistory[], relatedIds[], archived,
                createdAt, createdBy, updatedAt, updatedBy }
   Compliance document { id, type, fileId, fileName, mimeType, size, status, uploadedAt, uploadedBy }

   Records saved by earlier versions are topped up with defaults when they are read (see withDefaults),
   so older data keeps working without being rewritten. */

function createEmptyPublisher() {
  return {
    id: null,
    publisherName: '', legalEntityName: '', companyType: '', vendorCategory: '',
    contactPerson: '', designation: '', email: '', phone: '', alternatePhone: '', website: '',
    additionalContacts: [],
    address: { line1: '', line2: '', city: '', state: '', pinCode: '', country: 'India' },
    billingAddress: { sameAsRegistered: true, line1: '', line2: '', city: '', state: '', pinCode: '', country: 'India' },
    tax: { gstin: '', pan: '', cin: '', tan: '' },
    msme: { registered: false, registrationNumber: '' },
    commercial: { pricingModel: '', agreedRate: '', rateNotes: '', paymentTerms: '', gstPercent: '', taxTreatment: 'auto' },
    banking: { bankName: '', accountName: '', accountNumber: '', ifsc: '', branch: '' },
    complianceDocuments: [],
    status: 'Active',
  };
}

function createEmptyCampaign() {
  return {
    id: null, name: '', client: '', clientDetails: { legalEntity: '', address: '', gstin: '' },
    owner: '', startDate: '', endDate: '', budget: '', status: 'Planned', publisherIds: [], notes: '',
  };
}

/** Planned / In Progress / Completed worked out from the dates (used as the starting status). */
function suggestCampaignStatus(startDate, endDate, today = todayISO()) {
  if (endDate && endDate < today) return 'Completed';
  if (startDate && startDate > today) return 'Planned';
  return startDate ? 'In Progress' : 'Planned';
}

function createEmptyDocument(type, settings) {
  const gst = GST_PERCENT;
  return {
    id: null, documentNumber: null, documentType: type,
    publisherId: '', campaignId: '',
    client: { name: '', legalEntity: '', address: '', gstin: '' },
    campaign: { name: '', startDate: '', endDate: '', type: '', platform: '', adFormat: '' },
    deliverables: { impressions: '', clicks: '', leads: '', other: '' },
    commercial: {
      pricingModel: 'CPM', rate: '', quantity: '', estimatedSpend: '', spendOverride: false,
      discountType: 'percent', discountValue: '', otherCharges: '', otherChargesLabel: '',
      gstPercent: gst, taxTreatment: 'auto', taxType: '', totalAmount: 0,
    },
    paymentTerms: settings?.defaults?.paymentTerms ?? '',
    notes: '', specialInstructions: '', creativeRequirements: '', billingInstructions: '',
    issueDate: todayISO(),
    status: 'Draft', statusHistory: [], relatedIds: [],
    archived: false,
  };
}

/** Deep-merge `record` over `template` so older stored records always have every nested field. */
function withDefaults(record, template) {
  if (Array.isArray(template) || template === null || typeof template !== 'object') return record === undefined ? template : record;
  const out = { ...template };
  for (const k of Object.keys(record || {})) {
    out[k] = k in template && template[k] && typeof template[k] === 'object' && !Array.isArray(template[k])
      ? withDefaults(record[k], template[k])
      : record[k];
  }
  return out;
}

/** Frozen copy of the publisher's legal details, stored on each document so that old
    documents keep showing what was true when they were issued. */
function snapshotPublisher(p) {
  return {
    publisherName: p.publisherName, legalEntityName: p.legalEntityName,
    gstin: p.tax?.gstin || '', address: { ...p.address },
    contactPerson: p.contactPerson, email: p.email, phone: p.phone,
    msme: { registered: !!p.msme?.registered, registrationNumber: p.msme?.registrationNumber || '' },
    capturedAt: nowISO(),
  };
}

/** Same idea for the agency (your own company) details printed on the document. */
function snapshotAgency(org) {
  return { ...org, capturedAt: nowISO() };
}

/** Who is buying from whom decides CGST+SGST vs IGST. Takes a publisher snapshot (or record) and the agency details. */
function taxContext(publisher, org) {
  return {
    agencyCode: stateCodeFor({ gstin: org?.gstin }),
    partyCode: stateCodeFor({ gstin: publisher?.gstin ?? publisher?.tax?.gstin, state: publisher?.address?.state }),
  };
}
