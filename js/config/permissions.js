/* ──────────────────────────────────────────────────────────────
   Roles and permissions — one table, easy to read and change.

   IMPORTANT: this app has no server yet, so these rules are enforced in the
   browser only (the screens hide actions and the services refuse them).
   They keep honest users on the right path; they are NOT a security boundary.
   Real enforcement needs server-side checks once a backend is added.
   ────────────────────────────────────────────────────────────── */
const ROLES = ['Admin', 'Media Operations', 'Finance', 'Approver', 'Read Only'];

const ROLE_HELP = {
  'Admin': 'Everything, including settings and data management.',
  'Media Operations': 'Adds publishers and campaigns, creates and sends documents.',
  'Finance': 'Views everything, including full bank details, and can update bank details.',
  'Approver': 'Approves or rejects documents that are waiting for approval.',
  'Read Only': 'Can look at records and download PDFs. Nothing else.',
};

const PERMISSIONS = {
  'publisher.edit': ['Admin', 'Media Operations'],
  'publisher.blacklist': ['Admin', 'Media Operations'],
  'publisher.delete': ['Admin'],
  'bank.edit': ['Admin', 'Media Operations', 'Finance'],
  'bank.view': ['Admin', 'Finance'],
  'campaign.edit': ['Admin', 'Media Operations'],
  'document.create': ['Admin', 'Media Operations'],
  'document.edit': ['Admin', 'Media Operations'],
  'document.submit': ['Admin', 'Media Operations'],
  'document.approve': ['Admin', 'Approver'],
  'document.send': ['Admin', 'Media Operations'],
  'document.cancel': ['Admin', 'Media Operations'],
  'document.archive': ['Admin', 'Media Operations'],
  'settings.edit': ['Admin'],
  'data.manage': ['Admin'],
};

/** can('document.approve') -> true / false for the current role (or the role you pass in). */
function can(action, role = currentUser.role()) {
  const allowed = PERMISSIONS[action];
  return !!allowed && allowed.includes(role);
}

/** Throws a plain-language error when the current role may not do something. */
function assertCan(action, what = 'do this') {
  if (!can(action)) throw new Error(`Your role (${currentUser.role()}) cannot ${what}.`);
}
