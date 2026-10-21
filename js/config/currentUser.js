/* ──────────────────────────────────────────────────────────────
   CURRENT USER — the ONLY place the acting user is defined.

   Authentication is intentionally NOT implemented in this version.
   Every service reads the acting user from here (never hard-codes a
   name). When real auth is added, replace `get()` with the session
   user (e.g. from Supabase/Firebase/your SSO) and nothing else in
   the app needs to change.

   The role is a development convenience: Settings lets you switch it to
   check what each team member would see. It is stored in this browser only
   and is NOT a security control until real sign-in exists.
   ────────────────────────────────────────────────────────────── */
const CURRENT_USER = Object.freeze({
  id: 'demo-user-001',
  name: 'Arpit Pandey',
  email: 'arpit@example.com',
});

const DEFAULT_ROLE = 'Admin';

const currentUser = {
  /** The role being used right now (kept in browser storage so it survives a refresh). */
  role() {
    try {
      const raw = window.localStorage.getItem((window.PP_STORAGE_PREFIX || 'pp:v1:') + 'role');
      const role = raw ? JSON.parse(raw) : null;
      return typeof ROLES !== 'undefined' && ROLES.includes(role) ? role : DEFAULT_ROLE;
    } catch (e) {
      return DEFAULT_ROLE;
    }
  },
  /** Full user object (id, name, email, role). */
  get: () => ({ ...CURRENT_USER, role: currentUser.role() }),
  /** Compact reference stored on records: createdBy / updatedBy / uploadedBy / performedBy. */
  actor: () => ({ id: CURRENT_USER.id, name: CURRENT_USER.name }),
};

/** Placeholder identity used for bundled sample records — not a real user. */
const DEMO_ACTOR = Object.freeze({ id: 'demo-seed', name: 'Sample Data' });
