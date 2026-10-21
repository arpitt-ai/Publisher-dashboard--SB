/* Compliance document upload UI.
   <ComplianceDocuments> is controlled: it shows `docs`, and calls `onChange(nextDocs)` when the user
   uploads / replaces / deletes. The parent decides when to persist (staged in the onboarding form,
   immediately on the publisher profile). Files themselves go through fileService only. */

/* Hidden <input type=file> + drag & drop wiring. */
function useFilePicker(onFiles, { multiple = false, disabled = false } = {}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const open = () => { if (!disabled && inputRef.current) inputRef.current.click(); };
  const input = html`<input ref=${inputRef} type="file" hidden multiple=${multiple} accept=${FILE_RULES.accept}
    onChange=${(e) => { const files = [...e.target.files]; e.target.value = ''; if (files.length) onFiles(files); }} />`;
  const dropProps = disabled ? {} : {
    onDragOver: (e) => { e.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: (e) => { e.preventDefault(); setDragging(false); const files = [...e.dataTransfer.files]; if (files.length) onFiles(multiple ? files : files.slice(0, 1)); },
  };
  return { open, input, dropProps, dragging };
}

function FilePreviewModal({ doc, onClose }) {
  const [state, setState] = useState({ loading: true, url: null });
  useEffect(() => {
    let url;
    let live = true;
    fileService.getFile(doc.fileId).then((blob) => {
      if (!live) return;
      if (!blob) return setState({ loading: false, url: null });
      url = URL.createObjectURL(blob);
      setState({ loading: false, url });
    });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [doc.fileId]);
  const isPdf = doc.mimeType === 'application/pdf';
  return html`<${Modal} title=${doc.fileName} subtitle=${`${COMPLIANCE_BY_CODE[doc.type]?.label || 'Document'} · ${fmtBytes(doc.size)}`} width=${860} onClose=${onClose}
    footer=${html`<button type="button" className="btn btn-secondary" onClick=${onClose}>Close</button>
      <button type="button" className="btn btn-primary" onClick=${() => downloadComplianceDoc(doc)}><${Icon} name="download" size=${15} /> Download</button>`}>
    ${state.loading ? html`<div className="preview-box"><span className="spinner"></span></div>`
      : !state.url ? html`<div className="preview-box"><${EmptyState} compact icon="alert" title="This file is no longer available" description="It may have been removed from browser storage. Upload it again to restore it." /></div>`
      : isPdf ? html`<iframe className="preview-frame" src=${state.url} title=${doc.fileName}></iframe>`
      : html`<div className="preview-box"><img className="preview-img" src=${state.url} alt=${doc.fileName} /></div>`}
  <//>`;
}

async function downloadComplianceDoc(doc) {
  try { await fileService.downloadFile(doc.fileId, doc.fileName); }
  catch (e) { toast.error(e.message || 'Could not download the file.'); }
}

/* View · Download · Replace · Delete for one uploaded file. */
function FileActions({ doc, onView, onReplace, onDelete, readOnly, compact }) {
  const b = (icon, label, fn, danger) => html`<button type="button" className=${(compact ? 'icon-btn' : 'btn btn-sm btn-secondary') + (danger ? (compact ? ' icon-btn-danger' : ' btn-danger-ghost') : '')}
    title=${label} aria-label=${label} onClick=${fn}><${Icon} name=${icon} size=${14} />${!compact && html`<span>${label}</span>`}</button>`;
  return html`<div className="file-actions">
    ${b('eye', 'View', onView)}
    ${b('download', 'Download', () => downloadComplianceDoc(doc))}
    ${!readOnly && b('replace', 'Replace', onReplace)}
    ${!readOnly && b('trash', 'Delete', onDelete, true)}
  </div>`;
}

function UploadedMeta({ doc }) {
  return html`<div className="file-meta">
    <div className="file-name" title=${doc.fileName}><${Icon} name=${doc.mimeType === 'application/pdf' ? 'file' : 'image'} size=${15} /> <span>${doc.fileName}</span> <span className="file-size">${fmtBytes(doc.size)}</span></div>
    <div className="file-by">Uploaded by ${actorName(doc.uploadedBy)} · ${fmtDate(doc.uploadedAt)}</div>
  </div>`;
}

/* ── Dedicated, prominent MSME certificate block ─────────────── */
function MsmeCard({ doc, onUpload, onView, onDelete, msmeRegistered, readOnly, busy }) {
  const picker = useFilePicker((files) => onUpload(files[0]), { disabled: readOnly || busy });
  if (doc) {
    return html`<div className="msme-card is-done">
      ${picker.input}
      <div className="msme-head"><span className="msme-title">MSME / UDYAM CERTIFICATE</span></div>
      <div className="msme-done"><span className="done-mark"><${Icon} name="check" size=${16} strokeWidth=${2.4} /></span><strong>MSME Certificate Uploaded</strong></div>
      <${UploadedMeta} doc=${doc} />
      <${FileActions} doc=${doc} onView=${onView} onReplace=${picker.open} onDelete=${onDelete} readOnly=${readOnly} />
    </div>`;
  }
  return html`<div className=${'msme-card dropzone' + (picker.dragging ? ' is-dragging' : '') + (msmeRegistered ? ' is-needed' : '')} ...${picker.dropProps}>
    ${picker.input}
    <div className="msme-title">MSME / UDYAM CERTIFICATE</div>
    ${busy ? html`<div className="dz-busy"><span className="spinner"></span> Uploading certificate…</div>` : html`
      <div className="dz-text">Drag & drop certificate here</div>
      <div className="dz-or">or</div>
      ${!readOnly && html`<button type="button" className="btn btn-primary" onClick=${picker.open}><${Icon} name="upload" size=${15} /> Upload Certificate</button>`}
      <div className="dz-types">PDF, JPG, JPEG, PNG</div>
      ${msmeRegistered && html`<div className="dz-note"><${Icon} name="alert" size=${13} /> This publisher is MSME-registered — the certificate is required for compliance.</div>`}`}
  </div>`;
}

/* ── One slot for a single-file document type ───────────────── */
function SlotCard({ type, doc, onUpload, onView, onDelete, readOnly, busy }) {
  const picker = useFilePicker((files) => onUpload(files[0]), { disabled: readOnly || busy });
  return html`<div className=${'slot' + (doc ? ' is-done' : '') + (picker.dragging ? ' is-dragging' : '')} ...${doc ? {} : picker.dropProps}>
    ${picker.input}
    <div className="slot-head">
      <span className="slot-title">${type.label}</span>
      ${doc ? html`<${StatusBadge} status="Uploaded" />` : html`<${StatusBadge} status="Missing" />`}
    </div>
    ${doc
      ? html`<${UploadedMeta} doc=${doc} /><${FileActions} compact doc=${doc} onView=${onView} onReplace=${picker.open} onDelete=${onDelete} readOnly=${readOnly} />`
      : busy ? html`<div className="dz-busy"><span className="spinner spinner-sm"></span> Uploading…</div>`
      : html`<div className="slot-empty">${readOnly ? 'Not uploaded' : html`<button type="button" className="btn btn-sm btn-secondary" onClick=${picker.open}><${Icon} name="upload" size=${14} /> Upload</button><span>or drop a file</span>`}</div>`}
  </div>`;
}

/* ── Other supporting documents (multiple allowed) ──────────── */
function OtherDocs({ type, docs, onUpload, onView, onDelete, readOnly, busy }) {
  const picker = useFilePicker((files) => files.forEach((f) => onUpload(f)), { multiple: true, disabled: readOnly || busy });
  return html`<div className=${'slot slot-wide' + (picker.dragging ? ' is-dragging' : '')} ...${picker.dropProps}>
    ${picker.input}
    <div className="slot-head">
      <span className="slot-title">${type.label}</span>
      ${!readOnly && html`<button type="button" className="btn btn-sm btn-secondary" onClick=${picker.open} disabled=${busy}><${Icon} name="plus" size=${14} /> Add document</button>`}
    </div>
    ${docs.length === 0
      ? html`<div className="slot-empty"><span>${busy ? 'Uploading…' : 'No supporting documents added'}</span></div>`
      : html`<ul className="other-list">${docs.map((d) => html`<li key=${d.id}><${UploadedMeta} doc=${d} />
          <${FileActions} compact doc=${d} onView=${() => onView(d)} onReplace=${() => {}} onDelete=${() => onDelete(d)} readOnly=${true} />
          ${!readOnly && html`<button type="button" className="icon-btn icon-btn-danger" title="Delete" aria-label="Delete" onClick=${() => onDelete(d)}><${Icon} name="trash" size=${14} /></button>`}
        </li>`)}</ul>`}
  </div>`;
}

function ComplianceDocuments({ docs, onChange, onFileUploaded, msmeRegistered = false, readOnly = false, staged = false, onlyMsme = false }) {
  const [busy, setBusy] = useState(null);
  const [viewing, setViewing] = useState(null);
  const byType = (code) => docs.filter((d) => d.type === code);

  async function upload(typeCode, file) {
    const err = fileService.validate(file);
    if (err) { toast.error(err); return; }
    const type = COMPLIANCE_BY_CODE[typeCode];
    setBusy(typeCode);
    const { ok, result: meta } = await runAction(
      {
        loading: typeCode === 'MSME' ? 'Uploading MSME certificate...' : `Uploading ${type.short}...`,
        success: typeCode === 'MSME' ? 'Certificate uploaded successfully.' : `${type.short} uploaded successfully.`,
        error: 'Upload failed. Please try again.',
      },
      () => fileService.uploadFile(file),
    );
    setBusy(null);
    if (!ok) return;
    if (onFileUploaded) onFileUploaded(meta.id);
    const entry = {
      id: uid('cd_'), type: typeCode, fileId: meta.id, fileName: meta.fileName, mimeType: meta.mimeType, size: meta.size,
      status: 'Uploaded', uploadedAt: meta.uploadedAt, uploadedBy: meta.uploadedBy,
    };
    // read the latest list at call time so several quick uploads do not overwrite each other
    latest.current = type.single ? [...latest.current.filter((d) => d.type !== typeCode), entry] : [...latest.current, entry];
    await onChange(latest.current);
  }

  async function remove(doc) {
    const ok = await confirmDialog({
      title: 'Delete document?',
      message: `“${doc.fileName}” will be removed${staged ? ' when you save this publisher' : ' from this publisher'}. This cannot be undone.`,
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    latest.current = latest.current.filter((d) => d.id !== doc.id);
    await onChange(latest.current);
    toast.success('Document deleted.');
  }

  const latest = useRef(docs);
  latest.current = docs;

  const others = COMPLIANCE_BY_CODE.OTHER;
  const msmeCard = html`<${MsmeCard} doc=${byType('MSME')[0]} busy=${busy === 'MSME'} readOnly=${readOnly} msmeRegistered=${msmeRegistered}
      onUpload=${(f) => upload('MSME', f)} onView=${() => setViewing(byType('MSME')[0])} onDelete=${() => remove(byType('MSME')[0])} />`;
  if (onlyMsme) {
    return html`<div className="compliance">${msmeCard}${viewing && html`<${FilePreviewModal} doc=${viewing} onClose=${() => setViewing(null)} />`}</div>`;
  }
  return html`<div className="compliance">
    ${msmeCard}
    <div className="slot-grid">
      ${COMPLIANCE_TYPES.filter((t) => t.single && t.code !== 'MSME').map((t) => html`<${SlotCard} key=${t.code} type=${t} doc=${byType(t.code)[0]} busy=${busy === t.code} readOnly=${readOnly}
        onUpload=${(f) => upload(t.code, f)} onView=${() => setViewing(byType(t.code)[0])} onDelete=${() => remove(byType(t.code)[0])} />`)}
    </div>
    <${OtherDocs} type=${others} docs=${byType('OTHER')} busy=${busy === 'OTHER'} readOnly=${readOnly}
      onUpload=${(f) => upload('OTHER', f)} onView=${setViewing} onDelete=${remove} />
    ${viewing && html`<${FilePreviewModal} doc=${viewing} onClose=${() => setViewing(null)} />`}
  </div>`;
}
