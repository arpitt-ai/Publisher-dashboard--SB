/* Searchable publisher selector (name / legal entity / GSTIN). Only lists the publishers passed in,
   so the caller decides that Inactive publishers are not offered.
   `onCreate` adds an "Add a new publisher" row at the bottom of the list. */
function PublisherPicker({ publishers, onSelect, onCreate, error, autoFocus = false, placeholder = 'Search by publisher name, legal name or GSTIN…' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);
  const listId = React.useId();

  const matches = useMemo(() => {
    const list = publishers.filter((p) => matchesTerms([p.publisherName, p.legalEntityName, p.tax?.gstin].join(' '), q));
    return list.sort((a, b) => a.publisherName.localeCompare(b.publisherName)).slice(0, 50);
  }, [publishers, q]);

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (p) => { setOpen(false); setQ(''); onSelect(p); };
  const create = () => { setOpen(false); onCreate(q); setQ(''); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && matches[hi]) { e.preventDefault(); pick(matches[hi]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return html`<div className="picker" ref=${boxRef}>
    <div className=${'searchbar picker-input' + (error ? ' has-error' : '')}>
      <span className="searchbar-icon"><${Icon} name="search" size=${16} /></span>
      <input role="combobox" aria-expanded=${open} aria-controls=${listId} aria-autocomplete="list" autoFocus=${autoFocus}
        value=${q} placeholder=${placeholder} aria-label="Search publishers"
        onChange=${(e) => { setQ(e.target.value); setOpen(true); }} onFocus=${() => setOpen(true)} onKeyDown=${onKey} />
    </div>
    ${open && html`<ul className="picker-list" id=${listId} role="listbox">
      ${matches.length === 0
        ? html`<li className="picker-empty">${publishers.length === 0 ? 'No active publishers yet.' : 'No publishers match your search.'}</li>`
        : matches.map((p, i) => html`<li key=${p.id} role="option" aria-selected=${i === hi} className=${'picker-item' + (i === hi ? ' is-hi' : '')}
            onMouseEnter=${() => setHi(i)} onMouseDown=${(e) => { e.preventDefault(); pick(p); }}>
            <div className="picker-main">
              <span className="picker-name">${p.publisherName}</span>
              ${p.status !== 'Active' && html`<${StatusBadge} status=${p.status} />`}
            </div>
            <div className="picker-sub">${p.legalEntityName}${p.tax?.gstin ? ' · ' + p.tax.gstin : ''}</div>
          </li>`)}
      ${onCreate && html`<li role="option" className="picker-item picker-create" onMouseDown=${(e) => { e.preventDefault(); create(); }}>
        <span className="picker-name"><${Icon} name="plus" size=${14} /> Add a new publisher${q.trim() ? ` “${q.trim()}”` : ''}</span>
      </li>`}
    </ul>`}
  </div>`;
}

/* Client selector: pick a client you already work with, or type a new name. `clients` comes from clientDirectory(). */
function ClientPicker({ clients, onSelect, onCreate, error, autoFocus = false }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);
  const listId = React.useId();

  const matches = useMemo(() => clients.filter((c) => matchesTerms(c.name, q)).slice(0, 50), [clients, q]);
  const exact = matches.some((c) => c.key === clientKey(q));
  const canCreate = q.trim() && !exact;

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (c) => { setOpen(false); setQ(''); onSelect(c); };
  const create = () => { setOpen(false); const name = q.trim(); setQ(''); onCreate(name); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open) { e.preventDefault(); if (matches[hi]) pick(matches[hi]); else if (canCreate) create(); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return html`<div className="picker" ref=${boxRef}>
    <div className=${'searchbar picker-input' + (error ? ' has-error' : '')}>
      <span className="searchbar-icon"><${Icon} name="search" size=${16} /></span>
      <input role="combobox" aria-expanded=${open} aria-controls=${listId} aria-autocomplete="list" autoFocus=${autoFocus}
        value=${q} placeholder="Search your clients, or type a new client name…" aria-label="Search clients"
        onChange=${(e) => { setQ(e.target.value); setOpen(true); }} onFocus=${() => setOpen(true)} onKeyDown=${onKey} />
    </div>
    ${open && html`<ul className="picker-list" id=${listId} role="listbox">
      ${matches.length === 0
        ? html`<li className="picker-empty">${clients.length === 0 ? 'No clients yet. Type a name to add the first one.' : 'No clients match your search.'}</li>`
        : matches.map((c, i) => html`<li key=${c.key} role="option" aria-selected=${i === hi} className=${'picker-item' + (i === hi ? ' is-hi' : '')}
            onMouseEnter=${() => setHi(i)} onMouseDown=${(e) => { e.preventDefault(); pick(c); }}>
            <div className="picker-main"><span className="picker-name">${c.name}</span></div>
            <div className="picker-sub">${plural(c.campaigns, 'campaign')} · ${plural(c.documents, 'document')}</div>
          </li>`)}
      ${canCreate && html`<li role="option" className="picker-item picker-create" onMouseDown=${(e) => { e.preventDefault(); create(); }}>
        <span className="picker-name"><${Icon} name="plus" size=${14} /> Add a new client “${q.trim()}”</span>
      </li>`}
    </ul>`}
  </div>`;
}

/* Campaign selector: pick one of the existing campaigns, or ask to create a new one. */
function CampaignPicker({ campaigns, onSelect, onCreate, error, autoFocus = false }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);
  const listId = React.useId();

  const matches = useMemo(() => {
    const list = filterCampaigns(campaigns.filter((c) => c.status !== 'Cancelled'), { q });
    return list.slice(0, 50);
  }, [campaigns, q]);

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (c) => { setOpen(false); setQ(''); onSelect(c); };
  const create = () => { setOpen(false); onCreate(q.trim()); setQ(''); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && matches[hi]) { e.preventDefault(); pick(matches[hi]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return html`<div className="picker" ref=${boxRef}>
    <div className=${'searchbar picker-input' + (error ? ' has-error' : '')}>
      <span className="searchbar-icon"><${Icon} name="search" size=${16} /></span>
      <input role="combobox" aria-expanded=${open} aria-controls=${listId} aria-autocomplete="list" autoFocus=${autoFocus}
        value=${q} placeholder="Search your campaigns by name or client…" aria-label="Search campaigns"
        onChange=${(e) => { setQ(e.target.value); setOpen(true); }} onFocus=${() => setOpen(true)} onKeyDown=${onKey} />
    </div>
    ${open && html`<ul className="picker-list" id=${listId} role="listbox">
      ${matches.length === 0
        ? html`<li className="picker-empty">${campaigns.length === 0 ? 'No campaigns yet.' : 'No campaigns match your search.'}</li>`
        : matches.map((c, i) => html`<li key=${c.id} role="option" aria-selected=${i === hi} className=${'picker-item' + (i === hi ? ' is-hi' : '')}
            onMouseEnter=${() => setHi(i)} onMouseDown=${(e) => { e.preventDefault(); pick(c); }}>
            <div className="picker-main"><span className="picker-name">${c.name}</span><${StatusBadge} status=${c.status} /></div>
            <div className="picker-sub">${c.client}${c.startDate ? ` · ${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` : ''}</div>
          </li>`)}
      <li role="option" className="picker-item picker-create" onMouseDown=${(e) => { e.preventDefault(); create(); }}>
        <span className="picker-name"><${Icon} name="plus" size=${14} /> Create a new campaign${q.trim() ? ` “${q.trim()}”` : ''}</span>
      </li>
    </ul>`}
  </div>`;
}
