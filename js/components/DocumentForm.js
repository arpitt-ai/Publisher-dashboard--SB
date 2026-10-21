/* Create / edit an RO, PO or IO — a short four-step guide:
     1  Client & publisher     2  Deliverables     3  Commercials     4  Review & create
   Everything typed is kept while you move between steps. A live cost summary stays beside the form. */

const DOC_STEPS = [
  { id: 'campaign', label: 'Client & Publisher' },
  { id: 'deliverables', label: 'Deliverables' },
  { id: 'commercials', label: 'Commercials' },
  { id: 'review', label: 'Review & Create' },
];

const numericText = (v) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
const wholeText = (v) => v.replace(/\D/g, '');

/* Keep derived money fields in sync with rate / quantity / pricing model. */
function recalcCommercial(cm, ctx, { deriveQty = false } = {}) {
  const model = PRICING_BY_CODE[cm.pricingModel];
  const c = computeCommercial({ ...cm, taxType: '' }, ctx);
  const next = { ...cm, taxType: '', totalAmount: c.total };
  if (model && model.auto && !cm.spendOverride) next.estimatedSpend = c.derived ? String(c.subtotal) : '';
  // For CPM / CPC / CPL / CPA the user gives the rate and the budget; the number of units follows from them.
  if (deriveQty && model && model.needsQty) {
    const units = unitsForBudget(model.code, cm.estimatedSpend, cm.rate);
    next.quantity = units > 0 ? String(units) : '';
  }
  return next;
}

/* Saved document -> editable form state (numbers become strings, the GST type is worked out again). */
function toFormDoc(d, ctx) {
  const str = (v) => (v === '' || v == null || (typeof v === 'number' && v === 0) ? '' : String(v));
  const cm = d.commercial || {};
  const dl = d.deliverables || {};
  return {
    ...d,
    deliverables: { impressions: str(dl.impressions), clicks: str(dl.clicks), leads: str(dl.leads), other: dl.other || '' },
    commercial: recalcCommercial({
      ...cm, rate: str(cm.rate), quantity: str(cm.quantity), estimatedSpend: str(cm.estimatedSpend), gstPercent: String(GST_PERCENT),
      discountType: cm.discountType || 'percent', discountValue: str(cm.discountValue), otherCharges: str(cm.otherCharges), otherChargesLabel: cm.otherChargesLabel || '',
      taxTreatment: 'auto', // GST is always 18%; only the CGST+SGST / IGST split follows the two states
      // Rate × budget buys the units, so for these buy types the saved subtotal is treated as the budget.
      spendOverride: PRICING_BY_CODE[cm.pricingModel]?.needsQty ? true : !!cm.spendOverride,
    }, ctx),
  };
}

function Stepper({ steps, current, onGo }) {
  return html`<ol className="stepper" aria-label="Progress">
    ${steps.map((s, i) => {
      const done = i < current;
      return html`<li key=${s.id} className=${'step' + (i === current ? ' is-current' : '') + (done ? ' is-done' : '')}>
        <button type="button" onClick=${() => onGo(i)} aria-current=${i === current ? 'step' : undefined}>
          <span className="step-num">${done ? html`<${Icon} name="check" size=${13} strokeWidth=${2.6} />` : i + 1}</span>
          <span className="step-label">${s.label}</span>
        </button>
      </li>`;
    })}
  </ol>`;
}

