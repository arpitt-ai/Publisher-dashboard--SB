/* Field-level change tracking. Returns [{ field, label, from, to }] for every
   labelled field whose value changed. Sensitive values are masked so the
   audit log never stores/display a full account number. */

function displayValue(field, v) {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  if (v == null || v === '') return '—';
  if (SENSITIVE_FIELDS.includes(field)) return maskAccount(String(v));
  return String(v);
}

function diffFields(before, after, labels) {
  const changes = [];
  for (const field of Object.keys(labels)) {
    const a = getPath(before || {}, field);
    const b = getPath(after || {}, field);
    const na = a == null ? '' : a;
    const nb = b == null ? '' : b;
    if (String(na).trim() !== String(nb).trim()) {
      changes.push({ field, label: labels[field], from: displayValue(field, a), to: displayValue(field, b) });
    }
  }
  return changes;
}
