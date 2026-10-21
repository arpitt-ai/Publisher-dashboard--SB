/* ──────────────────────────────────────────────────────────────
   SAMPLE / DEMO DATA — kept separate from user-created data.

   Everything here is flagged `isDemo: true` and attributed to the
   placeholder "Sample Data" actor (not a real user). It comes from the
   original first-draft dashboard. Settings → Data lets you remove or
   restore it at any time without touching real records.
   ────────────────────────────────────────────────────────────── */
function buildDemoData() {
  const stamp = (date, hour = 10) => `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;
  const pan = (gstin) => gstin.slice(2, 12);

  const pub = (id, publisherName, legalEntityName, companyType, gstin, address, contactPerson, email, phone, createdDate, extra = {}) => ({
    id, publisherName, legalEntityName, companyType,
    contactPerson, designation: '', email, phone, alternatePhone: '', website: '',
    address: { line2: '', country: 'India', ...address },
    tax: { gstin, pan: pan(gstin), cin: '', tan: '' },
    msme: { registered: false, registrationNumber: '' },
    banking: { bankName: '', accountName: '', accountNumber: '', ifsc: '', branch: '' },
    complianceDocuments: [],
    status: 'Active',
    createdAt: stamp(createdDate), createdBy: DEMO_ACTOR, updatedAt: stamp(createdDate), updatedBy: DEMO_ACTOR,
    isDemo: true,
    ...extra,
  });

  const publishers = [
    pub('pub1', 'Times Digital', 'Bennett Coleman & Co. Ltd.', 'Public Limited', '27AAACC1206D1ZM',
      { line1: '7th Floor, Times Tower, Kamala Mills Compound', line2: 'Lower Parel', city: 'Mumbai', state: 'Maharashtra', pinCode: '400013' },
      'Rahul Sharma', 'rahul.sharma@timesdigital.com', '+91 98765 43210', '2024-01-15'),
    pub('pub2', 'Hindustan Times Digital', 'HT Media Ltd.', 'Public Limited', '07AABCH5302R1ZJ',
      { line1: 'Hindustan Times House, 18-20 Kasturba Gandhi Marg', city: 'New Delhi', state: 'Delhi', pinCode: '110001' },
      'Priya Mehta', 'priya.mehta@htdigital.in', '+91 87654 32109', '2024-01-20'),
    pub('pub3', 'Network18 Digital', 'Network18 Media & Investments Ltd.', 'Public Limited', '22AABCN3452Q1ZT',
      { line1: '7B, JMD Pacific Square, Sohna Road', city: 'Gurugram', state: 'Haryana', pinCode: '122002' },
      'Arun Kapoor', 'arun.kapoor@network18.com', '+91 76543 21098', '2024-02-05'),
    pub('pub4', 'InMobi', 'InMobi Pte. Ltd. (India Branch)', 'Other', '29AABCI4532M1ZN',
      { line1: '8th Floor, Raheja Towers, 26/27 MG Road', city: 'Bangalore', state: 'Karnataka', pinCode: '560001' },
      'Sneha Reddy', 'sneha.reddy@inmobi.com', '+91 65432 10987', '2024-02-10'),
    pub('pub5', 'Taboola India', 'Taboola.com India Private Ltd.', 'Private Limited', '27AABCT9823K1ZQ',
      { line1: 'Unit 601, 6th Floor, Platina Building', line2: 'G Block, BKC', city: 'Mumbai', state: 'Maharashtra', pinCode: '400051' },
      'Vikram Singh', 'vikram.singh@taboola.com', '+91 54321 09876', '2024-03-01',
      { msme: { registered: true, registrationNumber: 'UDYAM-MH-18-0012345' } }),
    pub('pub6', 'NDTV Digital', 'New Delhi Television Ltd.', 'Public Limited', '07AABCN6310A1ZE',
      { line1: '207, Okhla Industrial Estate Phase III', city: 'New Delhi', state: 'Delhi', pinCode: '110020' },
      'Anjali Rao', 'anjali.rao@ndtvdigital.com', '+91 98123 45678', '2024-03-12',
      { status: 'Pending Verification' }),
  ];
  const pubById = Object.fromEntries(publishers.map((p) => [p.id, p]));

  const doc = (id, seq, publisherId, status, issueDate, clientName, campaign, commercial, notes) => {
    const c = computeCommercial({ ...commercial, gstPercent: 18, spendOverride: false });
    return {
      id, documentNumber: formatDocumentNumber('RO', 2024, seq), documentType: 'RO', numberYear: 2024, numberSeq: seq,
      publisherId,
      publisherSnapshot: { ...snapshotPublisher(pubById[publisherId]), capturedAt: stamp(issueDate, 11) },
      client: { name: clientName, legalEntity: '', address: '', gstin: '' },
      campaign: { type: '', ...campaign },
      commercial: { ...commercial, estimatedSpend: c.spend, spendOverride: false, gstPercent: 18, totalAmount: c.total },
      notes, specialInstructions: '', creativeRequirements: '', billingInstructions: '',
      issueDate, status, archived: false,
      createdAt: stamp(issueDate, 11), createdBy: DEMO_ACTOR, updatedAt: stamp(issueDate, 11), updatedBy: DEMO_ACTOR,
      isDemo: true,
    };
  };

  const documents = [
    doc('ro1', 1, 'pub1', 'Approved', '2024-10-01', 'Amazon India',
      { name: 'Diwali Mega Sale 2024', startDate: '2024-10-15', endDate: '2024-11-05', type: 'Awareness', platform: 'Programmatic', adFormat: 'Display Banner' },
      { pricingModel: 'CPM', rate: 30, quantity: 10000000 },
      'Priority placement on homepage and article pages. Creative assets (300×250, 728×90, 320×50) to be shared 5 working days before campaign start.'),
    doc('ro2', 2, 'pub2', 'Sent', '2024-10-08', 'HDFC Bank',
      { name: 'Festive Finance Boost', startDate: '2024-10-20', endDate: '2024-12-31', type: 'Lead Generation', platform: 'Direct', adFormat: 'Native Article' },
      { pricingModel: 'CPL', rate: 500, quantity: 500 },
      'Native article placements in the Finance section only. Compliance approval required before publishing.'),
    doc('ro3', 3, 'pub3', 'Draft', '2024-12-01', 'Maruti Suzuki',
      { name: 'New Year Auto Drive', startDate: '2024-12-20', endDate: '2025-01-10', type: 'Awareness', platform: 'Google', adFormat: 'Video Pre-roll' },
      { pricingModel: 'Fixed', rate: 500000, quantity: 1 },
      '15s and 30s video assets required. Target: Auto enthusiasts, age 25–45, Tier 1 & 2 cities.'),
    doc('ro4', 4, 'pub4', 'Approved', '2024-10-22', 'Zomato',
      { name: 'App Install Drive Q4', startDate: '2024-11-01', endDate: '2024-11-30', type: 'App Install', platform: 'Meta', adFormat: 'Mobile Interstitial' },
      { pricingModel: 'CPC', rate: 2.5, quantity: 80000 },
      'Android + iOS targeting. Focus on Tier 1 & Tier 2 cities. Daily cap: 500 installs.'),
  ];

  const activity = [
    ...publishers.map((p) => ({
      id: `act_seed_${p.id}`, action: 'PUBLISHER_CREATED', entityType: 'publisher', entityId: p.id, entityLabel: p.publisherName,
      summary: `Onboarded ${p.publisherName}`, detail: p.legalEntityName, changes: null,
      performedBy: DEMO_ACTOR, timestamp: p.createdAt, isDemo: true,
    })),
    ...documents.map((d) => ({
      id: `act_seed_${d.id}`, action: 'DOCUMENT_CREATED', entityType: 'document', entityId: d.id, entityLabel: d.documentNumber,
      summary: `Created ${d.documentNumber}`, detail: `${d.publisherSnapshot.publisherName} → ${d.client.name}`, changes: null,
      performedBy: DEMO_ACTOR, timestamp: d.createdAt, isDemo: true,
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return { publishers, documents, activity, counters: { 'RO-2024': 4 } };
}
