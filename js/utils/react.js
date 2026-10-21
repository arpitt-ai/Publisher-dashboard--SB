/* Shared React aliases. Every script below this one can use these globals.
   JSX-like templates are written with htm's tagged template: html`<div>…</div>`
   (no build step needed, so the app still opens with a double-click). */
const {
  useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useDeferredValue, Fragment,
} = React;
const _htm = htm.bind(React.createElement);
/* htm returns an array when a template has several sibling roots; React would then demand keys.
   Wrapping those in a Fragment (children passed positionally) keeps the templates simple. */
const html = (...args) => {
  const out = _htm(...args);
  return Array.isArray(out) ? React.createElement(Fragment, null, ...out) : out;
};

const uid = (prefix = '') =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const setPath = (obj, path, value) => {
  const keys = path.split('.');
  const next = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = next;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...(cur[keys[i]] || {}) };
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return next;
};
