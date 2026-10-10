const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
  const elements = Object.fromEntries(['newItemName', 'newItemPrice', 'newItemNumber', 'scanButton', 'scanStatus', 'historyStorageStatus'].map(id => [id, { value: '', disabled: false, textContent: '' }]));
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
  const api = new Function('openPriceHistory', 'tripScans', 'renderTripHistory', 'document', 'state', 'validateInput', 'saveData', 'crypto', 'completePlannedItems', 'render',
    logic + manual + scans + metadata + addSource + ';return { manualHistoryInput, trackPriceScan, addItem, updateItem, toggleEditItem };')(
      async () => { if (options.historyGate) await options.historyGate; return db; }, tripScans,
      () => { if (options.renderError) throw new Error('History UI unavailable'); },
      { getElementById(id) { return elements[id]; } }, state, () => {},
      () => { renderedItems.splice(0, renderedItems.length, ...structuredClone(state.items)); }, options.crypto || globalThis.crypto, () => {}, () => {});
  return { ...api, records, tripScans, state, elements, renderedItems };
}

async function addManualItem(app, { name, price, itemNumber = '' }) {
  app.elements.newItemName.value = name;
  app.elements.newItemPrice.value = String(price);
  app.elements.newItemNumber.value = itemNumber;
  await app.addItem();
  return app.state.items.at(-1);
}

test('editing an item price corrects the existing history entry instead of appending a second one', async () => {
  const app = harness();
  const item = await addManualItem(app, { name: 'Organic Milk', price: 19.99, itemNumber: '1129578' });
  await app.updateItem(item.id, 'unitPrice', 17.49);

  assert.equal(app.state.items[0].unitPrice, 17.49);
  const record = app.records.get('1129578');
  assert.equal(record.history.length, 1, 'edit must not append a second observation');
  assert.equal(record.history[0].price, 17.49);
  assert.equal(app.tripScans[0].price, 17.49, 'in-memory trip scan must reflect the corrected price');
});

test('editing the price of a name-keyed (no item number) item corrects its history entry', async () => {
  const app = harness();
  const item = await addManualItem(app, { name: 'Loose Avocado', price: 1.5 });
  await app.updateItem(item.id, 'unitPrice', 1.75);

  const record = app.records.get('name:LOOSE AVOCADO');
  assert.equal(record.history.length, 1);
  assert.equal(record.history[0].price, 1.75);
});

test('editing the price of an item with no linked history entry only updates the item', async () => {
  const app = harness();
  app.state.items.push({ id: 'manual-1', name: 'Cash register sample', unitPrice: 2, quantity: 1, profileId: '1' });

  await app.updateItem('manual-1', 'unitPrice', 3);

  assert.equal(app.state.items[0].unitPrice, 3);
  assert.equal(app.records.size, 0, 'nothing to correct, so IndexedDB must stay untouched');
});

test('an invalid price edit is rejected and leaves the item unchanged', async () => {
  const app = harness();
  const item = await addManualItem(app, { name: 'Organic Milk', price: 19.99, itemNumber: '1129578' });

  await app.updateItem(item.id, 'unitPrice', NaN);

  assert.equal(app.state.items[0].unitPrice, 19.99);
  assert.equal(app.records.get('1129578').history.length, 1);
});

test('toggling edit mode sets and clears state.editingItemId', async () => {
  const app = harness();
  const item = await addManualItem(app, { name: 'Organic Milk', price: 19.99, itemNumber: '1129578' });

  app.toggleEditItem(item.id);
  assert.equal(app.state.editingItemId, item.id);
  app.toggleEditItem(item.id);
  assert.equal(app.state.editingItemId, null);
});
