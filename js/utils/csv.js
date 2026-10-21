/* CSV export. Opens cleanly in Excel (UTF-8 with a byte-order mark) and
   defuses cells that start with = + - @ so they cannot run as spreadsheet formulas. */

function csvCell(value) {
  let s = value == null ? '' : String(value);
  const harmless = /^-?\d+(\.\d+)?$/.test(s) || /^\+\d[\d\s\-()]{6,}$/.test(s); // plain numbers and phone numbers
  if (/^[=+\-@\t\r]/.test(s) && !harmless) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** columns: [{ header, value(row) }]  ->  CSV text. */
function toCsv(columns, rows) {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  rows.forEach((r) => lines.push(columns.map((c) => csvCell(c.value(r))).join(',')));
  return lines.join('\r\n');
}

function downloadCsv(filename, columns, rows) {
  const blob = new Blob(['﻿' + toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
