/* ──────────────────────────────────────────────────────────────
   storageService — the ONLY module that touches localStorage.

   The rest of the app (services + UI) talks to this small key/value API.
   To move to Supabase / Firebase / PostgreSQL later, re-implement the
   services on top of the new backend; the UI never sees localStorage.

   Keeps the original behaviour: localStorage first, with an in-memory
   fallback when the browser blocks storage (e.g. some file:// setups).
   ────────────────────────────────────────────────────────────── */
const storageService = (() => {
  const PREFIX = window.PP_STORAGE_PREFIX || 'pp:v1:'; // tests set their own prefix so they never touch real data
  const mem = {};
  const listeners = new Set();
  let persistent = true;

  const emit = (key) => listeners.forEach((fn) => { try { fn(key); } catch (e) { console.error(e); } });

  function get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) {
      persistent = false;
    }
    return key in mem ? clone(mem[key]) : fallback;
  }

  function set(key, value) {
    mem[key] = clone(value);
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      persistent = false; // quota exceeded or storage blocked — keep working from memory
    }
    emit(key);
  }

  function remove(key) {
    delete mem[key];
    try { window.localStorage.removeItem(PREFIX + key); } catch (e) { persistent = false; }
    emit(key);
  }

  /** Read a key written by the previous (first-draft) app, outside our namespace. */
  function readLegacy(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /** Subscribe to any data change (also fires for changes made in other tabs). */
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith(PREFIX)) emit(e.key.slice(PREFIX.length));
  });

  // Probe once so the UI can warn if data will not survive a refresh.
  try {
    window.localStorage.setItem(PREFIX + '__probe', '1');
    window.localStorage.removeItem(PREFIX + '__probe');
  } catch (e) {
    persistent = false;
  }

  return { get, set, remove, subscribe, readLegacy, isPersistent: () => persistent };
})();

/* Collection names (single source of truth for storage keys). */
const COLLECTIONS = {
  publishers: 'publishers',
  campaigns: 'campaigns',
  documents: 'documents',
  meta: 'meta', // { schemaVersion, migratedAt } — see migrationService
  backup: 'backup_v1', // untouched copy of the pre-upgrade records, written once before the first migration
  activity: 'activity',
  settings: 'settings',
  counters: 'counters',
  seeded: 'seeded',
};
