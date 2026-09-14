const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const fixtures = require('./fixtures/shopping-list/scenarios.json');
function harness(storage = new Map()) {
  const source = html.match(/\/\/ SHOPPING LIST LOGIC START([\s\S]*?)\/\/ SHOPPING LIST LOGIC END/)?.[1];
  assert.ok(source, 'shopping list logic exists');
  const input = { value: '', focus() {} };
  const elements = { newItemName: input, newItemPrice: { value: '5' }, newItemNumber: { value: '' }, scanButton: { disabled: false } };
  const state = { items: [], selectedProfileId: '1' };
  const add = html.slice(html.indexOf('    let addingItem'), html.indexOf('    function handleItemNameKeydown'));
  let confirmations = 0;
  const api = new Function('localStorage', 'document', 'confirm', 'renderShoppingList', 'validateInput', 'state', 'saveData', source + add +
    '; updatePurchasedItemHistory = async () => {}; return { addItem, addPlannedItem, selectPlannedItem, completePlannedItems, clearPlannedItems, loadShoppingList, getItems: () => plannedItems };')(
    { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    { getElementById: id => elements[id] || input }, () => { confirmations++; return true; }, () => {}, () => {}, state, () => {});
  return { ...api, input, storage, state, confirmations: () => confirmations };
}
for (const fixture of fixtures) test(fixture.case, async () => {
  const app = harness();
  app.addPlannedItem('Cheese');
  assert.equal(app.getItems()[0].completed, false);
  if (fixture.action === 'select') {
    app.selectPlannedItem(app.getItems()[0].id);
    assert.equal(app.input.value, 'Cheese');
  }
  if (fixture.action === 'purchase') {
    app.input.value = fixture.name;
    await app.addItem();
    assert.equal(app.state.items.length, 1, 'completion follows a real working-list addition');
  }
  if (fixture.action === 'clear') {
    app.clearPlannedItems();
    assert.equal(app.confirmations(), 1);
    assert.deepEqual(app.getItems(), []);
  } else if (fixture.action === 'reload') {
    app.completePlannedItems([{ name: 'Cheese' }]);
    app.addPlannedItem('Paper towels');
    const reloaded = harness(app.storage);
    reloaded.loadShoppingList();
    assert.deepEqual(reloaded.getItems(), app.getItems());
    assert.deepEqual(reloaded.getItems().map(item => item.completed), [true, false]);
  } else {
    assert.equal(app.getItems()[0].name, 'Cheese');
    assert.equal(app.getItems()[0].completed, fixture.completed);
  }
});

test('three budget profiles clear both stacked pills at wide and phone widths', () => {
  const source = html.slice(html.indexOf('    function initializeFloatingTools()'), html.indexOf('    // PRICE HISTORY LOGIC START'));
  for (const width of [800, 375]) {
    const styles = {};
    const pill = { offsetWidth: 235, offsetHeight: 38 };
    const budget = {
      getBoundingClientRect: () => ({ top: 70 }),
      querySelectorAll: () => Array.from({ length: 3 }, () => ({ offsetWidth: 140 })),
      style: { setProperty: (key, value) => { styles[key] = value; } }
    };
    const document = { getElementById: id => id === 'budgetDashboard' ? budget : id === 'shoppingList' ? { addEventListener() {} } : pill, querySelector: () => ({ offsetHeight: 70 }), documentElement: { clientWidth: width } };
    const Observer = class { observe() {} };
    new Function('document', 'window', 'ResizeObserver', 'MutationObserver', source + '; initializeFloatingTools();')(
      document, { innerWidth: width, addEventListener() {} }, Observer, Observer);
    assert.equal(styles['--budget-clearance'], width === 800 ? '0px 259px 0px 0px' : '86px 0px 0px 0px');
    assert.deepEqual(Object.keys(styles), ['--budget-clearance']);
  }
});

test('Add then keyboard dismissal waits 200ms after the last resize and preserves clearance', () => {
  const source = html.slice(html.indexOf('    function initializeFloatingTools()'), html.indexOf('    // PRICE HISTORY LOGIC START'));
  let now = 0, nextId = 0, reads = 0;
  const timers = new Map(), listeners = {}, visualListeners = {}, writes = [];
  const setTimer = (fn, ms) => { const id = ++nextId; timers.set(id, { fn, at: now + ms }); return id; };
  const advance = ms => {
    now += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
  };
  let width = 375;
  const pill = { offsetWidth: 235, offsetHeight: 38 };
  const topBar = { offsetHeight: 70 };
  const budget = { querySelectorAll: () => [{ offsetWidth: 140 }], style: { setProperty: (key, value) => writes.push([key, value]) } };
  const document = {
    documentElement: { get clientWidth() { reads++; return width; } },
    getElementById: id => id === 'budgetDashboard' ? budget : id === 'shoppingList' ? { addEventListener() {} } : pill,
    querySelector: () => topBar
  };
  const window = { innerHeight: 844, addEventListener: (event, fn) => { listeners[event] = fn; },
    visualViewport: { height: 844, addEventListener: (event, fn) => { visualListeners[event] = fn; } } };
  const Observer = class { observe() {} };
  new Function('document', 'window', 'ResizeObserver', 'MutationObserver', 'setTimeout', 'clearTimeout', source + '; initializeFloatingTools();')(
    document, window, Observer, Observer, setTimer, id => timers.delete(id));
  const before = writes.at(-1), initialReads = reads;
  const resize = height => {
    window.innerHeight = window.visualViewport.height = height;
    listeners.resize();
    visualListeners.resize?.();
  };
  const app = harness();
  app.input.focus();
  resize(450); // Keyboard opening.
  advance(100);
  app.addPlannedItem('Cheese'); // The shopping form's actual submission action.
  app.input.blur = () => resize(620);
  app.input.blur(); // Simulate native button focus/keyboard dismissal.
  advance(199);
  assert.equal(reads, initialReads, 'no clearance calculation during keyboard animation');
  assert.equal(writes.length, 1);
  resize(844); // Final dismissal resize restarts the settle window.
  advance(199);
  assert.equal(reads, initialReads);
  advance(1);
  assert.ok(reads > initialReads, 'evaluate dimensions only after settling');
  assert.equal(writes.length, 1, 'height-only changes must not rewrite clearance');
  assert.deepEqual(writes.at(-1), before);
  assert.equal(app.getItems()[0].name, 'Cheese');
  width = 900; // A real layout-width change must still update spacing.
  resize(844);
  advance(199);
  assert.equal(writes.length, 1);
  advance(1);
  assert.deepEqual(writes.at(-1), ['--budget-clearance', '0px 259px 0px 0px']);
});
