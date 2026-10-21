/* Shared document actions used by the Orders & Documents list, the dashboard and the document page:
   change status (asking for a reason when needed), preview / download the PDF, duplicate, archive. */

/* ── "Add a reason" dialog (promise based, like confirmDialog) ── */
const commentStore = { current: null, listeners: new Set() };
/** askComment({ title, message, required, confirmLabel, danger }) -> Promise<string | null>  (null = cancelled) */
function askComment(opts) {
  return new Promise((resolve) => {
    commentStore.current = { ...opts, resolve };
    commentStore.listeners.forEach((f) => f(commentStore.current));
  });
}

function CommentHost() {
  const [req, setReq] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const f = (r) => { setText(''); setError(''); setReq(r); };
    commentStore.listeners.add(f);
    return () => commentStore.listeners.delete(f);
  }, []);
  if (!req) return null;
  const close = (value) => { req.resolve(value); commentStore.current = null; setReq(null); };
  const submit = () => {
    if (req.required && !text.trim()) { setError('Please write a short reason.'); return; }
    close(text.trim());
  };
  return html`<${Modal} title=${req.title} width=${480} onClose=${() => close(null)}
    footer=${html`<button type="button" className="btn btn-secondary" onClick=${() => close(null)}>Go back</button>
      <button type="button" className=${'btn ' + (req.danger ? 'btn-danger' : 'btn-primary')} onClick=${submit}>${req.confirmLabel || 'Confirm'}</button>`}>
    ${req.message && html`<p className="modal-text">${req.message}</p>`}
    <div className="field" data-error=${error ? 'true' : undefined} style=${{ marginTop: 12 }}>
      <label className="label" htmlFor="comment-box">${req.required ? 'Reason' : 'Comment (optional)'}${req.required && html`<span className="req"> *</span>`}</label>
      <textarea id="comment-box" className=${'input textarea' + (error ? ' has-error' : '')} rows="3" autoFocus value=${text}
        placeholder=${req.placeholder || ''} onChange=${(e) => { setText(e.target.value); setError(''); }}></textarea>
      ${error && html`<div className="field-error" role="alert"><${Icon} name="alert" size=${12} /><span>${error}</span></div>`}
    </div>
  <//>`;
}

/* ── PDF preview dialog ── */
const pdfPreviewStore = { current: null, listeners: new Set() };
function openPdfPreview(doc) {
  pdfPreviewStore.current = doc;
  pdfPreviewStore.listeners.forEach((f) => f(doc));
}

