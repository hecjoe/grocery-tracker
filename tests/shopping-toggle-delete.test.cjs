const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const source = html.match(/\/\/ SHOPPING LIST LOGIC START([\s\S]*?)\/\/ SHOPPING LIST LOGIC END/)[1];
const fixtures = require('./fixtures/shopping-list/toggle-delete.json');
function harness(storage) {
  const input = { value: '', focus() {} };
  const state = { items: [{ name: 'Existing purchase', unitPrice: 5 }] };
  const api = new Function('localStorage', 'document', 'renderShoppingList', 'validateInput', 'state', 'indexedDB', source +
    ';return { addPlannedItem, selectPlannedItem, completePlannedItems, loadShoppingList, deletePlannedItem: typeof deletePlannedItem === "function" ? deletePlannedItem : undefined, getItems: () => plannedItems };')(
    { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    { getElementById: () => input }, () => {}, () => {}, state,
    { open() { assert.fail('planned list actions must never access price history or trip archives'); } });
  return { ...api, input, state };
}
for (const fixture of fixtures) test(fixture.case, () => {
  const storage = new Map([['costco_tracker_data', 'unchanged working trip']]);
  let app = harness(storage);
  app.addPlannedItem('Cheese'); app.addPlannedItem('Paper towels');
  const id = app.getItems()[0].id, other = app.getItems()[1].id;
  const originalWorkingItems = structuredClone(app.state.items);
  for (const step of fixture.steps) {
    if (step === 'tap') app.selectPlannedItem(id);
    if (step === 'edit') app.input.value = 'Milk';
    if (step === 'purchase') app.completePlannedItems([{ name: ' cheese ' }]);
    if (step === 'delete' || step === 'deleteOther') {
      assert.equal(typeof app.deletePlannedItem, 'function');
      app.deletePlannedItem(step === 'delete' ? id : other);
    }
    if (step === 'reload') { app = harness(storage); app.loadShoppingList(); }
  }
  assert.deepEqual(app.state.items, originalWorkingItems);
  assert.equal(storage.get('costco_tracker_data'), 'unchanged working trip');
  assert.deepEqual(JSON.parse(storage.get('grocery_planned_items')), app.getItems());
  if (fixture.deleted) assert.equal(app.getItems().some(item => item.id === id), false);
  else {
    assert.equal(app.getItems().find(item => item.id === id).completed, fixture.completed);
    assert.equal(app.input.value, fixture.input);
  }
  if (fixture.steps.includes('deleteOther')) assert.deepEqual(app.getItems().map(item => item.name), ['Cheese']);
});

test('swipe left reveals, swipe right dismisses, and vertical movement remains scrolling', () => {
  const source = html.slice(html.indexOf('    function bindPlannedSwipe('), html.indexOf('    function initializeShoppingGestures('));
  const events = {}, classes = new Set();
  const remove = { disabled: true };
  const row = { addEventListener: (name, fn) => { events[name] = fn; },
    classList: { add: name => classes.add(name) }, querySelector: () => remove };
  const close = () => { classes.clear(); remove.disabled = true; };
  new Function('closePlannedSwipes', 'setTimeout', 'clearTimeout', source + ';return bindPlannedSwipe;')(
    close, () => 1, () => {})(row);
  const swipe = (dx, dy) => {
    events.touchstart({ touches: [{ clientX: 100, clientY: 100 }] });
    let prevented = false;
    events.touchmove({ touches: [{ clientX: 100 + dx, clientY: 100 + dy }], preventDefault() { prevented = true; } });
    events.touchend();
    return prevented;
  };
  assert.equal(swipe(-70, 2), true);
  assert.equal(classes.has('swipe-open'), true);
  assert.equal(remove.disabled, false);
  let stopped = false;
  events.click({ preventDefault() {}, stopPropagation() { stopped = true; } });
  assert.equal(stopped, true, 'swipe must not also toggle the item');
  assert.equal(swipe(70, 2), true);
  assert.equal(classes.size, 0);
  assert.equal(remove.disabled, true);
  assert.equal(swipe(-3, 70), false, 'vertical scrolling is not prevented');
  assert.equal(classes.size, 0);
});

test('both rendered delete buttons call the same planned-only delete action', () => {
  const source = html.slice(html.indexOf('    function renderShoppingList('), html.indexOf('    function toggleShoppingList('));
  const nodes = [];
  const node = () => ({ children: [], setAttribute() {}, append(...children) { this.children.push(...children); }, replaceChildren() {} });
  const list = node(), deleted = [];
  const document = { getElementById: () => list, createElement() { const result = node(); nodes.push(result); return result; } };
  new Function('document', 'plannedItems', 'deletePlannedItem', 'bindPlannedSwipe', source + ';renderShoppingList();')(
    document, [{ id: 'cheese', name: 'Cheese', completed: true }], id => deleted.push(id), () => {});
  const fallback = nodes.find(node => node.className === 'btn-delete-item');
  const swipe = nodes.find(node => node.className === 'planned-swipe-delete');
  assert.equal(fallback.onclick, swipe.onclick);
  fallback.onclick(); swipe.onclick();
  assert.deepEqual(deleted, ['cheese', 'cheese']);
});
