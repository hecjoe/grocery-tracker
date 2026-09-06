const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = require('./fixtures/trip-history/scenarios.json');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function logic() {
  const source = html.match(/\/\/ TRIP ARCHIVE LOGIC START([\s\S]*?)\/\/ TRIP ARCHIVE LOGIC END/)?.[1];
  assert.ok(source, 'trip archive logic must exist');
  return new Function(source + '; return { buildArchivedTrip, orderArchivedTrips, archiveTrip, readArchivedTrips };')();
}
const memoryStore = () => {
  const records = new Map();
  return { async put(record) { records.set(record.tripId, structuredClone(record)); }, async getAll() { return structuredClone([...records.values()]); } };
};
test('finish three items preserves prices, deltas and quantity-adjusted drift', async () => {
  const { archiveTrip, readArchivedTrips } = logic();
  const store = memoryStore();
  const input = structuredClone(fixtures.trip);
  assert.deepEqual(await archiveTrip(store, input), fixtures.trip.expected);
  input.items[0].name = 'Changed after finishing';
  assert.deepEqual(await readArchivedTrips(store), [fixtures.trip.expected]);
});
test('finish an empty trip is a harmless no-op, including a second finish', async () => {
  const { archiveTrip, readArchivedTrips } = logic();
  const store = memoryStore();
  assert.equal(await archiveTrip(store, fixtures.empty), null);
  await archiveTrip(store, fixtures.trip);
  assert.equal(await archiveTrip(store, fixtures.empty), null);
  assert.equal((await readArchivedTrips(store)).length, 1);
});
test('two archived trips are independently retrievable, newest first', async () => {
  const { archiveTrip, readArchivedTrips } = logic();
  const store = memoryStore();
  await archiveTrip(store, fixtures.later);
  await archiveTrip(store, fixtures.trip);
  const records = await readArchivedTrips(store);
  assert.deepEqual(records.map(trip => trip.tripId), ['trip-two', 'trip-one']);
  assert.equal(records[0].totalDrift, -1);
  assert.deepEqual(records[0].items, [{ name: 'Organic Milk', itemNumber: '1234567', price: 5.99, quantity: 1, delta: -1 }]);
  assert.deepEqual(records[1], fixtures.trip.expected);
});

function finishHarness(put) {
  const { archiveTrip } = logic();
  const state = { items: structuredClone(fixtures.trip.items) };
  const status = {};
  const surfaces = [{ inert: false }];
  const document = {
    getElementById(id) { return id === 'tripArchiveStatus' ? status : { disabled: false, focus() {} }; },
    querySelectorAll() { return surfaces; }
  };
  const source = html.slice(html.indexOf('    let finishingTrip = false;'), html.indexOf('    async function showArchivedTrips()'));
  const finish = new Function('state', 'document', 'workingArchiveScans', 'archiveTrip', 'archivedTripStore', 'saveData', 'render',
    source + '; return finishTrip;')(state, document, new Map(), archiveTrip, { put }, () => {}, () => {});
  return { finish, state, status, surfaces };
}
test('Finish Trip waits for commit, ignores concurrent clicks, and blocks the subsequent empty finish', async () => {
  let commit;
  let writes = 0;
  const harness = finishHarness(() => { writes++; return new Promise(resolve => { commit = resolve; }); });
  const pending = harness.finish();
  assert.equal(harness.state.items.length, 3, 'items remain until commit');
  assert.equal(harness.surfaces[0].inert, true);
  await harness.finish();
  assert.equal(writes, 1);
  commit();
  await pending;
  assert.deepEqual(harness.state.items, []);
  assert.equal(harness.surfaces[0].inert, false);
  await harness.finish();
  assert.equal(writes, 1);
  assert.match(harness.status.textContent, /Nothing to finish/);
});
test('failed archive preserves working items and reuses the same trip ID on retry', async () => {
  const ids = [];
  const harness = finishHarness(async record => {
    ids.push(record.tripId);
    if (ids.length === 1) throw new Error('Quota exceeded');
  });
  await harness.finish();
  assert.equal(harness.state.items.length, 3);
  assert.equal(harness.surfaces[0].inert, false);
  assert.match(harness.status.textContent, /Could not archive/);
  await harness.finish();
  assert.equal(ids[0], ids[1]);
  assert.deepEqual(harness.state.items, []);
});
