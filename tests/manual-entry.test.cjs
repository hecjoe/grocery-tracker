const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = require('./fixtures/price-history/manual.json');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function harness(options = {}) {
  const manual = html.match(/\/\/ MANUAL HISTORY INPUT START([\s\S]*?)\/\/ MANUAL HISTORY INPUT END/)?.[1];
  assert.ok(manual, 'manual history input adapter must exist');
  const logic = html.match(/\/\/ PRICE HISTORY LOGIC START([\s\S]*?)\/\/ PRICE HISTORY LOGIC END/)[1];
  const scans = html.slice(html.indexOf('    async function savePriceScan('), html.indexOf('    function toggleTripHistory('));
  const records = new Map();
  const tripScans = [];
  const renderedItems = [];
  const state = { items: [], selectedProfileId: '1' };
  const elements = Object.fromEntries(['newItemName', 'newItemPrice', 'newItemNumber', 'scanButton', 'scanStatus', 'historyStorageStatus'].map(id => [id, { value: '', disabled: false }]));
  const metadata = html.slice(html.indexOf('    const linkedArchiveScans'), html.indexOf('    let finishingTrip'));
  const addSource = html.slice(html.indexOf('    let addingItem'), html.indexOf('    function handleItemNameKeydown'));
  const db = { transaction() {
    const tx = { objectStore() { return {
      get(key) {
        const request = { result: structuredClone(records.get(key)) };
        queueMicrotask(() => {
          try { request.onsuccess(); tx.oncomplete(); }
          catch (error) { tx.error = error; tx.onabort(); }
        });
        return request;
      },
      put(record) { records.set(record.itemNumber, structuredClone(record)); }
    }; } };
    return tx;
  } };
  const api = new Function('openPriceHistory', 'tripScans', 'renderTripHistory', 'document', 'state', 'validateInput', 'saveData', 'crypto',
    logic + manual + scans + metadata + addSource + ';return { manualHistoryInput, trackPriceScan, addItem };')(
      async () => { if (options.historyGate) await options.historyGate; return db; }, tripScans,
      () => { if (options.renderError) throw new Error('History UI unavailable'); },
      { getElementById(id) { return elements[id]; } }, state, () => {},
      () => { renderedItems.splice(0, renderedItems.length, ...structuredClone(state.items)); }, options.crypto || globalThis.crypto);
  return { ...api, records, tripScans, state, elements, renderedItems };
}
for (const fixture of fixtures) {
  test(fixture.case, async () => {
    const app = harness();
    for (const [index, entry] of fixture.entries.entries()) {
      if (entry.origin === 'manual') {
        app.elements.newItemName.value = entry.name;
        app.elements.newItemPrice.value = String(entry.price);
        app.elements.newItemNumber.value = entry.itemNumber;
        await app.addItem();
        assert.equal(app.state.items.at(-1).delta, fixture.deltas[index]);
        assert.equal(app.elements.newItemNumber.value, '', 'number clears after Add');
      } else await app.trackPriceScan(entry);
      assert.equal(app.tripScans[index].delta, fixture.deltas[index]);
      assert.equal(app.tripScans[index].status, index === 0 ? 'new' : 'increased');
    }
    assert.deepEqual([...app.records.keys()], [fixture.key]);
    assert.deepEqual(app.records.get(fixture.key).history.map(entry => entry.price), fixture.entries.map(entry => entry.price));
  });
}

test('adding an OCR-filled item does not append a second observation', async () => {
  const app = harness();
  const scan = { itemNumber: '1129578', name: 'Organic Milk', price: 19.99 };
  await app.trackPriceScan(scan);
  app.elements.newItemName.value = scan.name;
  app.elements.newItemPrice.value = String(scan.price);
  await app.addItem();
  assert.equal(app.records.get(scan.itemNumber).history.length, 1);
  assert.equal(app.tripScans.length, 1);
  assert.equal(app.state.items[0].itemNumber, scan.itemNumber);
});

test('rapid manual Add clicks produce one purchase and one history observation', async () => {
  const app = harness();
  app.elements.newItemName.value = 'Organic Milk';
  app.elements.newItemPrice.value = '19.99';
  app.elements.newItemNumber.value = '1129578';
  await Promise.all([app.addItem(), app.addItem()]);
  assert.equal(app.state.items.length, 1);
  assert.equal(app.records.get('1129578').history.length, 1);
  assert.equal(app.elements.scanButton.disabled, false);
});

const regression = require('./fixtures/price-history/manual-add-regression.json');
function fillRegression(app) {
  app.elements.newItemName.value = regression.name;
  app.elements.newItemPrice.value = regression.priceInput;
  app.elements.newItemNumber.value = regression.itemNumber;
}
test('TEST/$5/#1234 appears immediately before history completes, and records $5 exactly once', async () => {
  let release;
  const app = harness({ historyGate: new Promise(resolve => { release = resolve; }) });
  fillRegression(app);
  const pending = app.addItem();
  try {
    assert.equal(app.state.items.length, regression.expectedCount);
    assert.equal(app.renderedItems[0].unitPrice, regression.expectedPrice);
    assert.equal(app.state.items[0].itemNumber, regression.itemNumber);
    assert.equal(app.records.size, 0);
  } finally { release(); await pending; }
  await app.addItem();
  assert.equal(app.state.items.length, 1);
  assert.deepEqual(app.records.get('1234').history.map(entry => entry.price), [5]);
});
test('history UI failure cannot prevent or duplicate the working item', async () => {
  const app = harness({ renderError: true });
  fillRegression(app);
  await assert.doesNotReject(app.addItem());
  assert.equal(app.state.items.length, 1);
  assert.equal(app.renderedItems[0].unitPrice, 5);
  await app.addItem();
  assert.equal(app.state.items.length, 1);
});
test('missing crypto.randomUUID cannot strand a purchase after writing its history', async () => {
  const app = harness({ crypto: {} });
  fillRegression(app);
  await assert.doesNotReject(app.addItem());
  assert.equal(app.state.items.length, 1);
  assert.deepEqual(app.records.get('1234').history.map(entry => entry.price), [5]);
});
