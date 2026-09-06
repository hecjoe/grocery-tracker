const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const scenarios = require('./fixtures/price-history/scenarios.json');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const source = html.match(/\/\/ PRICE HISTORY LOGIC START([\s\S]*?)\/\/ PRICE HISTORY LOGIC END/)?.[1] || '';
for (const fixture of scenarios) {
  test(`price history: ${fixture.case}`, () => {
    const comparePriceHistory = new Function(source + '\nreturn typeof comparePriceHistory === "function" ? comparePriceHistory : null;')();
    assert.equal(typeof comparePriceHistory, 'function', 'price diff logic must exist');
    const before = JSON.stringify(fixture.stored);
    assert.deepEqual(comparePriceHistory(fixture.stored, fixture.scan), fixture.expected);
    assert.equal(JSON.stringify(fixture.stored), before, 'comparison must not mutate saved history');
  });
}