/* Publisher details pulled from the master record — read-only here. */
function PublisherAutofillCard({ pub, onChange }) {
  const gaps = publisherGaps(pub);
  return html`<div className="autofill">
    <div className="autofill-head">
      <div>
        <div className="autofill-name">${pub.publisherName} <${StatusBadge} status=${pub.status} /></div>
        <div className="autofill-sub"><${Icon} name="checkCircle" size=${13} /> Details filled in from the publisher record</div>
      </div>
      <div className="autofill-actions">
        <${Link} to=${`/publishers/${pub.id}`} className="btn btn-secondary btn-sm" target="_blank"><${Icon} name="eye" size=${14} /> View</${Link}>
        <button type="button" className="btn btn-secondary btn-sm" onClick=${onChange}>Change</button>
      </div>
    </div>
    <dl className="kv-grid">
      <${KV} label="Legal company name">${pub.legalEntityName}<//>
      <${KV} label="GSTIN" mono>${pub.tax?.gstin}<//>
      <${KV} label="Contact">${[pub.contactPerson, pub.phone].filter(Boolean).join(' · ')}<//>
      <${KV} label="Email">${pub.email}<//>
      <${KV} label="Address" wide>${joinAddress(pub.address)}<//>
    </dl>
    ${gaps.length > 0 && html`<div className="notice notice-warn"><${Icon} name="alert" size=${15} /><div>This publisher has no ${gaps.join(' or ')} on file, so it will print blank on the document. <${Link} to=${`/publishers/${pub.id}/edit`} className="text-link" target="_blank">Add it now</${Link}> (opens in a new tab, your order stays here).</div></div>`}
    ${pub.status === 'Pending Verification' && html`<div className="notice notice-warn"><${Icon} name="alert" size=${15} /><div>This publisher is still waiting to be verified. You can continue, but check their documents.</div></div>`}
  </div>`;
}

