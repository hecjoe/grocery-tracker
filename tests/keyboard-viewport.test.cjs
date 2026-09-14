const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const source = html.match(/\/\/ KEYBOARD VIEWPORT RECOVERY START([\s\S]*?)\/\/ KEYBOARD VIEWPORT RECOVERY END/)[1];
function setup() {
  const events = {}, viewportEvents = {};
  let callback;
  const root = { clientWidth: 390, clientHeight: 844, scrollTop: 0 };
  const body = { scrollTop: 0 };
  const document = { documentElement: root, scrollingElement: root, body, activeElement: null, addEventListener: (name, fn) => { events[name] = fn; } };
  const calls = [];
  const viewport = { height: 844, scale: 1, offsetTop: 0, offsetLeft: 0, addEventListener: (name, fn) => { viewportEvents[name] = fn; } };
  const window = { visualViewport: viewport, scrollY: 0, scrollX: 0, addEventListener() {}, scrollTo: value => { calls.push(value); window.scrollY = 0; viewport.offsetTop = 0; } };
  new Function('window', 'document', 'setTimeout', 'clearTimeout', source + '; initializeKeyboardViewportRecovery();')(
    window, document, fn => { callback = fn; return 1; }, () => { callback = null; });
  const input = { matches: () => true };
  const focus = () => { document.activeElement = input; events.focusin({ target: input }); };
  const blur = () => { document.activeElement = null; events.focusout(); };
  const settle = () => { const fn = callback; callback = null; fn?.(); };
  return { root, body, window, document, viewport, calls, focus, blur, settle, resize: () => viewportEvents.resize() };
}
test('keyboard dismissal restores outer scroll only after viewport height recovers', () => {
  const app = setup(); app.focus();
  app.viewport.height = 450; app.viewport.offsetTop = 100; app.window.scrollY = 100;
  app.root.scrollTop = app.body.scrollTop = 100;
  app.blur(); app.settle();
  assert.equal(app.calls.length, 0, 'do not scroll while keyboard is still open');
  app.viewport.height = 844; app.resize();
  assert.equal(app.calls.length, 0, 'wait for settling');
  app.settle();
  assert.equal(app.calls.length, 1);
  assert.equal(app.window.scrollY, 0); assert.equal(app.root.scrollTop, 0); assert.equal(app.body.scrollTop, 0);
});
test('keyboard Done can recover even when Safari leaves the input focused', () => {
  const app = setup(); app.focus(); app.viewport.height = 450; app.resize(); app.settle();
  app.viewport.height = 844; app.viewport.offsetTop = 42; app.resize(); app.settle();
  assert.equal(app.calls.length, 1);
  assert.ok(app.document.activeElement, 'input was not blurred by recovery');
});
test('a late dismissal frame cannot leave a second page offset behind', () => {
  const app = setup(); app.focus(); app.viewport.height = 450; app.blur(); app.settle();
  app.viewport.height = 800; app.window.scrollY = 60; app.resize(); app.settle();
  assert.equal(app.calls.length, 1);
  app.viewport.height = 844; app.window.scrollY = 20; app.viewport.offsetTop = 20;
  app.resize(); app.settle();
  assert.equal(app.calls.length, 2);
  assert.equal(app.window.scrollY, 0);
});
test('no page scroll reset during pinch zoom or ordinary non-keyboard resizing', () => {
  const app = setup(); app.resize(); app.settle(); assert.equal(app.calls.length, 0);
  app.focus(); app.viewport.scale = 2; app.window.scrollY = 42; app.blur(); app.settle();
  assert.equal(app.calls.length, 0);
});
