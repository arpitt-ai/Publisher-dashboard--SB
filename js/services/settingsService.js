/* settingsService — organization details (used on the PDF), defaults, numbering format and workflow. */
const DEFAULT_SETTINGS = {
  organization: {
    name: 'Diginfluenz Pvt Ltd',
    footerName: 'DIGINFLUENZ PRIVATE LIMITED',
    address: '6th Floor, 326, Fountain Plaza, Pantheon Road Egmore, Chennai, Tamil Nadu, 600008',
    footerAddress: '326, Fountain Plaza, 6th Floor, Pantheon Road, Egmore, Chennai-600008',
    gstin: '33AAHCD7973M1Z2',
    cin: 'U72900TN2020PTC136008',
    contactPerson: 'Arputharaj',
    email: 'ap@socialbeat.in',
    accountsEmail: 'accounts@socialbeat.in',
    website: 'www.socialbeat.in',
    cities: 'BANGALORE  |  CHENNAI  |  GURUGRAM  |  MUMBAI',
  },
  defaults: {
    gstPercent: 18,
    documentStatus: 'Draft',
    paymentTerms: '100% at Invoice Date + 60 Days',
  },
  workflow: {
    requireApproval: true, // off = a Draft can be approved straight away, without a separate approver
  },
  numbering: { ...DEFAULT_NUMBERING },
};

const settingsService = {
  async get() {
    return withDefaults(storageService.get(COLLECTIONS.settings, {}), DEFAULT_SETTINGS);
  },
  async update(next) {
    assertCan('settings.edit', 'change settings');
    const merged = withDefaults(next, DEFAULT_SETTINGS);
    storageService.set(COLLECTIONS.settings, merged);
    await auditService.log({ action: 'SETTINGS_UPDATED', entityType: 'settings', entityLabel: 'Settings', summary: 'Updated settings' });
    return merged;
  },
  async reset() {
    assertCan('settings.edit', 'change settings');
    storageService.remove(COLLECTIONS.settings);
    return clone(DEFAULT_SETTINGS);
  },
};
