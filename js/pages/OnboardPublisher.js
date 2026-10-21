function OnboardPublisherPage() {
  usePageMeta('Add Publisher', [{ label: 'Publishers', to: '/publishers' }, { label: 'Add Publisher' }]);
  const initial = useMemo(() => createEmptyPublisher(), []);
  if (!can('publisher.edit')) return html`<${NoPermission} what="add publishers" back="/publishers" />`;
  return html`<div className="page page-form">
    <${PublisherForm} mode="create" initial=${initial}
      onSaved=${(p) => navigate(`/publishers/${p.id}`)} onCancel=${() => navigate('/publishers')} />
  </div>`;
}

function EditPublisherPage({ params, query }) {
  const { data: publisher, loading } = useQuery(() => publisherService.get(params.id), [params.id]);
  usePageMeta(publisher ? `Edit ${publisher.publisherName}` : 'Edit Publisher', [
    { label: 'Publishers', to: '/publishers' },
    { label: publisher ? publisher.publisherName : 'Publisher', to: `/publishers/${params.id}` },
    { label: 'Edit' },
  ]);
  // Load once: later background refreshes must not overwrite what the user is typing.
  const [frozen, setFrozen] = useState(null);
  useEffect(() => { if (publisher && !frozen) setFrozen(publisher); }, [publisher]);

  if (!can('publisher.edit') && !can('bank.edit')) return html`<${NoPermission} what="edit publishers" back=${`/publishers/${params.id}`} />`;
  if (loading && !frozen) return html`<div className="page"><${CenterSpinner} /></div>`;
  if (!publisher && !frozen) {
    return html`<div className="page"><${EmptyState} icon="building" title="Publisher not found" description="It may have been removed."
      action=${html`<${Link} to="/publishers" className="btn btn-primary">Back to Publishers</${Link}>`} /></div>`;
  }
  if (!frozen) return null;
  return html`<div className="page page-form">
    <${PublisherForm} mode="edit" initial=${frozen} initialTab=${PUBLISHER_TABS.some((t) => t.id === query.tab) ? query.tab : 'basic'}
      onSaved=${(p) => navigate(`/publishers/${p.id}`)} onCancel=${() => navigate(`/publishers/${frozen.id}`)} />
  </div>`;
}

/* Shown instead of a screen the current role may not use. */
function NoPermission({ what, back }) {
  usePageMeta('Not available', []);
  return html`<div className="page"><section className="card"><${EmptyState} icon="lock" title="Your role cannot do this"
    description=${`Your role (${currentUser.role()}) is not allowed to ${what}. Ask an Admin if you need access.`}
    action=${html`<${Link} to=${back} className="btn btn-secondary"><${Icon} name="arrowLeft" size=${15} /> Go back</${Link}>`} /></section></div>`;
}
