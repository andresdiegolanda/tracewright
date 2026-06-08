/**
 * End-to-end: read a CSV export → validate against the example rule set → render a report.
 * Exercises read.js + the engine + report.js together against committed synthetic fixtures.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadRuleSet } from '../src/engine/load-rule-set.js';
import { readExport } from '../src/read.js';
import { validate } from '../src/engine/validate.js';
import { formatReport } from '../src/report.js';

const fixture = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const RULES = '../examples/rule-sets/ecommerce-checkout.json';

test('the example rule set passes its own meta-schema and loads', async () => {
  const ruleSet = await loadRuleSet(fixture(RULES));
  assert.equal(ruleSet.name, 'example-ecommerce-checkout');
});

test('the clean example capture validates with no violations', async () => {
  const ruleSet = await loadRuleSet(fixture(RULES));
  const { events, skipped } = readExport(await readFile(fixture('../examples/captures/checkout.csv'), 'utf8'));
  const report = validate(events, ruleSet);

  assert.equal(events.length, 4); // home, productView, addToCart, purchase
  assert.equal(skipped, 1); // the Navigation row
  assert.deepEqual(report.violations, []);
  assert.equal(report.summary.unclassified, 0);

  const text = formatReport(report, { skippedNonAdobe: skipped });
  assert.match(text, /all 4 beacons OK/);
  assert.match(text, /1 non-Adobe row skipped/);
});

test('test0.csv surfaces the two deliberately cc-less add-to-carts', async () => {
  const ruleSet = await loadRuleSet(fixture(RULES));
  const { events, skipped } = readExport(await readFile(fixture('../test0.csv'), 'utf8'));
  const report = validate(events, ruleSet);

  assert.equal(events.length, 6);
  assert.equal(skipped, 1);

  const ccMissing = report.violations.filter((v) => v.code === 'schema' && v.field === 'cc');
  assert.equal(ccMissing.length, 2); // beacons #4 and #5
  assert.deepEqual(ccMissing.map((v) => v.beacon).sort((a, b) => a - b), [4, 5]);

  const text = formatReport(report, { skippedNonAdobe: skipped });
  assert.match(text, /2 of 6 beacons have violations/);
  assert.match(text, /required field missing: "cc"/);
});
