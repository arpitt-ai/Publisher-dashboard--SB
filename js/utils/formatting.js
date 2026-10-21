/* Formatting helpers (Indian number/currency conventions). */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _numFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const _inrFmt0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const _inrFmt2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toNum = (v) => {
  if (v === '' || v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** 1234567 -> 12,34,567 */
const fmtNum = (n) => _numFmt.format(toNum(n));
/** 150000 -> ₹1,50,000 ; 150000.5 -> ₹1,50,000.50 */
const fmtINR = (n) => {
  const v = toNum(n);
  return Number.isInteger(round2(v)) ? _inrFmt0.format(v) : _inrFmt2.format(v);
};
/** Always two decimals, e.g. for the money table in a PDF. */
const fmtINR2 = (n) => _inrFmt2.format(toNum(n));

const pad2 = (n) => String(n).padStart(2, '0');

/** Local YYYY-MM-DD for "today" (not UTC, so the date never shifts near midnight). */
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const nowISO = () => new Date().toISOString();

const parseDate = (v) => {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
/** 20 Sep 2026 */
const fmtDate = (v) => {
  const d = parseDate(v);
  return d ? `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—';
};
/** 3:42 PM */
const fmtTime = (v) => {
  const d = parseDate(v);
  if (!d) return '';
  const h = d.getHours();
  return `${h % 12 || 12}:${pad2(d.getMinutes())} ${h >= 12 ? 'PM' : 'AM'}`;
};
/** 20 Sep 2026, 3:42 PM */
const fmtDateTime = (v) => (parseDate(v) ? `${fmtDate(v)}, ${fmtTime(v)}` : '—');

const actorName = (a) => (a && a.name) || 'Unknown';
/** True when a record was changed meaningfully after it was created (not just seconds later). */
const wasUpdated = (r) => new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime() > 5000;
/** "Onboarded by Arpit Sharma · 20 Sep 2026" */
const attribution = (verb, actor, when, withTime) =>
  `${verb} ${actorName(actor)} · ${withTime ? fmtDateTime(when) : fmtDate(when)}`;

const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

const maskAccount = (s = '') => (s ? '•'.repeat(Math.max(0, s.length - 4)) + s.slice(-4) : '');

const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** Single-line address from the structured address object. */
const joinAddress = (a = {}) => {
  const cityLine = [a.city, a.state].filter(Boolean).join(', ') + (a.pinCode ? ` – ${a.pinCode}` : '');
  return [a.line1, a.line2, cityLine.trim(), a.country && a.country !== 'India' ? a.country : '']
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(', ');
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
const lowerFirst = (s = '') => s.charAt(0).toLowerCase() + s.slice(1);
