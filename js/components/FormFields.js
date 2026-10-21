/* Form building blocks. Inputs take the plain value in onChange (not the event). */

function Field({ label, required = false, error, hint, className = '', children, name, htmlFor }) {
  return html`<div className=${'field ' + className} data-error=${error ? 'true' : undefined} data-field=${name}>
    ${label && html`<label className="label" htmlFor=${htmlFor}>${label}${required && html`<span className="req" title="Required"> *</span>`}</label>`}
    ${children}
    ${error
      ? html`<div className="field-error" role="alert"><${Icon} name="alert" size=${12} /><span>${error}</span></div>`
      : hint ? html`<div className="hint">${hint}</div>` : null}
  </div>`;
}

function TextField({ label, value, onChange, onBlur, error, required, placeholder, type = 'text', hint, className, name, prefix, suffix, inputMode, maxLength, disabled, readOnly, autoFocus, transform, autoComplete = 'off', min }) {
  const id = React.useId();
  const input = html`<input id=${id} className=${'input' + (error ? ' has-error' : '') + (readOnly ? ' is-readonly' : '')} type=${type} value=${value ?? ''} placeholder=${placeholder}
    inputMode=${inputMode} maxLength=${maxLength} min=${min} disabled=${disabled} readOnly=${readOnly} autoFocus=${autoFocus} autoComplete=${autoComplete}
    aria-invalid=${error ? 'true' : undefined}
    onChange=${(e) => onChange(transform ? transform(e.target.value) : e.target.value)} onBlur=${onBlur} />`;
  return html`<${Field} label=${label} required=${required} error=${error} hint=${hint} className=${className} name=${name} htmlFor=${id}>
    ${prefix || suffix
      ? html`<div className=${'input-group' + (error ? ' has-error' : '')}>${prefix && html`<span className="affix">${prefix}</span>`}${input}${suffix && html`<span className="affix">${suffix}</span>`}</div>`
      : input}
  <//>`;
}

function SelectField({ label, value, onChange, options, error, required, placeholder, hint, className, name, disabled, onBlur }) {
  const id = React.useId();
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  return html`<${Field} label=${label} required=${required} error=${error} hint=${hint} className=${className} name=${name} htmlFor=${id}>
    <select id=${id} className=${'input select' + (error ? ' has-error' : '')} value=${value ?? ''} disabled=${disabled} onBlur=${onBlur}
      aria-invalid=${error ? 'true' : undefined} onChange=${(e) => onChange(e.target.value)}>
      ${placeholder !== undefined && html`<option value="">${placeholder}</option>`}
      ${opts.map((o) => html`<option key=${o.value} value=${o.value}>${o.label}</option>`)}
    </select>
  <//>`;
}

function TextAreaField({ label, value, onChange, error, required, placeholder, hint, className, name, rows = 3, maxLength }) {
  const id = React.useId();
  return html`<${Field} label=${label} required=${required} error=${error} hint=${hint} className=${className} name=${name} htmlFor=${id}>
    <textarea id=${id} className=${'input textarea' + (error ? ' has-error' : '')} rows=${rows} value=${value ?? ''} placeholder=${placeholder} maxLength=${maxLength}
      onChange=${(e) => onChange(e.target.value)}></textarea>
  <//>`;
}

/* Yes / No style segmented control. */
function Segmented({ label, value, onChange, options, className, hint, name }) {
  return html`<${Field} label=${label} className=${className} hint=${hint} name=${name}>
    <div className="segmented" role="radiogroup" aria-label=${label}>
      ${options.map((o) => html`<button key=${String(o.value)} type="button" role="radio" aria-checked=${value === o.value}
        className=${'seg' + (value === o.value ? ' is-active' : '')} onClick=${() => onChange(o.value)}>${o.label}</button>`)}
    </div>
  <//>`;
}

function CheckField({ label, checked, onChange }) {
  return html`<label className="check"><input type="checkbox" checked=${checked} onChange=${(e) => onChange(e.target.checked)} /><span>${label}</span></label>`;
}

/* A titled card that groups related fields. */
function FormSection({ title, description, badge, children, id }) {
  return html`<section className="card form-section" id=${id}>
    <header className="card-header">
      <div>
        <h2 className="card-title">${title}</h2>
        ${description && html`<p className="card-desc">${description}</p>`}
      </div>
      ${badge}
    </header>
    <div className="card-body">${children}</div>
  </section>`;
}

/* Read-only label/value pair (profile, preview). */
function KV({ label, children, mono = false, wide = false }) {
  const empty = children == null || children === '' || children === false;
  return html`<div className=${'kv' + (wide ? ' kv-wide' : '')}>
    <dt>${label}</dt>
    <dd className=${(mono ? 'mono ' : '') + (empty ? 'is-empty' : '')}>${empty ? '—' : children}</dd>
  </div>`;
}
