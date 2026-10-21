/* ──────────────────────────────────────────────────────────────
   Document workflow — which status can follow which, who may do it,
   and what the button is called. Everything status-related reads this table.

     Draft → Pending Approval → Approved → Sent → Acknowledged → Completed
                    ↘ Rejected → (back to Draft)          any open step → Cancelled

   If "Require approval" is switched off in Settings, a Draft can be approved directly.
   ────────────────────────────────────────────────────────────── */
const WORKFLOW = {
  'Draft': [
    { to: 'Pending Approval', label: 'Submit for Approval', perm: 'document.submit', primary: true, needsApproval: true },
    { to: 'Approved', label: 'Approve', perm: 'document.submit', primary: true, needsApproval: false },
    { to: 'Cancelled', label: 'Cancel document', perm: 'document.cancel', danger: true, askComment: 'optional' },
  ],
  'Pending Approval': [
    { to: 'Approved', label: 'Approve', perm: 'document.approve', primary: true },
    { to: 'Rejected', label: 'Reject', perm: 'document.approve', danger: true, askComment: 'required' },
    { to: 'Draft', label: 'Withdraw to Draft', perm: 'document.submit' },
    { to: 'Cancelled', label: 'Cancel document', perm: 'document.cancel', danger: true, askComment: 'optional' },
  ],
  'Approved': [
    { to: 'Sent', label: 'Mark as Sent', perm: 'document.send', primary: true },
    { to: 'Cancelled', label: 'Cancel document', perm: 'document.cancel', danger: true, askComment: 'optional' },
  ],
  'Sent': [
    { to: 'Acknowledged', label: 'Mark as Acknowledged', perm: 'document.send', primary: true },
    { to: 'Completed', label: 'Mark as Completed', perm: 'document.send' },
    { to: 'Cancelled', label: 'Cancel document', perm: 'document.cancel', danger: true, askComment: 'optional' },
  ],
  'Acknowledged': [
    { to: 'Completed', label: 'Mark as Completed', perm: 'document.send', primary: true },
    { to: 'Cancelled', label: 'Cancel document', perm: 'document.cancel', danger: true, askComment: 'optional' },
  ],
  'Rejected': [
    { to: 'Draft', label: 'Reopen as Draft', perm: 'document.edit', primary: true },
    { to: 'Cancelled', label: 'Cancel document', perm: 'document.cancel', danger: true, askComment: 'optional' },
  ],
  'Completed': [],
  'Cancelled': [],
};

/** Plain-language hint shown next to the status. */
const STATUS_HELP = {
  'Draft': 'Still being prepared. Submit it when it is ready.',
  'Pending Approval': 'Waiting for an approver to approve or reject it.',
  'Approved': 'Approved. The next step is to send it to the publisher.',
  'Sent': 'Sent to the publisher. Waiting for their acknowledgement.',
  'Acknowledged': 'The publisher has confirmed it.',
  'Completed': 'The campaign is done. Nothing more to do.',
  'Rejected': 'Sent back with a reason. Reopen it, fix it and submit again.',
  'Cancelled': 'Cancelled. It stays on record but cannot be changed.',
};

const EDITABLE_STATUSES = ['Draft', 'Rejected'];

const normalizeStatus = (s) => LEGACY_STATUS_MAP[s] || (DOCUMENT_STATUSES.includes(s) ? s : 'Draft');

/** The moves this person can make right now from the document's current status. */
function availableTransitions(doc, { requireApproval = true, role } = {}) {
  return (WORKFLOW[doc.status] || []).filter((t) => {
    if (t.needsApproval === true && !requireApproval) return false;
    if (t.needsApproval === false && requireApproval) return false;
    return can(t.perm, role);
  });
}

/** Finds the rule for one specific move, or null if that move is not allowed (for anyone). */
function findTransition(from, to, { requireApproval = true } = {}) {
  return (WORKFLOW[from] || []).find((t) => t.to === to
    && !(t.needsApproval === true && !requireApproval)
    && !(t.needsApproval === false && requireApproval)) || null;
}

/** Can this person edit the content of the document? (Only before it is submitted, or after a rejection.) */
const canEditDocument = (doc) => EDITABLE_STATUSES.includes(doc.status) && can('document.edit');
