/* Static reference data and registries. */

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman & Nicobar Islands', 'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu', 'Delhi',
  'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const COMPANY_TYPES = [
  'Private Limited', 'Public Limited', 'LLP', 'Partnership', 'Sole Proprietorship', 'OPC',
  'Government / PSU', 'Trust / Society', 'Other',
];

const PUBLISHER_STATUSES = ['Active', 'Inactive', 'Pending Verification'];

/* Document lifecycle. The allowed moves between these live in utils/workflow.js. */
const DOCUMENT_STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Sent', 'Acknowledged', 'Completed', 'Rejected', 'Cancelled'];
/* Statuses from earlier versions of the app, mapped once during migration. */
const LEGACY_STATUS_MAP = { Generated: 'Approved' };
/* Documents in these statuses count as "booked" in totals and reports. */
const BOOKED_STATUSES = ['Approved', 'Sent', 'Acknowledged', 'Completed'];

const CAMPAIGN_STATUSES = ['Planned', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
const VENDOR_CATEGORIES = ['Publisher', 'Ad Network', 'Social / Creator', 'Platform', 'Agency', 'Other'];
const TAX_TREATMENTS = [
  { value: 'auto', label: 'Automatic (based on state)' },
  { value: 'intra', label: 'Same state: CGST + SGST' },
  { value: 'inter', label: 'Different state: IGST' },
  { value: 'none', label: 'No GST (exempt / zero-rated)' },
];

/* Pricing models. `calc(rate, qty)` returns the estimated spend.
   `auto` = spend can be derived from rate × quantity.
   `billable` = which deliverable the quantity measures (null when the quantity is not billed). */
const PRICING_MODELS = [
  { code: 'CPM', label: 'CPM', hint: 'Cost per 1,000 impressions', qtyLabel: 'Impressions', billable: 'impressions', rateLabel: 'Rate (per 1,000 impressions)', auto: true, needsQty: true, calc: (r, q) => (r * q) / 1000 },
  { code: 'CPC', label: 'CPC', hint: 'Cost per click', qtyLabel: 'Clicks', billable: 'clicks', rateLabel: 'Rate (per click)', auto: true, needsQty: true, calc: (r, q) => r * q },
  { code: 'CPL', label: 'CPL', hint: 'Cost per lead', qtyLabel: 'Leads', billable: 'leads', rateLabel: 'Rate (per lead)', auto: true, needsQty: true, calc: (r, q) => r * q },
  { code: 'CPA', label: 'CPA', hint: 'Cost per action or conversion', qtyLabel: 'Actions / Conversions', billable: 'actions', rateLabel: 'Rate (per action)', auto: true, needsQty: true, calc: (r, q) => r * q },
  { code: 'Fixed', label: 'Fixed fee', hint: 'One agreed amount', qtyLabel: 'Quantity', billable: null, rateLabel: 'Agreed amount', auto: true, needsQty: false, calc: (r) => r },
  { code: 'Other', label: 'Other', hint: 'Enter the amount yourself', qtyLabel: 'Quantity', billable: null, rateLabel: 'Rate', auto: false, needsQty: false, calc: () => 0 },
];
const PRICING_BY_CODE = Object.fromEntries(PRICING_MODELS.map((m) => [m.code, m]));

const GST_SLABS = [0, 5, 12, 18, 28];

/* GST state codes (first two digits of a GSTIN). Used to decide CGST+SGST vs IGST. */
const GST_STATE_CODES = {
  'Jammu & Kashmir': '01', 'Himachal Pradesh': '02', 'Punjab': '03', 'Chandigarh': '04', 'Uttarakhand': '05', 'Haryana': '06',
  'Delhi': '07', 'Rajasthan': '08', 'Uttar Pradesh': '09', 'Bihar': '10', 'Sikkim': '11', 'Arunachal Pradesh': '12',
  'Nagaland': '13', 'Manipur': '14', 'Mizoram': '15', 'Tripura': '16', 'Meghalaya': '17', 'Assam': '18', 'West Bengal': '19',
  'Jharkhand': '20', 'Odisha': '21', 'Chhattisgarh': '22', 'Madhya Pradesh': '23', 'Gujarat': '24',
  'Dadra & Nagar Haveli and Daman & Diu': '26', 'Maharashtra': '27', 'Karnataka': '29', 'Goa': '30', 'Lakshadweep': '31',
  'Kerala': '32', 'Tamil Nadu': '33', 'Puducherry': '34', 'Andaman & Nicobar Islands': '35', 'Telangana': '36',
  'Andhra Pradesh': '37', 'Ladakh': '38',
};
const GST_STATE_BY_CODE = Object.fromEntries(Object.entries(GST_STATE_CODES).map(([n, c]) => [c, n]));
const CAMPAIGN_TYPES = ['Awareness', 'Performance', 'Lead Generation', 'App Install', 'Brand Launch', 'Retargeting', 'Sponsored Content', 'Other'];
const PLATFORMS = ['Meta', 'Google', 'Programmatic', 'Direct', 'LinkedIn', 'YouTube', 'Twitter/X', 'OTT', 'CTV', 'Podcast', 'Other'];
const AD_FORMATS = ['Display Banner', 'Video Pre-roll', 'Video Mid-roll', 'Native Article', 'Mobile Interstitial', 'Rich Media', 'Carousel', 'Stories', 'Sponsored Post', 'Newsletter', 'Podcast Ad', 'Other'];

/* Compliance document slots. `single` slots hold one file (uploading again replaces it). */
const COMPLIANCE_TYPES = [
  { code: 'MSME', label: 'MSME / Udyam Certificate', short: 'MSME Certificate', single: true },
  { code: 'GST', label: 'GST Certificate', short: 'GST Certificate', single: true },
  { code: 'PAN', label: 'PAN', short: 'PAN', single: true },
  { code: 'BANK_PROOF', label: 'Cancelled Cheque / Bank Proof', short: 'Bank Proof', single: true },
  { code: 'VENDOR_AGREEMENT', label: 'Vendor Agreement', short: 'Vendor Agreement', single: true },
  { code: 'INCORPORATION', label: 'Incorporation Certificate', short: 'Incorporation Certificate', single: true },
  { code: 'OTHER', label: 'Other Supporting Documents', short: 'Supporting Document', single: false },
];
const COMPLIANCE_BY_CODE = Object.fromEntries(COMPLIANCE_TYPES.map((t) => [t.code, t]));

/* Document types. `intro` is the opening sentence printed on the PDF (the same wording is used in the preview). */
const DOCUMENT_TYPES = {
  RO: {
    code: 'RO', label: 'Release Order', plural: 'Release Orders', description: 'Ask a publisher to run a campaign.', enabled: true, pdfTitle: 'Request Order',
    intro: 'This is to acknowledge the discussion about the campaign services. We would like to use the services for the following details with a total spend of {total}, including tax.',
  },
  PO: {
    code: 'PO', label: 'Purchase Order', plural: 'Purchase Orders', description: 'Buy services or inventory from a vendor.', enabled: true, pdfTitle: 'Purchase Order',
    intro: 'We are pleased to place this purchase order for the services below, with a total value of {total}, including tax.',
  },
  IO: {
    code: 'IO', label: 'Insertion Order', plural: 'Insertion Orders', description: 'Book ad placements with a publisher.', enabled: true, pdfTitle: 'Insertion Order',
    intro: 'Please run the advertisement placements below as per the agreed details, with a total value of {total}, including tax.',
  },
};
const DOCUMENT_TYPE_LIST = Object.values(DOCUMENT_TYPES);

/* Audit actions. */
const AUDIT_ACTIONS = {
  PUBLISHER_CREATED: { label: 'Publisher created', entity: 'publisher' },
  PUBLISHER_UPDATED: { label: 'Publisher updated', entity: 'publisher' },
  PUBLISHER_DEACTIVATED: { label: 'Publisher deactivated', entity: 'publisher' },
  PUBLISHER_REACTIVATED: { label: 'Publisher reactivated', entity: 'publisher' },
  DOCUMENT_CREATED: { label: 'Document created', entity: 'document' },
  DOCUMENT_UPDATED: { label: 'Document updated', entity: 'document' },
  DOCUMENT_DUPLICATED: { label: 'Document duplicated', entity: 'document' },
  DOCUMENT_GENERATED: { label: 'Document generated', entity: 'document' },
  DOCUMENT_DOWNLOADED: { label: 'Document downloaded', entity: 'document' },
  DOCUMENT_ARCHIVED: { label: 'Document archived', entity: 'document' },
  DOCUMENT_STATUS_CHANGED: { label: 'Status changed', entity: 'document' },
  CAMPAIGN_CREATED: { label: 'Campaign created', entity: 'campaign' },
  CAMPAIGN_UPDATED: { label: 'Campaign updated', entity: 'campaign' },
  SETTINGS_UPDATED: { label: 'Settings updated', entity: 'settings' },
  FILE_UPLOADED: { label: 'File uploaded', entity: 'publisher' },
  FILE_REPLACED: { label: 'File replaced', entity: 'publisher' },
  FILE_DELETED: { label: 'File deleted', entity: 'publisher' },
};

/* Labels for change tracking (before → after diffs). */
const PUBLISHER_FIELD_LABELS = {
  publisherName: 'Publisher Name', legalEntityName: 'Legal Entity Name', companyType: 'Company Type',
  contactPerson: 'Contact Person', designation: 'Designation', email: 'Email', phone: 'Phone',
  alternatePhone: 'Alternate Phone', website: 'Website',
  'address.line1': 'Address Line 1', 'address.line2': 'Address Line 2', 'address.city': 'City',
  'address.state': 'State', 'address.pinCode': 'PIN Code', 'address.country': 'Country',
  'tax.gstin': 'GSTIN', 'tax.pan': 'PAN', 'tax.cin': 'CIN', 'tax.tan': 'TAN',
  'msme.registered': 'MSME Registered', 'msme.registrationNumber': 'Udyam Number',
  'banking.bankName': 'Bank Name', 'banking.accountName': 'Account Name',
  'banking.accountNumber': 'Account Number', 'banking.ifsc': 'IFSC', 'banking.branch': 'Branch',
  vendorCategory: 'Vendor Category',
  'commercial.pricingModel': 'Default Pricing Model', 'commercial.agreedRate': 'Agreed Rate',
  'commercial.paymentTerms': 'Payment Terms', 'commercial.gstPercent': 'GST %', 'commercial.taxTreatment': 'Tax Treatment',
  status: 'Status',
};
const DOCUMENT_FIELD_LABELS = {
  publisherId: 'Publisher', issueDate: 'Issue Date', campaignId: 'Campaign',
  'client.name': 'Client Name', 'client.legalEntity': 'Client Legal Entity', 'client.address': 'Client Address', 'client.gstin': 'Client GSTIN',
  'campaign.name': 'Campaign Name', 'campaign.startDate': 'Start Date', 'campaign.endDate': 'End Date',
  'campaign.type': 'Campaign Type', 'campaign.platform': 'Platform', 'campaign.adFormat': 'Ad Format',
  'commercial.pricingModel': 'Pricing Model', 'commercial.rate': 'Rate', 'commercial.quantity': 'Quantity',
  'commercial.estimatedSpend': 'Subtotal', 'commercial.gstPercent': 'GST %', 'commercial.totalAmount': 'Total Amount',
  'commercial.discountValue': 'Discount', 'commercial.otherCharges': 'Other Charges', 'commercial.taxTreatment': 'Tax Treatment',
  paymentTerms: 'Payment Terms',
  'deliverables.impressions': 'Impressions', 'deliverables.clicks': 'Clicks', 'deliverables.leads': 'Leads', 'deliverables.other': 'Other Deliverables',
  notes: 'Notes', specialInstructions: 'Special Instructions', creativeRequirements: 'Creative Requirements', billingInstructions: 'Billing Instructions',
};
const CAMPAIGN_FIELD_LABELS = {
  name: 'Campaign Name', client: 'Client', owner: 'Owner', startDate: 'Start Date', endDate: 'End Date',
  budget: 'Budget', status: 'Status', notes: 'Notes',
};
const SENSITIVE_FIELDS = ['banking.accountNumber'];

const FILE_RULES = {
  accept: '.pdf,.jpg,.jpeg,.png',
  mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  maxBytes: 10 * 1024 * 1024,
  label: 'PDF, JPG, JPEG, PNG · up to 10 MB',
};