/* Live cost summary beside the form. */
function DocSummary({ doc, pub, number, typeCode, c }) {
  const row = (k, v) => html`<div className="sum-row"><span>${k}</span><strong>${v || '—'}</strong></div>`;
  const has = c.subtotal > 0;
  return html`<aside className="doc-summary card" aria-label="Cost summary">
    <div className="sum-title">${typeCode} summary</div>
    <div className="sum-number mono">${number || 'Number assigned on save'}</div>
    ${row('Client', doc.client.name)}
    ${doc.campaign.name && row('Campaign', doc.campaign.name)}
    ${row('Publisher', pub?.publisherName)}
    ${row('Period', doc.campaign.startDate && doc.campaign.endDate ? `${fmtDate(doc.campaign.startDate)} – ${fmtDate(doc.campaign.endDate)}` : '')}
    <div className="sum-divider"></div>
    ${row('Subtotal', has ? fmtINR(c.subtotal) : '')}
    ${c.discount > 0 && row('Discount', `− ${fmtINR(c.discount)}`)}
    ${c.otherCharges > 0 && row('Other charges', fmtINR(c.otherCharges))}
    ${(c.discount > 0 || c.otherCharges > 0) && row('Taxable value', fmtINR(c.taxable))}
    ${has && c.taxLines.map((l) => html`<${Fragment} key=${l.label}>${row(l.label, fmtINR(l.amount))}<//>`)}
    <div className="sum-total"><span>Total</span><strong>${has ? fmtINR(c.total) : '₹0'}</strong></div>
  </aside>`;
}

function OrderForm({ mode, initial, publishers, campaigns, documents = [], settings, onDone, onCancel }) {
  const isEdit = mode === 'edit';
  const org = settings.organization;
  const requireApproval = settings.workflow.requireApproval;

  const initialPub = publishers.find((p) => p.id === initial.publisherId);
  const taxCtxFor = (p) => taxContext(p, org);
  // Older documents saved no payment terms (the agency default was printed), so show that default as the choice.
  const startDoc = () => toFormDoc({ ...initial, paymentTerms: initial.paymentTerms || settings.defaults.paymentTerms }, taxCtxFor(initialPub));
  const [doc, setDoc] = useState(startDoc);
  const [step, setStep] = useState(isEdit ? 3 : initial.publisherId && initial.client?.name ? 1 : 0);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [nextNumber, setNextNumber] = useState('');
  const [quickAdd, setQuickAdd] = useState(null); // { name } while the "add publisher" window is open
  const [justAdded, setJustAdded] = useState(null);
  const [moreClient, setMoreClient] = useState(false);
  const [moreTargets, setMoreTargets] = useState(() => ['clicks', 'leads', 'impressions'].some((k) => toNum(initial.deliverables?.[k]) > 0));
  const [moreNotes, setMoreNotes] = useState(() => !!(initial.notes || initial.specialInstructions || initial.creativeRequirements || initial.billingInstructions));
  const [showOther, setShowOther] = useState(() => toNum(initial.commercial?.otherCharges) > 0);
  const [defaultsFrom, setDefaultsFrom] = useState('');
  const docRef = useRef(doc);
  docRef.current = doc;
  const initialJson = useRef(JSON.stringify(startDoc()));

  useEffect(() => { if (!isEdit) documentService.peekNextNumber(initial.documentType).then(setNextNumber); }, []);

  const typeCode = doc.documentType;
  const type = DOCUMENT_TYPES[typeCode];
  const selectable = useMemo(() => publishers.filter((p) => p.status !== 'Inactive'), [publishers]);
  const pub = publishers.find((p) => p.id === doc.publisherId) || (justAdded && justAdded.id === doc.publisherId ? justAdded : null);
  const ctx = taxCtxFor(pub);
  const model = PRICING_BY_CODE[doc.commercial.pricingModel];
  const c = computeCommercial({ ...doc.commercial, taxType: '' }, ctx);
  const clients = useMemo(() => clientDirectory(campaigns, documents), [campaigns, documents]);
  const hasClient = !!norm(doc.client.name);

  /* ── updating the form ── */
  const set = (path, value) => {
    setDoc((d) => setPath(d, path, value));
    setErrors((e) => { if (!e[path]) return e; const n = { ...e }; delete n[path]; return n; });
  };
  const setMany = (patch) => setDoc((d) => ({ ...d, ...patch }));
  const setCommercial = (patch, nextCtx = ctx) => {
    setDoc((d) => ({ ...d, commercial: recalcCommercial({ ...d.commercial, ...patch }, nextCtx, { deriveQty: 'rate' in patch || 'estimatedSpend' in patch }) }));
    setErrors((e) => {
      const n = { ...e };
      Object.keys(patch).forEach((k) => delete n[`commercial.${k}`]);
      delete n['commercial.estimatedSpend'];
      delete n['commercial.quantity'];
      delete n['commercial.discountValue'];
      return n;
    });
  };
  const blur = (path) => {
    const err = validateDocument(docRef.current, { full: true })[path];
    setErrors((e) => { const n = { ...e }; if (err) n[path] = err; else delete n[path]; return n; });
  };
  const field = (path, extra = {}) => ({ value: getPath(doc, path), error: errors[path], name: path, onChange: (v) => set(path, v), onBlur: () => blur(path), ...extra });

  /* ── campaign and publisher choices ── */
  /* An order is made for a client. (There is no separate campaign step any more.) */
  function chooseClient(c) {
    setMany({
      campaignId: '',
      client: { name: c.name, legalEntity: c.legalEntity || '', address: c.address || '', gstin: c.gstin || '' },
      campaign: { ...docRef.current.campaign, name: '' },
    });
    setErrors((e) => { const n = { ...e }; delete n['client.name']; return n; });
  }
  function clearClient() {
    setMany({ campaignId: '', client: { name: '', legalEntity: '', address: '', gstin: '' }, campaign: { ...docRef.current.campaign, name: '' } });
  }

  /* Choosing a publisher fills in the pricing, GST and payment terms they usually have — unless the user already typed a rate. */
  function choosePublisher(p) {
    const pc = p.commercial || {};
    const nextCtx = taxCtxFor(p);
    const cur = docRef.current.commercial;
    const untouched = !norm(cur.rate) && !norm(cur.estimatedSpend);
    const patch = {};
    const applied = [];
    if (untouched) {
      if (PRICING_BY_CODE[pc.pricingModel]) { patch.pricingModel = pc.pricingModel; patch.spendOverride = !!PRICING_BY_CODE[pc.pricingModel].needsQty; applied.push('buy type'); }
      if (norm(pc.agreedRate) && toNum(pc.agreedRate) > 0) { patch.rate = String(pc.agreedRate); applied.push('rate'); }
    }
    setDoc((d) => ({
      ...d, publisherId: p.id,
      paymentTerms: norm(pc.paymentTerms) && !isEdit ? pc.paymentTerms : d.paymentTerms,
      commercial: recalcCommercial({ ...d.commercial, ...patch }, nextCtx),
    }));
    if (norm(pc.paymentTerms) && !isEdit) applied.push('payment terms');
    setDefaultsFrom(applied.length ? `${p.publisherName}’s agreed ${applied.join(', ')}` : '');
    setErrors((e) => { const n = { ...e }; delete n.publisherId; return n; });
  }

  /* ── moving between steps ── */
  const stepErrors = (idx) => {
    const all = validateDocument(docRef.current, { full: true });
    const match = DOCUMENT_STEP_FIELDS[DOC_STEPS[idx].id];
    return match ? Object.fromEntries(Object.entries(all).filter(([k]) => match(k))) : all;
  };
  function goTo(target) {
    if (target <= step) { setStep(target); return; }
    for (let i = step; i < target; i++) {
      const errs = stepErrors(i);
      if (Object.keys(errs).length) {
        setErrors((e) => ({ ...e, ...errs }));
        setStep(i);
        toast.error('Please complete the highlighted fields to continue.');
        scrollToFirstError();
        return;
      }
    }
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── saving ── */
  async function persist({ submit = false, pdf = false }) {
    const errs = validateDocument(docRef.current, { full: submit });
    if (Object.keys(errs).length) {
      setErrors(errs);
      const failing = DOC_STEPS.findIndex((s) => s.id !== 'review' && Object.keys(errs).some((k) => DOCUMENT_STEP_FIELDS[s.id](k)));
      if (failing >= 0) setStep(failing);
      toast.error(submit ? `Please complete the highlighted fields before submitting this ${type.code}.` : 'Please fix the highlighted fields before saving. A draft needs a client and a publisher.');
      scrollToFirstError();
      return;
    }
    setSaving(true);
    const { ok, result } = await runAction(
      {
        loading: submit ? 'Submitting...' : 'Saving...',
        success: (r) => (submit ? (r.status === 'Approved' ? `${r.documentNumber} created and approved.` : `${r.documentNumber} submitted for approval.`) : isEdit ? `${r.documentNumber} saved.` : `${r.documentNumber} saved as a draft.`),
        error: 'Could not save the document.',
      },
      async () => {
        const d = docRef.current;
        const campaignId = d.campaignId;
        const payload = { ...d, campaignId };
        let saved = isEdit ? await documentService.update(d.id, payload) : await documentService.create(payload);
        if (submit) saved = await documentService.setStatus(saved.id, requireApproval ? 'Pending Approval' : 'Approved');
        if (pdf) {
          try { await pdfService.download(saved); }
          catch (e) { console.error(e); throw new Error(`${saved.documentNumber} was saved, but the PDF could not be created.`); }
        }
        return saved;
      },
    );
    setSaving(false);
    if (ok) onDone(result);
  }

  async function cancel() {
    if (JSON.stringify(docRef.current) !== initialJson.current) {
      const ok = await confirmDialog({ title: 'Leave without saving?', message: 'Anything you entered will be lost. Use “Save as Draft” to keep it.', confirmLabel: 'Leave', cancelLabel: 'Keep editing', danger: true });
      if (!ok) return;
    }
    onCancel();
  }

  /* Step 1 starts here: who is this order for? */
  const clientBlock = hasClient
    ? html`<div className="autofill">
        <div className="autofill-head">
          <div>
            <div className="autofill-name">${doc.client.name}</div>
            <div className="autofill-sub"><${Icon} name="checkCircle" size=${13} /> ${(() => { const known = clients.find((x) => x.key === clientKey(doc.client.name)); return known ? `${known.documents ? plural(known.documents, 'document') + ' so far' : 'No documents yet'}` : 'New client, saved when you save this order'; })()}</div>
          </div>
          <div className="autofill-actions">${!isEdit && html`<button type="button" className="btn btn-secondary btn-sm" onClick=${clearClient}>Change</button>`}</div>
        </div>
        <div className="more-block">
          <button type="button" className="link-btn" aria-expanded=${moreClient} onClick=${() => setMoreClient(!moreClient)}><${Icon} name=${moreClient ? 'chevronDown' : 'chevronRight'} size=${13} /> ${moreClient ? 'Hide' : 'Add or edit'} client legal details for this order (optional)</button>
          ${moreClient && html`<div className="form-grid" style=${{ marginTop: 12 }}>
            <${TextField} label="Client legal name" className="col-6" ...${field('client.legalEntity')} />
            <${TextField} label="Client GSTIN" className="col-6" maxLength=${15} transform=${(v) => v.toUpperCase()} ...${field('client.gstin')} />
            <${TextAreaField} label="Client address" className="col-12" rows=${2} ...${field('client.address')} />
          </div>`}
        </div>
      </div>`
    : html`<div className="field" data-error=${errors['client.name'] ? 'true' : undefined}>
        <label className="label">Client<span className="req"> *</span></label>
        <${ClientPicker} clients=${clients} error=${errors['client.name']} autoFocus=${!isEdit && !initial.publisherId} onSelect=${chooseClient}
          onCreate=${(name) => chooseClient({ name, legalEntity: '', address: '', gstin: '' })} />
        ${errors['client.name'] && html`<div className="field-error" role="alert"><${Icon} name="alert" size=${12} /><span>${errors['client.name']}</span></div>`}
        <div className="hint">Pick the client this order is for. Not there yet? Type the name and choose “Add a new client”.</div>
      </div>`;

  const publisherBlock = pub
    ? html`<${PublisherAutofillCard} pub=${pub} onChange=${() => set('publisherId', '')} />`
    : html`<div className="field" data-error=${errors.publisherId ? 'true' : undefined}>
        <label className="label">Publisher<span className="req"> *</span></label>
        <${PublisherPicker} publishers=${selectable} error=${errors.publisherId} onSelect=${choosePublisher} onCreate=${(name) => setQuickAdd({ name })}
          autoFocus=${!isEdit && !!initial.client?.name} />
        ${errors.publisherId && html`<div className="field-error" role="alert"><${Icon} name="alert" size=${12} /><span>${errors.publisherId}</span></div>`}
        <div className="hint">Only active publishers are listed. Not there yet? Choose “Add a new publisher” in the list.</div>
      </div>`;

  const campaignStep = html`<div className="stack">
    ${!isEdit && html`<${FormSection} title="What are you creating?">
      <div role="radiogroup" aria-label="Document type" className="type-choice">
        ${DOCUMENT_TYPE_LIST.filter((t) => t.enabled).map((t) => html`<button key=${t.code} type="button" role="radio" aria-checked=${typeCode === t.code}
          className=${'type-opt' + (typeCode === t.code ? ' is-active' : '')} onClick=${() => { set('documentType', t.code); documentService.peekNextNumber(t.code).then(setNextNumber); }}>
          <span className="type-opt-code">${t.code}</span><span className="type-opt-name">${t.label}</span><span className="type-opt-desc">${t.description}</span>
        </button>`)}
      </div>
    <//>`}
    <${FormSection} title="Client" description="Who is this order for?">${clientBlock}<//>
    <${FormSection} title="Publisher" description="Who will run it? Their details fill in automatically.">${publisherBlock}<//>
  </div>`;

  /* ── Step 2: deliverables ── */
  const billableKey = model && model.billable;
  /* Buy type → unit rate (and a budget). The number of impressions / clicks / leads is worked out for you. */
  const unitName = model ? model.qtyLabel.toLowerCase() : 'units';
  const budgetProblem = errors['commercial.estimatedSpend']
    || (norm(doc.commercial.rate) && norm(doc.commercial.estimatedSpend) && errors['commercial.quantity'] ? 'This budget is too small to buy even one unit at this rate' : undefined);
  const priceFields = !model ? null
    : model.needsQty ? html`
        <${TextField} label=${model.rateLabel} required className="col-6" prefix="₹" inputMode="decimal" transform=${numericText}
          autoFocus=${step === 1} ...${field('commercial.rate', { onChange: (v) => setCommercial({ rate: v }) })} />
        <${TextField} label="Budget (before tax)" required className="col-6" prefix="₹" inputMode="decimal" transform=${numericText}
          hint=${toNum(doc.commercial.estimatedSpend) ? fmtINR(doc.commercial.estimatedSpend) : 'The amount to spend on this buy.'}
          ...${field('commercial.estimatedSpend', { error: budgetProblem, onChange: (v) => setCommercial({ estimatedSpend: v }) })} />
        <div className="col-12 calc-result" aria-live="polite">
          <span>Number of ${unitName}</span>
          <strong>${toNum(doc.commercial.quantity) > 0 ? fmtNum(doc.commercial.quantity) : '—'}</strong>
          <small>${toNum(doc.commercial.quantity) > 0 ? 'Worked out from the budget and the rate.' : 'Enter the rate and the budget to see this.'}</small>
        </div>`
    : model.code === 'Fixed' ? html`
        <${TextField} label="Agreed amount (before tax)" required className="col-6" prefix="₹" inputMode="decimal" transform=${numericText}
          hint="One fixed fee for the whole buy." autoFocus=${step === 1} ...${field('commercial.rate', { onChange: (v) => setCommercial({ rate: v }) })} />`
    : html`
        <${TextField} label="Amount (before tax)" required className="col-6" prefix="₹" inputMode="decimal" transform=${numericText}
          hint="The agreed amount for this buy." autoFocus=${step === 1} ...${field('commercial.estimatedSpend', { onChange: (v) => setCommercial({ estimatedSpend: v }) })} />`;
  const otherTargets = [['impressions', 'Impressions'], ['clicks', 'Clicks'], ['leads', 'Leads']].filter(([k]) => billableKey !== k);

  const deliverablesStep = html`<div className="stack">
    <${FormSection} title="Start and End Date">
      <div className="form-grid">
        <${TextField} label="Start date" required type="date" className="col-6" ...${field('campaign.startDate')} />
        <${TextField} label="End date" required type="date" className="col-6" min=${doc.campaign.startDate || undefined} hint="Cannot be before the start date" ...${field('campaign.endDate', { onBlur: () => { blur('campaign.endDate'); blur('campaign.startDate'); } })} />
      </div>
    <//>
    <${FormSection} title="Deliverables" description="Choose the buy type, then enter the rate. We work out the rest.">
      ${defaultsFrom && html`<div className="notice notice-info" style=${{ marginBottom: 14 }}><${Icon} name="info" size=${15} /><div>Filled in from ${defaultsFrom}. Change anything that is different on this order.</div></div>`}
      <div className="form-grid">
        <${Segmented} label="Buy type" className="col-12" name="commercial.pricingModel" value=${doc.commercial.pricingModel}
          hint=${model ? model.hint : ''}
          onChange=${(v) => { if (v !== doc.commercial.pricingModel) setCommercial({ pricingModel: v, rate: '', quantity: '', estimatedSpend: '', spendOverride: !!PRICING_BY_CODE[v].needsQty }); }}
          options=${PRICING_MODELS.map((m) => ({ value: m.code, label: m.label }))} />
        ${priceFields}
      </div>
      <div className="more-block">
        <button type="button" className="link-btn" aria-expanded=${moreTargets} onClick=${() => setMoreTargets(!moreTargets)}><${Icon} name=${moreTargets ? 'chevronDown' : 'chevronRight'} size=${13} /> ${moreTargets ? 'Hide' : 'Add'} other targets (optional)</button>
        ${moreTargets && html`<div className="form-grid" style=${{ marginTop: 12 }}>
          ${otherTargets.map(([k, label]) => html`<${TextField} key=${k} label=${`Expected ${label.toLowerCase()}`} className="col-4" inputMode="numeric" transform=${wholeText} ...${field(`deliverables.${k}`)} />`)}
          <${TextAreaField} label="Other deliverables" className="col-12" rows=${3} placeholder="Placements, sizes, targeting, reporting…" ...${field('deliverables.other')} />
        </div>`}
        ${!moreTargets && doc.deliverables.other && html`<p className="hint hint-block">Other deliverables are saved. Open the section above to see them.</p>`}
      </div>
    <//>
  </div>`;

  /* ── Step 3: commercials ── */

  const commercialsStep = html`<div className="stack">
    <${FormSection} title="Price" description="The buy and its rate come from the Deliverables step. Add any discount here. The total updates as you type.">
      <div className="price-line">
        <div><span className="label">Your buy</span><div>${describePricing(doc.commercial) || '—'}${toNum(c.subtotal) > 0 ? html` = <strong>${fmtINR(c.subtotal)}</strong>` : ''}</div></div>
        <button type="button" className="link-btn" onClick=${() => goTo(1)}>Change in Deliverables</button>
      </div>
      <div className="form-grid" style=${{ marginTop: 16 }}>
        <div className="field col-6">
          <span className="label">Discount (optional)</span>
          <div className="inline-pair">
            <${TextField} className="grow" suffix=${doc.commercial.discountType === 'percent' ? '%' : null} prefix=${doc.commercial.discountType === 'amount' ? '₹' : null} inputMode="decimal" transform=${numericText} placeholder="0" ...${field('commercial.discountValue', { onChange: (v) => setCommercial({ discountValue: v }) })} />
            <${Segmented} name="discountType" value=${doc.commercial.discountType} onChange=${(v) => setCommercial({ discountType: v })} options=${[{ value: 'percent', label: '%' }, { value: 'amount', label: '₹' }]} />
          </div>
        </div>
      </div>
      <div className="more-block">
        <button type="button" className="link-btn" aria-expanded=${showOther} onClick=${() => setShowOther(!showOther)}><${Icon} name=${showOther ? 'chevronDown' : 'chevronRight'} size=${13} /> ${showOther ? 'Hide' : 'Add'} other charges (optional)</button>
        ${showOther && html`<div className="form-grid" style=${{ marginTop: 12 }}>
          <${TextField} label="What are they for?" className="col-6" placeholder="e.g. Ad serving fee" ...${field('commercial.otherChargesLabel', { onChange: (v) => setCommercial({ otherChargesLabel: v }) })} />
          <${TextField} label="Amount" className="col-6" prefix="₹" inputMode="decimal" transform=${numericText} hint="Added before GST." ...${field('commercial.otherCharges', { onChange: (v) => setCommercial({ otherCharges: v }) })} />
        </div>`}
      </div>
      <div className="calc-box" aria-live="polite">
        <div className="calc-row"><span>Subtotal</span><strong>${fmtINR(c.subtotal)}</strong></div>
        ${c.discount > 0 && html`<div className="calc-row"><span>Discount</span><strong>− ${fmtINR(c.discount)}</strong></div>`}
        ${c.otherCharges > 0 && html`<div className="calc-row"><span>${doc.commercial.otherChargesLabel || 'Other charges'}</span><strong>${fmtINR(c.otherCharges)}</strong></div>`}
        ${(c.discount > 0 || c.otherCharges > 0) && html`<div className="calc-row"><span>Taxable value</span><strong>${fmtINR(c.taxable)}</strong></div>`}
        ${c.taxLines.map((l) => html`<div key=${l.label} className="calc-row"><span>${l.label}</span><strong>${fmtINR(l.amount)}</strong></div>`)}
        <div className="calc-row calc-total"><span>Total</span><strong>${fmtINR(c.total)}</strong></div>
      </div>
    <//>

    <${FormSection} title="Payment terms">
      <div className="form-grid">
        <${SelectField} label="Payment terms" required className="col-6" placeholder="Choose payment terms" options=${paymentTermOptions(doc.paymentTerms)} ...${field('paymentTerms')} />
      </div>
      <div className="more-block">
        <button type="button" className="link-btn" aria-expanded=${moreNotes} onClick=${() => setMoreNotes(!moreNotes)}><${Icon} name=${moreNotes ? 'chevronDown' : 'chevronRight'} size=${13} /> ${moreNotes ? 'Hide' : 'Add'} notes and instructions (optional)</button>
        ${moreNotes && html`<div className="form-grid" style=${{ marginTop: 12 }}>
          <${TextAreaField} label="Notes" className="col-6" rows=${3} placeholder="Placement preferences, targeting notes…" ...${field('notes')} />
          <${TextAreaField} label="Special instructions" className="col-6" rows=${3} ...${field('specialInstructions')} />
          <${TextAreaField} label="Creative requirements" className="col-6" rows=${3} placeholder="Sizes, formats, delivery deadlines…" ...${field('creativeRequirements')} />
          <${TextAreaField} label="Billing instructions" className="col-6" rows=${3} ...${field('billingInstructions')} />
        </div>`}
      </div>
    <//>
  </div>`;

  /* ── Step 4: review ── */
  const fullErrors = step === 3 ? validateDocument(doc, { full: true }) : {};
  const missing = DOC_STEPS.map((s, i) => ({ s, i, n: Object.keys(fullErrors).filter((k) => s.id !== 'review' && DOCUMENT_STEP_FIELDS[s.id](k)).length })).filter((x) => x.n > 0);
  const previewDoc = { ...doc, documentNumber: doc.documentNumber || nextNumber, status: isEdit ? initial.status : 'Draft' };
  const reviewStep = html`<div className="stack">
    ${missing.length > 0 && html`<div className="notice notice-warn"><${Icon} name="alert" size=${16} />
      <div><strong>A few things are still missing before you can submit:</strong>
        <ul className="notice-list">${missing.map(({ s, i, n }) => html`<li key=${s.id}><button type="button" className="link-btn" onClick=${() => setStep(i)}>${s.label}</button> · ${plural(n, 'field')} to fill in</li>`)}</ul>
        <div className="hint" style=${{ color: 'inherit', marginTop: 4 }}>You can still save a draft and finish later.</div>
      </div></div>`}
    <${DocumentPreview} doc=${previewDoc} publisher=${pub ? snapshotPublisher(pub) : null} org=${isEdit && initial.agencySnapshot ? initial.agencySnapshot : org}
      paymentTerms=${doc.paymentTerms} taxCtx=${ctx}
      createdBy=${isEdit ? initial.createdBy : currentUser.actor()} createdAt=${isEdit ? initial.createdAt : null} />
  </div>`;

  const body = [campaignStep, deliverablesStep, commercialsStep, reviewStep][step];
  const last = step === DOC_STEPS.length - 1;
  const numberLabel = doc.documentNumber || (nextNumber ? `${nextNumber} (next)` : '');
  const canSubmit = can('document.submit');
  const submitLabel = requireApproval ? 'Submit for Approval' : 'Create & Approve';

  return html`<div className="doc-flow">
    <${Stepper} steps=${DOC_STEPS} current=${step} onGo=${goTo} />
    ${isEdit && initial.status === 'Rejected' && html`<div className="notice notice-warn"><${Icon} name="alert" size=${16} /><div>This ${type.code} was sent back. Saving moves it back to Draft so you can submit it again.${(() => { const r = [...(initial.statusHistory || [])].reverse().find((h) => h.to === 'Rejected'); return r && r.comment ? html` <strong>Reason:</strong> ${r.comment}` : ''; })()}</div></div>`}
    <div className=${'doc-layout' + (last ? ' is-single' : '')}>
      <div className="doc-main">${body}</div>
      ${!last && html`<${DocSummary} doc=${doc} pub=${pub} number=${numberLabel} typeCode=${type.code} c=${c} />`}
    </div>

    <div className="form-footer">
      <button type="button" className="btn btn-ghost" onClick=${cancel} disabled=${saving}>Cancel</button>
      <div className="form-footer-actions">
        ${step > 0 && html`<button type="button" className="btn btn-secondary" onClick=${() => goTo(step - 1)} disabled=${saving}><${Icon} name="arrowLeft" size=${15} /> Back</button>`}
        <button type="button" className="btn btn-secondary" onClick=${() => persist({})} disabled=${saving} title="Needs at least a client and a publisher">${isEdit ? 'Save Changes' : 'Save as Draft'}</button>
        ${last
          ? html`<button type="button" className="btn btn-secondary" onClick=${() => persist({ pdf: true })} disabled=${saving}><${Icon} name="download" size=${15} /> Save & Download PDF</button>
              ${canSubmit && html`<button type="button" className="btn btn-primary" onClick=${() => persist({ submit: true })} disabled=${saving}>
                ${saving ? html`<span className="spinner spinner-sm spinner-light"></span>` : html`<${Icon} name="send" size=${15} />`} ${submitLabel}</button>`}`
          : html`<button type="button" className="btn btn-primary" onClick=${() => goTo(step + 1)}>Continue <${Icon} name="arrowRight" size=${15} /></button>`}
      </div>
    </div>

    ${quickAdd && html`<${QuickAddPublisherModal} initialName=${quickAdd.name} onClose=${() => setQuickAdd(null)}
      onCreated=${(p) => { setJustAdded(p); choosePublisher(p); setQuickAdd(null); }} />`}
  </div>`;
}

function DocumentForm(props) {
  return html`<${OrderForm} ...${props} />`;
}
