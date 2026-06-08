/**
 * Data-driven validation of the example captures against the example rule set.
 * Each capture exercises a specific outcome (clean, schema, sequence, unclassified).
 * All fixtures are synthetic (see docs/design.md §9.2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadRuleSet } from '../src/engine/load-rule-set.js';
import { readExport } from '../src/read.js';
import { validate } from '../src/engine/validate.js';

const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const RULES = at('../examples/rule-sets/ecommerce-checkout.json');
const sortedCodes = (report) => report.violations.map((v) => v.code).sort();

const CASES = [
  { file: 'clean-multi.csv',          events: 5, skipped: 1, unclassified: 0, codes: [] },
  { file: 'missing-currency.csv',     events: 2, skipped: 1, unclassified: 0, codes: ['schema'], field: 'cc' },
  { file: 'bad-currency.csv',         events: 2, skipped: 0, unclassified: 0, codes: ['schema'], field: 'cc' },
  { file: 'bad-order-id.csv',         events: 2, skipped: 0, unclassified: 0, codes: ['schema'], field: 'v1' },
  { file: 'purchase-without-cart.csv', events: 2, skipped: 0, unclassified: 0, codes: ['precedes'] },
  { file: 'duplicate-purchase.csv',   events: 3, skipped: 0, unclassified: 0, codes: ['count'] },
  { file: 'unclassified.csv',         events: 2, skipped: 2, unclassified: 1, codes: [] },
  { file: 'mixed-errors.csv',         events: 4, skipped: 1, unclassified: 0, codes: ['schema', 'schema', 'schema'] }
];

for (const c of CASES) {
  test(`capture: ${c.file}`, async () => {
    const ruleSet = await loadRuleSet(RULES);
    const { events, skipped } = readExport(await readFile(at(`../examples/captures/${c.file}`), 'utf8'));
    const report = validate(events, ruleSet);

    assert.equal(events.length, c.events, 'event count');
    assert.equal(skipped, c.skipped, 'skipped non-Adobe rows');
    assert.equal(report.summary.unclassified, c.unclassified, 'unclassified count');
    assert.deepEqual(sortedCodes(report), [...c.codes].sort(), 'violation codes');

    if (c.field) {
      assert.ok(
        report.violations.some((v) => v.field === c.field),
        `expected a violation on field "${c.field}"`
      );
    }
  });
}

test('mixed-errors names each offending field on the right beacon', async () => {
  const ruleSet = await loadRuleSet(RULES);
  const { events } = readExport(await readFile(at('../examples/captures/mixed-errors.csv'), 'utf8'));
  const report = validate(events, ruleSet);
  // beacon #1 productView (no products), #2 addToCart (bad cc), #3 purchase (no v1)
  const byBeacon = Object.fromEntries(report.violations.map((v) => [v.beacon, v.field]));
  assert.equal(byBeacon[1], 'products');
  assert.equal(byBeacon[2], 'cc');
  assert.equal(byBeacon[3], 'v1');
});
