/* ──────────────────────────────────────────────────────────────
   Money maths — the ONE place order totals are worked out.

   The form, the preview, the PDF, reports and the saved record all call
   computeCommercial(), so a number can never differ between screens.

   Amounts are rounded to whole paise before they are added up, so totals
   never drift by a fraction of a paisa:

     CPM        = impressions ÷ 1,000 × rate
     CPC / CPL / CPA = quantity × rate
     Fixed fee  = the agreed amount
     Other      = an amount typed in by hand

     taxable value = subtotal − discount + other charges
     GST           = taxable value × GST %   (split in two for CGST + SGST)
     total         = taxable value + GST
   ────────────────────────────────────────────────────────────── */

/* Rupees -> whole paise. The tiny nudge makes exact halves (e.g. 0.125) round up the way people expect. */
const toPaise = (rupees) => {
  const x = Number(rupees) || 0;
  return Math.round(x * 100 + (x < 0 ? -1e-7 : 1e-7));
};
const fromPaise = (paise) => paise / 100;

/** 27AAACC1206D1ZM -> "27". Returns '' when the GSTIN is missing or malformed. */
function stateCodeFromGstin(gstin) {
  const g = String(gstin || '').trim().toUpperCase();
  return /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g) && GST_STATE_BY_CODE[g.slice(0, 2)] ? g.slice(0, 2) : '';
}

/** State code for a party: from the GSTIN when valid, otherwise from the address state. */
function stateCodeFor({ gstin, state } = {}) {
  return stateCodeFromGstin(gstin) || GST_STATE_CODES[state] || '';
}

/**
 * Which kind of GST applies.
 *   'CGST_SGST' – both parties in the same state
 *   'IGST'      – different states
 *   'GST'       – can't tell (a state is missing), shown as a single GST line
 *   'NONE'      – no GST charged
 */
function resolveTaxType(treatment, agencyCode, partyCode) {
  if (treatment === 'none') return 'NONE';
  if (treatment === 'intra') return 'CGST_SGST';
  if (treatment === 'inter') return 'IGST';
  if (agencyCode && partyCode) return agencyCode === partyCode ? 'CGST_SGST' : 'IGST';
  return 'GST';
}

/**
 * Full price breakdown for an order. All values are rupees rounded to 2 decimals.
 * `cm` is the document's `commercial` object. `ctx.taxType` (or `cm.taxType`) pins the GST type;
 * saved documents keep the type they were created with, so history never changes by itself.
 */
function computeCommercial(cm, ctx = {}) {
  const model = PRICING_BY_CODE[cm.pricingModel];
  const rate = toNum(cm.rate);
  const qty = toNum(cm.quantity);
  const auto = !!model && model.auto && !cm.spendOverride;
  const canAuto = auto && rate > 0 && (!model.needsQty || qty > 0);

  const subtotalP = canAuto ? toPaise(model.calc(rate, qty)) : toPaise(toNum(cm.estimatedSpend));

  const discountValue = Math.max(0, toNum(cm.discountValue));
  const rawDiscountP = cm.discountType === 'amount' ? toPaise(discountValue) : toPaise((fromPaise(subtotalP) * discountValue) / 100);
  const discountP = Math.min(rawDiscountP, subtotalP); // a discount can never push the price below zero
  const otherP = toPaise(Math.max(0, toNum(cm.otherCharges)));
  const taxableP = subtotalP - discountP + otherP;

  const taxType = ctx.taxType || cm.taxType || resolveTaxType(cm.taxTreatment || 'auto', ctx.agencyCode, ctx.partyCode);
  const gstPercent = taxType === 'NONE' ? 0 : toNum(cm.gstPercent);
  let cgstP = 0, sgstP = 0, igstP = 0, gstP = 0;
  if (taxType === 'CGST_SGST') {
    cgstP = Math.round((taxableP * gstPercent) / 200 + 1e-7);
    sgstP = cgstP;
    gstP = cgstP + sgstP;
  } else {
    gstP = Math.round((taxableP * gstPercent) / 100 + 1e-7);
    if (taxType === 'IGST') igstP = gstP;
  }
  const totalP = taxableP + gstP;

  const half = gstPercent / 2;
  const taxLines = taxType === 'CGST_SGST'
    ? [{ label: `CGST @ ${half}%`, amount: fromPaise(cgstP) }, { label: `SGST @ ${half}%`, amount: fromPaise(sgstP) }]
    : taxType === 'IGST' ? [{ label: `IGST @ ${gstPercent}%`, amount: fromPaise(igstP) }]
    : taxType === 'NONE' ? [{ label: 'GST (not applicable)', amount: 0 }]
    : [{ label: `GST @ ${gstPercent}%`, amount: fromPaise(gstP) }];

  return {
    subtotal: fromPaise(subtotalP),
    spend: fromPaise(subtotalP), // older name for the subtotal, still used by a few screens
    discount: fromPaise(discountP),
    otherCharges: fromPaise(otherP),
    taxable: fromPaise(taxableP),
    taxType, gstPercent,
    gstAmount: fromPaise(gstP),
    cgst: fromPaise(cgstP), sgst: fromPaise(sgstP), igst: fromPaise(igstP),
    taxLines,
    total: fromPaise(totalP),
    derived: canAuto,
    discountTooBig: rawDiscountP > subtotalP,
  };
}

/** "10,000,000 impressions × ₹30 per 1,000" — one plain-language line describing how the subtotal was reached. */
function describePricing(cm, money = fmtINR) {
  const model = PRICING_BY_CODE[cm.pricingModel];
  if (!model) return '';
  const rate = toNum(cm.rate);
  const qty = toNum(cm.quantity);
  if (model.code === 'Fixed') return 'Fixed fee';
  if (model.code === 'Other') return 'As agreed';
  const per = model.code === 'CPM' ? 'per 1,000' : 'each';
  return qty > 0 && rate > 0
    ? `${model.label}: ${fmtNum(qty)} ${model.qtyLabel.toLowerCase()} × ${money(rate)} ${per}`
    : `${model.label}${rate > 0 ? ` @ ${money(rate)} ${per}` : ''}`;
}

/** What the publisher has to deliver, as [{ label, value }] (the billed quantity plus any other targets). */
function deliverableLines(doc) {
  const cm = doc.commercial || {};
  const dl = doc.deliverables || {};
  const model = PRICING_BY_CODE[cm.pricingModel];
  const items = [['impressions', 'Impressions'], ['clicks', 'Clicks'], ['leads', 'Leads']];
  const lines = [];
  items.forEach(([key, label]) => {
    const v = model && model.billable === key ? cm.quantity : dl[key];
    if (toNum(v) > 0) lines.push({ label, value: fmtNum(v), billed: !!model && model.billable === key });
  });
  if (model && model.billable === 'actions' && toNum(cm.quantity) > 0) lines.push({ label: 'Actions / Conversions', value: fmtNum(cm.quantity), billed: true });
  if (model && !model.billable && toNum(cm.quantity) > 0) lines.push({ label: 'Quantity', value: fmtNum(cm.quantity), billed: false });
  return lines;
}

/** True when a saved total still matches what the numbers add up to (guards against hand-edited or stale data). */
function totalsAreConsistent(cm) {
  return Math.abs(computeCommercial(cm).total - toNum(cm.totalAmount)) < 0.005;
}
