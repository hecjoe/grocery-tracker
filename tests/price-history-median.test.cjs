const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = require('./fixtures/price-history/median.json');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const logic = html.match(/\/\/ PRICE HISTORY LOGIC START([\s\S]*?)\/\/ PRICE HISTORY LOGIC END/)[1];
const compare = new Function(logic + '; return comparePriceHistory;')();
const record = prices => ({ itemNumber: '1234567', name: 'Organic Milk', history: prices.map((price, i) => ({ date: new Date(Date.UTC(2026, 0, i + 1)).toISOString(), price })) });
for (const fixture of fixtures) {
  test(`median: ${fixture.case}`, () => {
    const stored = record(fixture.history);
    const before = structuredClone(stored);
    assert.deepEqual(compare(stored, { ...stored, price: fixture.price }), fixture.expected);
    assert.deepEqual(stored, before, 'comparison must leave existing history untouched');
  });
}

// Run the actual scan/save functions with an instrumented IndexedDB transaction.
// Observe calculation, UI publication and write order, not just the final delta.
test('scan calculates and renders the full delta BEFORE appending its price', async () => {
  const stored = record([12.99, 12.99]);
  const events = [];
  let written;
  const transaction = {
    objectStore() { return {
      get() {
        const request = { result: structuredClone(stored) };
        queueMicrotask(() => { request.onsuccess(); transaction.oncomplete(); });
        return request;
      },
      put(value) { events.push('append'); written = value; }
    }; }
  };
  const tripScans = [];
  const source = html.slice(html.indexOf('    async function savePriceScan('), html.indexOf('    function toggleTripHistory('));
  const run = new Function('openPriceHistory', 'comparePriceHistory', 'tripScans', 'renderTripHistory', 'document',
    source + '; return trackPriceScan;')(
      async () => ({ transaction: () => transaction }),
      (history, scan) => {
        events.push('compare');
        assert.deepEqual(history.history, stored.history, 'only pre-scan entries reach comparison');
        return compare(history, scan);
      }, tripScans,
      () => { if (tripScans[0].delta === 3) events.push('display'); },
      { getElementById() { return {}; } }
    );
  await run({ itemNumber: stored.itemNumber, name: stored.name, price: 15.99 });
  assert.ok(events.indexOf('compare') < events.indexOf('display'), JSON.stringify(events));
  assert.ok(events.indexOf('display') < events.indexOf('append'), JSON.stringify(events));
  assert.deepEqual(written.history.map(entry => entry.price), [12.99, 12.99, 15.99]);
});

test('deleting a recent entry brings the next surviving price into the last-three window', () => {
  const stored = record([10, 10, 20, 20]);
  const scan = { ...stored, price: 20 };
  assert.equal(compare(stored, scan).delta, 0);
  stored.history.splice(3, 1);
  assert.equal(compare(stored, scan).delta, 10);
  stored.history.splice(2, 1);
  assert.equal(compare(stored, scan).delta, 10);
  stored.history.splice(1, 1);
  assert.equal(compare(stored, scan).delta, 10);
  stored.history.splice(0, 1);
  assert.deepEqual(compare(stored, scan), { status: 'new', delta: null });
});

test('last three means newest dates, without reordering stored history', () => {
  const stored = record([1, 10, 12, 14]);
  stored.history.reverse();
  const before = structuredClone(stored);
  assert.equal(compare(stored, { ...stored, price: 15 }).delta, 3);
  assert.deepEqual(stored, before);
});
