function SearchBar({ value, onChange, placeholder = 'Search…', className = '', autoFocus = false }) {
  return html`<div className=${'searchbar ' + className}>
    <span className="searchbar-icon"><${Icon} name="search" size=${16} /></span>
    <input type="search" value=${value} onChange=${(e) => onChange(e.target.value)} placeholder=${placeholder} autoFocus=${autoFocus} aria-label=${placeholder} />
    ${value && html`<button className="searchbar-clear" aria-label="Clear search" onClick=${() => onChange('')}><${Icon} name="x" size=${14} /></button>`}
  </div>`;
}