function PdfPreviewHost() {
  const [doc, setDoc] = useState(null);
  const [state, setState] = useState({ url: null, error: null });
  useEffect(() => {
    const f = (d) => setDoc(d);
    pdfPreviewStore.listeners.add(f);
    return () => pdfPreviewStore.listeners.delete(f);
  }, []);
  useEffect(() => {
    if (!doc) return undefined;
    let live = true;
    let url = null;
    setState({ url: null, error: null });
    pdfService.build(doc)
      .then((pdf) => { url = URL.createObjectURL(pdf.output('blob')); if (live) setState({ url, error: null }); else URL.revokeObjectURL(url); })
      .catch((e) => { console.error(e); if (live) setState({ url: null, error: e.message || 'Could not build the PDF.' }); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [doc]);
  if (!doc) return null;
  const close = () => { pdfPreviewStore.current = null; setDoc(null); };
  return html`<${Modal} title=${`${doc.documentNumber} · PDF preview`} width=${900} onClose=${close}
    footer=${html`<button type="button" className="btn btn-secondary" onClick=${close}>Close</button>
      <button type="button" className="btn btn-primary" onClick=${() => documentActions.download(doc)}><${Icon} name="download" size=${15} /> Download PDF</button>`}>
    ${state.error ? html`<div className="notice notice-warn"><${Icon} name="alert" size=${16} /><div>${state.error}</div></div>`
      : !state.url ? html`<${CenterSpinner} />`
      : html`<iframe className="preview-frame" title=${`${doc.documentNumber} PDF`} src=${state.url}></iframe>`}
  <//>`;
}

/* ── Status changes ── */
const COMMENT_PROMPTS = {
  Rejected: (d) => ({ title: `Reject ${d.documentNumber}?`, message: 'It goes back to the team with your reason, so they know what to fix.', required: true, confirmLabel: 'Reject', danger: true, placeholder: 'e.g. Rate does not match the agreed rate card' }),
  Cancelled: (d) => ({ title: `Cancel ${d.documentNumber}?`, message: 'A cancelled document stays on record but can no longer be used.', required: false, confirmLabel: 'Cancel document', danger: true }),
};

/** Runs one workflow move for a document. Resolves to true when the status changed. */
async function changeDocumentStatus(doc, transition) {
  let comment = '';
  if (transition.askComment) {
    const prompt = COMMENT_PROMPTS[transition.to] ? COMMENT_PROMPTS[transition.to](doc) : { title: transition.label, required: transition.askComment === 'required', confirmLabel: 'Confirm' };
    comment = await askComment(prompt);
    if (comment === null) return false;
  }
  const { ok } = await runAction(
    { loading: 'Updating status...', success: `${doc.documentNumber} is now ${transition.to}.` },
    () => documentService.setStatus(doc.id, transition.to, { comment }),
  );
  return ok;
}

/** Status moves this person can make right now, ready for a MenuButton. */
function statusMenuItems(doc, settings, onDone, { includePrimary = false } = {}) {
  return availableTransitions(doc, { requireApproval: settings.workflow.requireApproval })
    .filter((t) => includePrimary || !t.primary)
    .map((t) => ({
      label: t.label, icon: t.danger ? 'ban' : t.to === 'Draft' ? 'edit' : 'check', danger: t.danger,
      onClick: async () => { if (await changeDocumentStatus(doc, t) && onDone) onDone(); },
    }));
}

/* ── Other document actions ── */
const documentActions = {
  preview(d) { openPdfPreview(d); },
  async download(d) {
    return runAction(
      { loading: `Preparing ${d.documentNumber}...`, success: `${d.documentNumber}.pdf downloaded.`, error: 'Could not create the PDF.' },
      () => pdfService.download(d),
    );
  },
  async duplicate(d) {
    const { ok, result } = await runAction(
      { loading: 'Duplicating document...', success: (r) => `${r.documentNumber} created from ${d.documentNumber}.` },
      () => documentService.duplicate(d.id),
    );
    if (ok) navigate(`/documents/${result.id}`);
    return ok;
  },
  async archive(d) {
    const ok = await confirmDialog({
      title: `Archive ${d.documentNumber}?`,
      message: 'It will be hidden from the document list but kept in the system. You can restore it at any time.',
      confirmLabel: 'Archive', danger: true,
    });
    if (!ok) return false;
    return (await runAction({ loading: 'Archiving document...', success: `${d.documentNumber} archived.` }, () => documentService.archive(d.id))).ok;
  },
  async restore(d) {
    return (await runAction({ loading: 'Restoring document...', success: `${d.documentNumber} restored.` }, () => documentService.restore(d.id))).ok;
  },
};

/* The one big "next step" button for a document, plus a plain-language line about where it stands. */
function NextStep({ doc, settings, onChanged }) {
  const transitions = availableTransitions(doc, { requireApproval: settings.workflow.requireApproval });
  const primary = transitions.filter((t) => t.primary);
  const [busy, setBusy] = useState(false);
  const act = async (t) => { setBusy(true); try { if (await changeDocumentStatus(doc, t) && onChanged) onChanged(t); } finally { setBusy(false); } };
  const reject = transitions.find((t) => t.to === 'Rejected');
  const edit = canEditDocument(doc);
  return html`<div className="next-step">
    <div className="next-help">${STATUS_HELP[doc.status]}</div>
    <div className="btn-row">
      ${edit && html`<${Link} to=${`/documents/${doc.id}/edit`} className="btn btn-secondary"><${Icon} name="edit" size=${15} /> Edit</${Link}>`}
      ${primary.map((t) => html`<button key=${t.to} type="button" className="btn btn-primary" disabled=${busy} onClick=${() => act(t)}><${Icon} name=${t.to === 'Approved' ? 'checkCircle' : t.to === 'Pending Approval' || t.to === 'Sent' ? 'send' : 'check'} size=${15} /> ${t.label}</button>`)}
      ${reject && html`<button type="button" className="btn btn-danger-ghost" disabled=${busy} onClick=${() => act(reject)}><${Icon} name="x" size=${15} /> Reject</button>`}
    </div>
  </div>`;
}
