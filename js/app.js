/* App shell, routing and bootstrap. */
const ROUTES = [
  { path: '/', page: DashboardPage },
  { path: '/publishers', page: PublishersPage },
  { path: '/publishers/new', page: OnboardPublisherPage },
  { path: '/publishers/:id/edit', page: EditPublisherPage },
  { path: '/publishers/:id', page: PublisherProfilePage },
  { path: '/campaigns', page: CampaignsPage },
  { path: '/campaigns/new', page: NewCampaignPage },
  { path: '/campaigns/:id/edit', page: EditCampaignPage },
  { path: '/campaigns/:id', page: CampaignDetailPage },
  { path: '/documents', page: DocumentsPage },
  { path: '/documents/new', page: CreateDocumentPage },
  { path: '/documents/:id/edit', page: EditDocumentPage },
  { path: '/documents/:id', page: DocumentDetailPage },
  { path: '/reports', page: ReportsPage },
  { path: '/activity', page: ActivityPage },
  { path: '/settings', page: SettingsPage },
];

function NotFoundPage() {
  usePageMeta('Page not found', []);
  return html`<div className="page"><section className="card"><${EmptyState} icon="search" title="Page not found" description="The page you are looking for does not exist."
    action=${html`<${Link} to="/" className="btn btn-primary">Go to Dashboard</${Link}>`} /></section></div>`;
}

/* A crash in one page should never leave a blank screen. */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return html`<div className="page"><section className="card"><${EmptyState} icon="alert" title="Something went wrong on this page"
      description=${String(this.state.error.message || this.state.error)}
      action=${html`<a className="btn btn-primary" href="#/" onClick=${() => this.setState({ error: null })}>Back to Dashboard</a>`} /></section></div>`;
  }
}

function App() {
  const route = useRoute();
  const [navOpen, setNavOpen] = useState(false);
  const [role, setRole] = useState(currentUser.role());
  let match = null;
  for (const r of ROUTES) {
    const params = matchRoute(r.path, route.path);
    if (params) { match = { ...r, params }; break; }
  }
  const Page = match ? match.page : NotFoundPage;

  useEffect(() => { window.scrollTo(0, 0); setNavOpen(false); }, [route.path]);
  // When the test-mode role changes, rebuild the screen so every button reflects what that role may do.
  useEffect(() => storageService.subscribe((key) => { if (key === 'role') setRole(currentUser.role()); }), []);

  return html`<div className="app">
    <a className="skip-link" href="#content" onClick=${(e) => { e.preventDefault(); const el = document.getElementById('content'); if (el) el.focus(); }}>Skip to content</a>
    <${Sidebar} path=${route.path} open=${navOpen} onClose=${() => setNavOpen(false)} />
    <div className="main">
      <${Topbar} onMenu=${() => setNavOpen(true)} />
      ${!storageService.isPersistent() && html`<div className="banner-warn"><${Icon} name="alert" size=${15} /> Your browser is blocking storage, so changes will be lost when you refresh or close this tab.</div>`}
      <main className="content" id="content" tabIndex="-1">
        <${ErrorBoundary} key=${route.path + JSON.stringify(route.query) + role}>
          <${Page} params=${match ? match.params : {}} query=${route.query} />
        <//>
      </main>
    </div>
    <${ToastHost} />
    <${ConfirmHost} />
    <${CommentHost} />
    <${PdfPreviewHost} />
  </div>`;
}

seedService.bootstrap();
ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
const boot = document.getElementById('boot');
if (boot) boot.remove();
