/* React hooks that bridge the UI to the (async) service layer. */

/** Run an async service call and re-run it whenever stored data changes. */
function useQuery(fn, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => storageService.subscribe(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    let live = true;
    Promise.resolve()
      .then(fn)
      .then((data) => live && setState({ data, loading: false, error: null }))
      .catch((error) => { console.error(error); if (live) setState((s) => ({ ...s, loading: false, error })); });
    return () => { live = false; };
    // eslint-disable-next-line
  }, [...deps, tick]);
  return state;
}

/** Publishers + campaigns + documents + settings, the bundle most pages need. `undefined` while loading. */
function usePortalData() {
  return useQuery(async () => {
    const [publishers, campaigns, documents, settings] = await Promise.all([publisherService.list(), campaignService.list(), documentService.list(), settingsService.get()]);
    return { publishers, campaigns, documents, settings };
  }).data;
}

/**
 * Wrap a user action with loading / success / error toasts.
 *   const { ok, result } = await runAction({ loading: 'Saving…', success: 'Saved.' }, () => service.save());
 */
async function runAction({ loading, success, error = 'Something went wrong. Please try again.' }, fn) {
  const id = toast.loading(loading);
  try {
    const [result] = await Promise.all([fn(), sleep(250)]); // keep the "in progress" state visible briefly
    toast.success(typeof success === 'function' ? success(result) : success, id);
    return { ok: true, result };
  } catch (e) {
    console.error(e);
    toast.error(e && e.message ? e.message : error, id);
    return { ok: false, error: e };
  }
}

/* Page title + breadcrumb, shown in the top bar. */
const pageMeta = { value: { title: '', crumbs: [] }, listeners: new Set() };

function usePageMeta(title, crumbs = []) {
  const key = title + JSON.stringify(crumbs);
  useEffect(() => {
    pageMeta.value = { title, crumbs };
    pageMeta.listeners.forEach((f) => f());
    document.title = title ? `${title} · Vendor Portal` : 'Vendor Portal';
    // eslint-disable-next-line
  }, [key]);
}

function usePageMetaValue() {
  const [v, setV] = useState(pageMeta.value);
  useEffect(() => {
    const f = () => setV(pageMeta.value);
    pageMeta.listeners.add(f);
    f();
    return () => pageMeta.listeners.delete(f);
  }, []);
  return v;
}

/** After a failed submit: bring the first invalid field into view. */
function scrollToFirstError() {
  setTimeout(() => {
    const el = document.querySelector('[data-error="true"]');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = el.querySelector('input,select,textarea,button');
    if (input) input.focus({ preventScroll: true });
  }, 40);
}
