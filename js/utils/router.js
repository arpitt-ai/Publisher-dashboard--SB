/* Minimal hash router (works from file:// and supports back/forward + deep links). */

function parseRoute() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = {};
  new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
  return { path: path.length > 1 ? path.replace(/\/+$/, '') : path, query };
}

function navigate(to, { replace = false } = {}) {
  if (replace) window.location.replace('#' + to);
  else window.location.hash = to;
}

const buildUrl = (path, query = {}) => {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString();
  return qs ? `${path}?${qs}` : path;
};

/** matchRoute('/publishers/:id/edit', '/publishers/abc/edit') -> { id: 'abc' } | null */
function matchRoute(pattern, path) {
  const pp = pattern.split('/').filter(Boolean);
  const ap = path.split('/').filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(ap[i]);
    else if (pp[i] !== ap[i]) return null;
  }
  return params;
}

function useRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const onChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

function Link({ to, className, children, title, ...rest }) {
  return html`<a href=${'#' + to} className=${className} title=${title} ...${rest}>${children}</a>`;
}
