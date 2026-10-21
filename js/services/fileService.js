/* ──────────────────────────────────────────────────────────────
   fileService — file storage abstraction.

   The UI only calls fileService.* (uploadFile, getFile, downloadFile,
   deleteFile, replaceFile). Where the bytes actually live is decided by
   the *provider*. This prototype ships a browser-local provider
   (IndexedDB, in-memory fallback). To use S3 / Supabase Storage /
   Firebase Storage, implement the same 4-method provider and call
   fileService.setProvider(myProvider) — no UI changes needed.

   provider contract:
     put(id, blob)  -> Promise<void>
     get(id)        -> Promise<Blob | null>
     remove(id)     -> Promise<void>
   ────────────────────────────────────────────────────────────── */
const localFileProvider = (() => {
  const memory = new Map();
  let dbPromise = null;

  const openDb = () => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open('publisher-portal-files', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('files');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
    return dbPromise;
  };

  const tx = (db, mode, fn) =>
    new Promise((resolve, reject) => {
      const t = db.transaction('files', mode);
      const store = t.objectStore('files');
      const req = fn(store);
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });

  return {
    async put(id, blob) {
      const db = await openDb();
      if (!db) { memory.set(id, blob); return; }
      try { await tx(db, 'readwrite', (s) => s.put(blob, id)); } catch (e) { memory.set(id, blob); }
    },
    async get(id) {
      if (memory.has(id)) return memory.get(id);
      const db = await openDb();
      if (!db) return null;
      try { return (await tx(db, 'readonly', (s) => s.get(id))) || null; } catch (e) { return null; }
    },
    async remove(id) {
      memory.delete(id);
      const db = await openDb();
      if (!db) return;
      try { await tx(db, 'readwrite', (s) => s.delete(id)); } catch (e) { /* already gone */ }
    },
  };
})();

const fileService = (() => {
  let provider = localFileProvider;

  const extOf = (name = '') => (name.split('.').pop() || '').toLowerCase();
  const inferMime = (file) => {
    if (FILE_RULES.mimeTypes.includes(file.type)) return file.type;
    const ext = extOf(file.name);
    return ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(ext) ? 'image/jpeg' : file.type;
  };

  /** Returns an error message, or '' if the file is acceptable. */
  function validate(file) {
    if (!file) return 'No file selected';
    const okExt = ['pdf', 'jpg', 'jpeg', 'png'].includes(extOf(file.name));
    if (!okExt || !FILE_RULES.mimeTypes.includes(inferMime(file))) return 'Unsupported file type. Use PDF, JPG, JPEG or PNG.';
    if (file.size === 0) return 'This file is empty.';
    if (file.size > FILE_RULES.maxBytes) return `File is too large (${fmtBytes(file.size)}). Maximum is 10 MB.`;
    return '';
  }

  const metaFor = (id, file) => ({
    id,
    fileName: file.name,
    mimeType: inferMime(file),
    size: file.size,
    uploadedAt: nowISO(),
    uploadedBy: currentUser.actor(),
  });

  return {
    setProvider(p) { provider = p; },
    validate,

    /** Store a file; resolves to its metadata (id, fileName, mimeType, size, uploadedAt, uploadedBy). */
    async uploadFile(file) {
      const err = validate(file);
      if (err) throw new Error(err);
      const id = uid('file_');
      await provider.put(id, file);
      return metaFor(id, file);
    },

    /** Resolves to the stored Blob, or null if it no longer exists. */
    async getFile(id) {
      return provider.get(id);
    },

    /** Replace the content behind an existing id (same id, new metadata). */
    async replaceFile(id, file) {
      const err = validate(file);
      if (err) throw new Error(err);
      await provider.put(id, file);
      return metaFor(id, file);
    },

    async deleteFile(id) {
      await provider.remove(id);
    },

    async deleteMany(ids) {
      await Promise.all([...new Set(ids)].filter(Boolean).map((id) => provider.remove(id)));
    },

    /** Trigger a browser download of a stored file. */
    async downloadFile(id, fileName) {
      const blob = await provider.get(id);
      if (!blob) throw new Error('File not found. It may have been removed.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
  };
})();
