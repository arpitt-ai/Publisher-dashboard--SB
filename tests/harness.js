/* A very small test runner: test(name, fn), group names via test('Group › name'), and assertion helpers. */
const __tests = [];
const test = (name, fn) => __tests.push({ name, fn });

const assert = {
  ok(v, msg = 'expected a truthy value') { if (!v) throw new Error(msg); },
  equal(a, b, msg = '') { if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)} but got ${JSON.stringify(a)}`.trim()); },
  near(a, b, msg = '', eps = 0.0001) { if (Math.abs(a - b) > eps) throw new Error(`${msg} expected ≈${b} but got ${a}`.trim()); },
  deepEqual(a, b, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)} but got ${JSON.stringify(a)}`.trim()); },
  throws(fn, pattern, msg = 'expected an error') {
    try { fn(); } catch (e) { if (pattern && !pattern.test(e.message)) throw new Error(`error "${e.message}" did not match ${pattern}`); return; }
    throw new Error(msg);
  },
  async rejects(promiseOrFn, pattern, msg = 'expected an error') {
    try { await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn); } catch (e) { if (pattern && !pattern.test(e.message)) throw new Error(`error "${e.message}" did not match ${pattern}`); return; }
    throw new Error(msg);
  },
};

/* Wipes the throw-away storage area and goes back to the Admin role. */
function resetStore() {
  Object.values(COLLECTIONS).forEach((k) => storageService.remove(k));
  storageService.remove('role');
}
const asRole = (role) => storageService.set('role', role);

async function runAllTests() {
  const out = document.getElementById('results');
  let passed = 0;
  const failures = [];
  for (const t of __tests) {
    resetStore();
    const li = document.createElement('li');
    try {
      await t.fn();
      passed += 1;
      li.className = 'ok';
      li.textContent = t.name;
    } catch (e) {
      failures.push({ name: t.name, error: e.message });
      li.className = 'bad';
      li.textContent = t.name;
      const pre = document.createElement('pre');
      pre.textContent = (e && e.stack) || String(e);
      li.appendChild(pre);
    }
    out.appendChild(li);
  }
  resetStore();
  const summary = document.getElementById('summary');
  summary.textContent = `${passed} passed, ${failures.length} failed (${__tests.length} tests)`;
  summary.className = failures.length ? 'fail' : 'pass';
  window.__TEST_RESULTS = { total: __tests.length, passed, failed: failures.length, failures };
}
