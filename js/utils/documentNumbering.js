/* Document numbering helpers (pure functions).
   The permanent counters live in documentService — numbers never depend on
   array length, so archiving/removing a record can never cause a re-use. */

const DEFAULT_NUMBERING = { pattern: '{TYPE}-{YEAR}-{SEQ}', padding: 3 };

const counterKey = (type, year) => `${type}-${year}`;

function formatDocumentNumber(type, year, seq, cfg = DEFAULT_NUMBERING) {
  return (cfg.pattern || DEFAULT_NUMBERING.pattern)
    .replace('{TYPE}', type)
    .replace('{YEAR}', String(year))
    .replace('{SEQ}', String(seq).padStart(cfg.padding || DEFAULT_NUMBERING.padding, '0'));
}

/** Parses a number in the default format, e.g. "RO-2026-014" -> { type, year, seq }. */
function parseDocumentNumber(str = '') {
  const m = /^([A-Z]{2,4})-(\d{4})-(\d+)$/.exec(str);
  return m ? { type: m[1], year: Number(m[2]), seq: Number(m[3]) } : null;
}
